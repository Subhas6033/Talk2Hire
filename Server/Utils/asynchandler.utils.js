const asyncHandler = (requestHandler) => async (req, res, next) => {
  try {
    await requestHandler(req, res, next);
  } catch (error) {
    console.log("Error caught in async handler:", error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
    next(error);
  }
};

module.exports = asyncHandler;
