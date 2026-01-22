class APIRES {
  constructor(statusCode = 200, message = "Request successful", data = {}) {
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}

module.exports = APIRES;
