class AppError extends Error {
    constructor(message, statusCode = 500, extras = {}) {
        super(message);
        this.statusCode = statusCode;
        this.status = String(statusCode).startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.extras = extras;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
