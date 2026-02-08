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
    autoMergeIntervalMs: 2 * 60 * 1000, // 2 minutes
    pendingUploadsIntervalMs: 5 * 60 * 1000, // 5 minutes
    retryFailedIntervalMs: 30 * 60 * 1000, // 30 minutes
    cleanupChunksIntervalMs: 24 * 60 * 60 * 1000, // Daily
    verifyUploadsIntervalMs: 60 * 60 * 1000, // Hourly
    cleanupFailedIntervalMs: 7 * 24 * 60 * 60 * 1000, // Weekly

    maxConcurrentMerges: 3, // Process 3 interviews at once
  },

  cleanup: {
    chunkRetentionDays: 7, // Keep chunks for 7 days
    failedUploadRetentionDays: 30, // Keep failed uploads for 30 days
    verifyRecentHours: 24, // Verify videos from last 24 hours
  },
};
