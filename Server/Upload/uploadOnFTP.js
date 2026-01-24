const ftp = require("basic-ftp");
const path = require("path");

async function uploadFileToFTP(fileBuffer, originalName) {
  const client = new ftp.Client();
  client.ftp.timeout = 60000;

  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: Number(process.env.FTP_PORT),
      secure: false,
    });

    const remoteDir = process.env.FTP_REMOTE_DIR; // /public

    console.log("🗂 Ensuring directory:", remoteDir);
    await client.ensureDir(remoteDir);

    const fileName = `${Date.now()}-${originalName}`;

    const { PassThrough } = require("stream");
    const source = new PassThrough();
    source.end(fileBuffer);

    await client.uploadFrom(source, fileName);

    // REAL FTP PATH (for debug)
    const remotePath = `${remoteDir}/${fileName}`;

    // ✅ Build correct public URL
    const fileUrl = `${process.env.FTP_BASE_URL}/artlabss.com/interview2${remotePath}`;

    console.log("✅ FTP PATH:", remotePath);
    console.log("✅ FILE URL:", fileUrl);

    return {
      success: true,
      fileName,
      remotePath,
      url: fileUrl,
    };
  } finally {
    client.close();
  }
}

module.exports = { uploadFileToFTP };
