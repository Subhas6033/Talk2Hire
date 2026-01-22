class APIERR extends Error {
  constructor(message = "Something went wrong", statusCode, stack, data) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = APIERR;
