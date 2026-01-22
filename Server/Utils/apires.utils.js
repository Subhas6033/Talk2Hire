class APIRES {
  constructor(message = "Request successful", statusCode = 200, data = {}) {
    this.message = message;
    this.statusCode = statusCode;
    this.data = data;
  }
}

module.exports = APIRES;
