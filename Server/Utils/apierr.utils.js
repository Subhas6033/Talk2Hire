class APIERR extends Error {
  constructor(statusCode, message = "Something went wrong", stack, data) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = APIERR;
