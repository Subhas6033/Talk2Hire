/**
 * Migration Script: Merge All Pending Video Chunks
 * Run this to manually trigger merge for all interviews with uploaded chunks
 */

const { connectDB } = require("./Config/database.config.js");
const VideoProcessingJobs = require("./Jobs/videoProcessing.jobs");
const config = require("./Config/videoProcessing.config");

async function migrateAndMergePendingChunks(options = {}) {
  const {
    batchSize = 5, // Process 5 interviews at a time
    delayBetweenBatches = 5000, // 5 second delay between batches
    continueOnError = true,
    dryRun = false, // Set to true to see what would be processed
  } = options;

  console.log("🚀 Starting migration: Merge all pending video chunks...\n");
  if (dryRun) {
    console.log("⚠️  DRY RUN MODE - No actual merging will occur\n");
  }

  let db;
  try {
    db = await connectDB();

    // Step 1: Find all interviews with uploaded chunks that need merging
    console.log("📊 Step 1: Finding interviews with pending chunks...");

    const [interviewsWithChunks] = await db.execute(
      `SELECT DISTINCT 
         i.id as interview_id,
         i.user_id,
         i.created_at,
         COUNT(DISTINCT q.id) as question_count,
         COUNT(DISTINCT v.id) as video_count,
         COUNT(DISTINCT c.id) as chunk_count,
         GROUP_CONCAT(DISTINCT v.video_type) as video_types
       FROM interviews i
       LEFT JOIN interview_questions q ON i.id = q.interview_id
       INNER JOIN interview_videos v ON i.id = v.interview_id
       INNER JOIN interview_video_chunks c ON v.id = c.video_id
       WHERE c.upload_status = 'uploaded'
       AND (v.ftp_url IS NULL OR v.ftp_url = '' OR v.checksum IS NULL)
       GROUP BY i.id
       ORDER BY i.created_at DESC`,
    );

    console.log(
      `\n✅ Found ${interviewsWithChunks.length} interviews with pending chunks\n`,
    );

    if (interviewsWithChunks.length === 0) {
      console.log("ℹ️  No interviews need merging. Migration complete.");
      db.release();
      return {
        success: true,
        totalInterviews: 0,
        processed: 0,
        results: [],
      };
    }

    // Display summary
    console.log("📋 Summary of interviews to process:");
    console.log("─".repeat(80));
    interviewsWithChunks.forEach((interview, index) => {
      console.log(`${index + 1}. Interview ID: ${interview.interview_id}`);
      console.log(`   Questions: ${interview.question_count}`);
      console.log(`   Videos: ${interview.video_count}`);
      console.log(`   Chunks: ${interview.chunk_count}`);
      console.log(`   Types: ${interview.video_types}`);
      console.log(`   Created: ${interview.created_at}`);
      console.log("─".repeat(80));
    });

    // Step 2: Get detailed chunk information for each interview
    console.log("\n📊 Step 2: Analyzing chunk details...\n");

    for (const interview of interviewsWithChunks) {
      const [chunkDetails] = await db.execute(
        `SELECT 
           v.id as video_id,
           v.video_type,
           v.upload_status as video_status,
           v.total_chunks,
           v.uploaded_chunks,
           v.ftp_url,
           v.checksum,
           COUNT(c.id) as actual_chunk_count,
           GROUP_CONCAT(c.chunk_number ORDER BY c.chunk_number) as chunk_numbers
         FROM interview_videos v
         LEFT JOIN interview_video_chunks c ON v.id = c.video_id
         WHERE v.interview_id = ?
         GROUP BY v.id`,
        [interview.interview_id],
      );

      console.log(`\n📹 Interview ${interview.interview_id} - Video Details:`);
      chunkDetails.forEach((video) => {
        console.log(`   ${video.video_type}:`);
        console.log(`     - Video Status: ${video.video_status}`);
        console.log(`     - Total Chunks: ${video.total_chunks}`);
        console.log(`     - Uploaded Chunks: ${video.uploaded_chunks}`);
        console.log(`     - Actual Chunks in DB: ${video.actual_chunk_count}`);
        console.log(`     - Has FTP URL: ${video.ftp_url ? "Yes" : "No"}`);
        console.log(`     - Has Checksum: ${video.checksum ? "Yes" : "No"}`);
        console.log(`     - Chunk Numbers: ${video.chunk_numbers || "None"}`);
      });
    }

    db.release();

    if (dryRun) {
      console.log("\n\n⚠️  DRY RUN COMPLETE - No videos were merged");
      return {
        success: true,
        dryRun: true,
        totalInterviews: interviewsWithChunks.length,
        wouldProcess: interviewsWithChunks.map((i) => i.interview_id),
      };
    }

    // Step 3: Process each interview through the merge job in batches
    console.log("\n\n🎬 Step 3: Starting merge process...\n");

    const results = [];
    let successCount = 0;
    let failCount = 0;

    // Process in batches
    for (let i = 0; i < interviewsWithChunks.length; i += batchSize) {
      const batch = interviewsWithChunks.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(interviewsWithChunks.length / batchSize);

      console.log(
        `\n📦 Processing Batch ${batchNum}/${totalBatches} (${batch.length} interviews)...`,
      );
      console.log("─".repeat(80));

      // Process batch concurrently with Promise.allSettled
      const batchPromises = batch.map((interview) =>
        VideoProcessingJobs.mergeInterviewVideos(interview.interview_id, {
          timeoutMs: config.merge.maxTimeoutMs,
          skipOnError: true,
          maxRetries: config.merge.maxRetries,
        })
          .then((result) => ({
            interviewId: interview.interview_id,
            success: true,
            ...result,
          }))
          .catch((error) => ({
            interviewId: interview.interview_id,
            success: false,
            error: error.message,
          })),
      );

      const batchResults = await Promise.allSettled(batchPromises);

      // Extract results
      const processedResults = batchResults.map((r) =>
        r.status === "fulfilled"
          ? r.value
          : {
              interviewId: "unknown",
              success: false,
              error: r.reason?.message || "Unknown error",
            },
      );

      results.push(...processedResults);

      // Update counters
      processedResults.forEach((r) => {
        if (r.success) successCount++;
        else failCount++;
      });

      // Log batch results
      const batchSuccess = processedResults.filter((r) => r.success).length;
      console.log(
        `✅ Batch ${batchNum} complete: ${batchSuccess}/${batch.length} successful`,
      );

      // Delay before next batch (except for last batch)
      if (i + batchSize < interviewsWithChunks.length) {
        console.log(`⏳ Waiting ${delayBetweenBatches}ms before next batch...`);
        await new Promise((resolve) =>
          setTimeout(resolve, delayBetweenBatches),
        );
      }
    }

    // Step 4: Final Summary
    console.log("\n\n" + "=".repeat(80));
    console.log("📊 MIGRATION COMPLETE - FINAL SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total Interviews Found: ${interviewsWithChunks.length}`);
    console.log(`✅ Successfully Merged: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log("=".repeat(80));

    if (failCount > 0) {
      console.log("\n❌ Failed Interviews:");
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`   - Interview ${r.interviewId}: ${r.error}`);
        });
    }

    console.log("\n✅ Migration script completed!\n");

    return {
      success: true,
      totalInterviews: interviewsWithChunks.length,
      successful: successCount,
      failed: failCount,
      results,
    };
  } catch (error) {
    console.error("\n❌ Migration failed with error:", error);
    if (!continueOnError) throw error;
    return {
      success: false,
      error: error.message,
    };
  } finally {
    if (db) {
      db.release();
    }
  }
}

// Execute migration if run directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const batchSize =
    parseInt(args.find((arg) => arg.startsWith("--batch="))?.split("=")[1]) ||
    5;

  console.log(`\n🔧 Configuration:`);
  console.log(`   Batch Size: ${batchSize}`);
  console.log(`   Dry Run: ${dryRun ? "Yes" : "No"}`);
  console.log("");

  migrateAndMergePendingChunks({ batchSize, dryRun })
    .then((result) => {
      console.log("\n✅ Migration successful");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Migration failed:", error);
      process.exit(1);
    });
}

module.exports = { migrateAndMergePendingChunks };
