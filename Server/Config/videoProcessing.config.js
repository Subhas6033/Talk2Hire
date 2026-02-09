// Video processing configurations
module.exports = {
  merge: {
    // Timeout settings
    baseTimeoutMs: 10 * 60 * 1000, // 10 minutes base timeout
    timeoutPerChunkMs: 3000, // 3 seconds per chunk
    maxTimeoutMs: 30 * 60 * 1000, // 30 minutes absolute max

    // Retry settings
    maxRetries: 3,
    initialRetryDelayMs: 2000, // 2 seconds
    retryBackoffMultiplier: 2, // Exponential backoff

    // Progress reporting
    progressIntervalChunks: 10, // Log every 10 chunks

    // Error handling
    skipOnError: true, // Continue merging other videos if one fails
    markFailedAfterRetries: true,

    // Chunk processing
    chunkDownloadTimeoutMs: 60000, // 60s per chunk download
    maxConcurrentDownloads: 5, // Download 5 chunks concurrently
  },

  scheduling: {
    autoMergeIntervalMs: 30 * 60 * 1000, // 30 minutes ✅ UPDATED
    pendingUploadsIntervalMs: 30 * 60 * 1000, // 30 minutes ✅ UPDATED
    retryFailedIntervalMs: 30 * 60 * 1000, // 30 minutes ✅ UPDATED
    cleanupChunksIntervalMs: 24 * 60 * 60 * 1000, // Daily (24 hours)
    verifyUploadsIntervalMs: 60 * 60 * 1000, // Hourly (1 hour)
    cleanupFailedIntervalMs: 7 * 24 * 60 * 60 * 1000, // Weekly (7 days)

    maxConcurrentMerges: 3, // Process 3 interviews at once
  },

  cleanup: {
    chunkRetentionDays: 7, // Keep chunks for 7 days
    failedUploadRetentionDays: 30, // Keep failed uploads for 30 days
    verifyRecentHours: 24, // Verify videos from last 24 hours
  },
};
