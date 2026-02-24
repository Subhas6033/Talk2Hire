const { uploadFileToFTP } = require("../Upload/uploadOnFTP");
const { asyncHandler, APIRES } = require("../Utils/index.utils");

// Micro-function for internal use
const uploadFileMicro = async (file, remoteDir = "/public") => {
  if (!file) throw new Error("No file uploaded");
  if (file.size > 5 * 1024 * 1024) throw new Error("File too large (max 5MB)");

  const allowedTypes = ["image/png", "image/jpeg", "application/pdf"];
  if (!allowedTypes.includes(file.mimetype))
    throw new Error("Invalid file type");

  const result = await uploadFileToFTP(
    file.buffer,
    file.originalname,
    remoteDir,
  );
  console.log(" FTP uploaded URL:", result.url);
  return result; // <-- this returns the FTP URL and file info
};

// Original controller for individual file uploads
const uploadFile = asyncHandler(async (req, res) => {
  const result = await uploadFileMicro(req.file); // reuse micro-function
  res.status(200).json(
    new APIRES(200, {
      message: "File uploaded successfully",
      data: result,
    }),
  );
});

module.exports = { uploadFile, uploadFileMicro };
