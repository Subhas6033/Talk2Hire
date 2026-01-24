const { uploadFileMicro } = require("./uploadFile.controllers.js");
const { readFileFromUrlWithMistral } = require("./mistral.controllers.js");
const { asyncHandler } = require("../Utils/index.utils.js");

const uploadAndProcessFile = asyncHandler(async (req, res, next) => {
  try {
    // Upload file and get FTP info
    const uploadedData = await uploadFileMicro(req.file);
    console.log("Uploaded FTP URL:", uploadedData.url);

    // Prepare request for Mistral
    const mistralReq = {
      body: {
        ftpUrl: uploadedData.url,
        mimeType: req.file.mimetype,
        originalFileName: req.file.originalname,
      },
    };

    // Call Mistral micro-function
    await readFileFromUrlWithMistral(mistralReq, res, next);
  } catch (error) {
    console.error("❌ Combined Controller Error:", error);
    next(error);
  }
});

module.exports = { uploadAndProcessFile };
