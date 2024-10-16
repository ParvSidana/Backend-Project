class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something Something not Working",
    errors = [],
    stack = ""
  ) {
    super(message); // call parent class constructor
    this.statusCode = statusCode;
    this.errors = errors;
    this.message = message;
    // this.stack = stack;
    this.data = null;
    this.success = false;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
export { ApiError };
