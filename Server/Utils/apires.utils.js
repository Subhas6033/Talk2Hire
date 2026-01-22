class APIRES {
  constructor(statusCode = 200, data = {}, message = "Request successful") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
  }
}

module.exports = APIRES;
