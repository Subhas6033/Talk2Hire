const ftp = require("basic-ftp");

/**
 * FTP Connection Pool Manager
 * Maintains a pool of reusable FTP connections to avoid "too many connections" errors
 */
class FTPConnectionPool {
  constructor(config = {}) {
    this.config = {
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: Number(process.env.FTP_PORT) || 21,
      secure: false,
      ...config,
    };

    // Pool settings
    this.maxConnections = config.maxConnections || 4; // Limit to 4 concurrent connections
    this.connectionTimeout = 120000; // 2 minutes
    this.idleTimeout = 60000; // Close idle connections after 1 minute

    // Connection pool
    this.pool = [];
    this.activeConnections = 0;
    this.waitQueue = [];

    console.log("🔌 FTP Connection Pool initialized:", {
      maxConnections: this.maxConnections,
      host: this.config.host,
    });
  }

  /**
   * Get a connection from the pool
   */
  async acquire() {
    // Check if there's an available connection
    const availableConnection = this.pool.find((conn) => !conn.inUse);

    if (availableConnection) {
      console.log(
        `♻️ Reusing existing FTP connection (${this.activeConnections}/${this.maxConnections} active)`,
      );
      availableConnection.inUse = true;
      availableConnection.lastUsed = Date.now();

      // Test if connection is still alive
      try {
        await availableConnection.client.pwd();
        return availableConnection;
      } catch (error) {
        console.warn("⚠️ Connection dead, creating new one");
        this.pool = this.pool.filter((c) => c !== availableConnection);
        this.activeConnections--;
      }
    }

    // If we haven't hit max connections, create a new one
    if (this.activeConnections < this.maxConnections) {
      console.log(
        `🆕 Creating new FTP connection (${this.activeConnections + 1}/${this.maxConnections})`,
      );
      return await this.createConnection();
    }

    // Wait for a connection to become available
    console.log(
      `⏳ Connection pool full (${this.activeConnections}/${this.maxConnections}), waiting...`,
    );
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.indexOf(waiter);
        if (index > -1) this.waitQueue.splice(index, 1);
        reject(new Error("FTP connection acquire timeout"));
      }, 30000); // 30 second timeout

      const waiter = { resolve, reject, timeout };
      this.waitQueue.push(waiter);
    });
  }

  /**
   * Create a new FTP connection
   */
  async createConnection() {
    const client = new ftp.Client();
    client.ftp.timeout = this.connectionTimeout;

    try {
      await client.access(this.config);

      const connection = {
        client,
        inUse: true,
        lastUsed: Date.now(),
        createdAt: Date.now(),
      };

      this.pool.push(connection);
      this.activeConnections++;

      console.log(
        ` FTP connection created (${this.activeConnections}/${this.maxConnections} active)`,
      );

      return connection;
    } catch (error) {
      console.error("❌ Failed to create FTP connection:", error);
      throw error;
    }
  }

  /**
   * Release a connection back to the pool
   */
  release(connection) {
    if (!connection) return;

    connection.inUse = false;
    connection.lastUsed = Date.now();

    console.log(
      ` FTP connection released (${this.pool.filter((c) => c.inUse).length}/${this.maxConnections} active)`,
    );

    // If there are waiting requests, give them the connection
    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift();
      clearTimeout(waiter.timeout);

      connection.inUse = true;
      waiter.resolve(connection);
    }
  }

  /**
   * Close a specific connection
   */
  async closeConnection(connection) {
    if (!connection) return;

    try {
      await connection.client.close();
      this.pool = this.pool.filter((c) => c !== connection);
      this.activeConnections--;

      console.log(
        `🔌 FTP connection closed (${this.activeConnections}/${this.maxConnections} active)`,
      );
    } catch (error) {
      console.error("⚠️ Error closing FTP connection:", error);
    }
  }

  /**
   * Clean up idle connections
   */
  cleanupIdleConnections() {
    const now = Date.now();
    const connectionsToClose = [];

    for (const connection of this.pool) {
      if (!connection.inUse && now - connection.lastUsed > this.idleTimeout) {
        connectionsToClose.push(connection);
      }
    }

    if (connectionsToClose.length > 0) {
      console.log(
        `🧹 Cleaning up ${connectionsToClose.length} idle connections`,
      );
      connectionsToClose.forEach((conn) => this.closeConnection(conn));
    }
  }

  /**
   * Close all connections
   */
  async closeAll() {
    console.log(`🧹 Closing all FTP connections (${this.pool.length} total)`);

    const closePromises = this.pool.map((conn) =>
      conn.client.close().catch((err) => {
        console.error("⚠️ Error closing connection:", err);
      }),
    );

    await Promise.all(closePromises);

    this.pool = [];
    this.activeConnections = 0;
    this.waitQueue = [];

    console.log(" All FTP connections closed");
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      total: this.pool.length,
      active: this.pool.filter((c) => c.inUse).length,
      idle: this.pool.filter((c) => !c.inUse).length,
      waiting: this.waitQueue.length,
      maxConnections: this.maxConnections,
    };
  }
}

