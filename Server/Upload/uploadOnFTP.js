const ftp = require("basic-ftp");
const path = require("path");
const {
  uploadFileToFTPPooled,
  deleteFileFromFTPPooled,
  checkFileExistsOnFTPPooled,
  downloadFileFromFTPPooled,
} = require("./FTPConnectionsPool");

/**
 * Upload file to FTP (uses connection pool)
 */
async function uploadFileToFTP(
  fileBuffer,
  originalName,
  remoteDir = "/public",
) {
  try {
    console.log("🔌 Using pooled FTP connection for upload...");
    return await uploadFileToFTPPooled(fileBuffer, originalName, remoteDir);
  } catch (error) {
    console.error("❌ FTP upload failed:", error);
    throw new Error(`FTP upload failed: ${error.message}`);
  }
}

/**
 * Delete file from FTP (uses connection pool)
 */
async function deleteFileFromFTP(remotePath) {
  try {
    return await deleteFileFromFTPPooled(remotePath);
  } catch (error) {
    console.error("❌ FTP deletion failed:", error);
    throw new Error(`FTP deletion failed: ${error.message}`);
  }
}

/**
 * Check if file exists on FTP (uses connection pool)
 */
async function checkFileExistsOnFTP(remotePath) {
  try {
    return await checkFileExistsOnFTPPooled(remotePath);
  } catch (error) {
    return { exists: false };
  }
}

/**
 * Download file from FTP (uses connection pool)
 */
async function downloadFileFromFTP(remotePath) {
  try {
    console.log("🔌 Using pooled FTP connection for download...");
    return await downloadFileFromFTPPooled(remotePath);
  } catch (error) {
    console.error("❌ FTP download failed:", error);
    throw new Error(`FTP download failed: ${error.message}`);
  }
}

module.exports = {
  uploadFileToFTP,
  deleteFileFromFTP,
  checkFileExistsOnFTP,
  downloadFileFromFTP,
};
