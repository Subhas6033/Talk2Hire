class APIERR extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.data = undefined;
    this.name = "APIERR";
  }
}

class APIRES {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    // Guard: never write to a response that's already been sent
    if (res.headersSent) return;

    const statusCode = err instanceof APIERR ? err.statusCode : 500;
    const message =
      err instanceof APIERR ? err.message : "Internal server error";

    console.error(
      `❌ [${req.headers["x-request-id"] ?? Date.now()}] Unhandled error:`,
      err,
    );

    return res.status(statusCode).json({
      success: false,
      statusCode,
      message,
      data: null,
    });
  }
};

module.exports = { asyncHandler, APIERR, APIRES };