// Singleton instance
let globalPool = null;

/**
 * Get the global FTP connection pool
 */
function getGlobalFTPPool() {
  if (!globalPool) {
    globalPool = new FTPConnectionPool({
      maxConnections: 4, // Stay well under the 8 connection limit
    });

    // Auto-cleanup idle connections every 30 seconds
    setInterval(() => {
      globalPool.cleanupIdleConnections();
    }, 30000);
  }

  return globalPool;
}

/**
 * Execute FTP operation with pooled connection
 */
async function withFTPConnection(operation) {
  const pool = getGlobalFTPPool();
  let connection = null;

  try {
    connection = await pool.acquire();
    const result = await operation(connection.client);
    return result;
  } finally {
    if (connection) {
      pool.release(connection);
    }
  }
}

/**
 * Helper: Upload file using pooled connection
 */
async function uploadFileToFTPPooled(
  fileBuffer,
  originalName,
  remoteDir = "/public",
) {
  return withFTPConnection(async (client) => {
    console.log("🗂 Ensuring directory:", remoteDir);
    await client.ensureDir(remoteDir);

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${timestamp}-${sanitizedName}`;

    console.log("📤 Uploading file:", fileName);

    // Create readable stream from buffer
    const { PassThrough } = require("stream");
    const source = new PassThrough();
    source.end(fileBuffer);

    // Upload file
    await client.uploadFrom(source, fileName);

    // Build full remote path
    const remotePath = `${remoteDir}/${fileName}`.replace(/\/+/g, "/");

    // Build public URL
    const fileUrl = `${process.env.FTP_BASE_URL}/artlabss.com/interview2${remotePath}`;

    console.log(" FTP upload successful");
    console.log("📍 Remote path:", remotePath);
    console.log("🔗 File URL:", fileUrl);

    return {
      success: true,
      fileName,
      remotePath,
      url: fileUrl,
      fileSize: fileBuffer.length,
    };
  });
}

/**
 * Helper: Delete file using pooled connection
 */
async function deleteFileFromFTPPooled(remotePath) {
  return withFTPConnection(async (client) => {
    console.log("🗑️ Deleting file:", remotePath);
    await client.remove(remotePath);
    console.log(" File deleted from FTP");
    return { success: true };
  });
}

/**
 * Helper: Check if file exists using pooled connection
 */
async function checkFileExistsOnFTPPooled(remotePath) {
  return withFTPConnection(async (client) => {
    try {
      const fileInfo = await client.size(remotePath);
      return { exists: true, size: fileInfo };
    } catch (error) {
      return { exists: false };
    }
  });
}

/**
 * Helper: Download file using pooled connection
 */
async function downloadFileFromFTPPooled(remotePath) {
  return withFTPConnection(async (client) => {
    console.log("📥 Downloading file:", remotePath);

    // Create a writable stream to collect data
    const { PassThrough } = require("stream");
    const chunks = [];
    const destination = new PassThrough();

    destination.on("data", (chunk) => {
      chunks.push(chunk);
    });

    // Download file
    await client.downloadTo(destination, remotePath);

    // Concatenate chunks into buffer
    const fileBuffer = Buffer.concat(chunks);

    console.log(" Download successful:", fileBuffer.length, "bytes");

    return fileBuffer;
  });
}

module.exports = {
  FTPConnectionPool,
  getGlobalFTPPool,
  withFTPConnection,
  uploadFileToFTPPooled,
  deleteFileFromFTPPooled,
  checkFileExistsOnFTPPooled,
  downloadFileFromFTPPooled,
};
