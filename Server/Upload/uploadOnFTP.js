const ftp = require("basic-ftp");
const path = require("path");

async function uploadFileToFTP(
  fileBuffer,
  originalName,
  remoteDir = "/public",
) {
  const client = new ftp.Client();
  client.ftp.timeout = 120000; // 2 minutes timeout for large video files

  try {
    console.log("🔌 Connecting to FTP server...");

    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: Number(process.env.FTP_PORT) || 21,
      secure: false,
    });

    console.log("✅ FTP connected");

    // Ensure directory exists (create if needed)
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
    // Format: https://ftp.artlabss.com/artlabss.com/interview2/public/...
    const fileUrl = `${process.env.FTP_BASE_URL}/artlabss.com/interview2${remotePath}`;

    console.log("✅ FTP upload successful");
    console.log("📍 Remote path:", remotePath);
    console.log("🔗 File URL:", fileUrl);

    return {
      success: true,
      fileName,
      remotePath,
      url: fileUrl,
      fileSize: fileBuffer.length,
    };
  } catch (error) {
    console.error("❌ FTP upload failed:", error);
    throw new Error(`FTP upload failed: ${error.message}`);
  } finally {
    client.close();
    console.log("🔌 FTP connection closed");
  }
}

/**
 * Delete file from FTP
 */
async function deleteFileFromFTP(remotePath) {
  const client = new ftp.Client();
  client.ftp.timeout = 60000;

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: Number(process.env.FTP_PORT) || 21,
      secure: false,
    });

    console.log("🗑️ Deleting file:", remotePath);
    await client.remove(remotePath);

    console.log("✅ File deleted from FTP");
    return { success: true };
  } catch (error) {
    console.error("❌ FTP deletion failed:", error);
    throw new Error(`FTP deletion failed: ${error.message}`);
  } finally {
    client.close();
  }
}

/**
 * Check if file exists on FTP
 */
async function checkFileExistsOnFTP(remotePath) {
  const client = new ftp.Client();
  client.ftp.timeout = 60000;

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: Number(process.env.FTP_PORT) || 21,
      secure: false,
    });

    const fileInfo = await client.size(remotePath);
    return { exists: true, size: fileInfo };
  } catch (error) {
    return { exists: false };
  } finally {
    client.close();
  }
}

async function downloadFileFromFTP(remotePath) {
  const client = new ftp.Client();
  client.ftp.timeout = 120000; // 2 minutes for large files

  try {
    console.log("🔌 Connecting to FTP server for download...");

    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: Number(process.env.FTP_PORT) || 21,
      secure: false,
    });

    console.log("✅ FTP connected");
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

    console.log("✅ Download successful:", fileBuffer.length, "bytes");

    return fileBuffer;
  } catch (error) {
    console.error("❌ FTP download failed:", error);
    throw new Error(`FTP download failed: ${error.message}`);
  } finally {
    client.close();
    console.log("🔌 FTP connection closed");
  }
}

module.exports = {
  uploadFileToFTP,
  deleteFileFromFTP,
  checkFileExistsOnFTP,
  downloadFileFromFTP,
};
