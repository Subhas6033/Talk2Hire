const { uploadFileToFTP } = require("../Upload/uploadOnFTP");
const { asyncHandler, APIRES } = require("../Utils/index.utils");

const uploadFile = asyncHandler(async (req, res) => {
  const file = req.file;

  if (!file) {
    throw new Error("No file uploaded");
  }
  //   if any file size is greater than 5MB then, it will not upload the file on FTP
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File too large (max 5MB)");
  }

  const allowedTypes = ["image/png", "image/jpeg", "application/pdf"];
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error("Invalid file type");
  }

  const result = await uploadFileToFTP(
    file.buffer,
    file.originalname,
    "/public"
  );

  console.log("Uploaded file URL : ", result.url);

  res.status(200).json(
    new APIRES({
      message: "File uploaded successfully",
      data: result,
    })
  );
});

module.exports = uploadFile;
