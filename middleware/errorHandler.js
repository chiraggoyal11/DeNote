const multer = require('multer');
const AppError = require('../utils/AppError');

function notFoundHandler(req, res, next) {
    next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

function errorHandler(err, req, res, next) {
    let statusCode = err.statusCode || 500;
    let msg = err.message || 'Internal server error';

    if (err instanceof multer.MulterError) {
        statusCode = 400;
        if (err.code === 'LIMIT_FILE_SIZE') {
            msg = 'File too large. Maximum upload size is 15MB.';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            msg = 'Unexpected file field.';
        } else {
            msg = err.message || 'Upload error.';
        }
    } else if (err.message === 'Only PDF files are allowed') {
        statusCode = 400;
        msg = err.message;
    } else if (err.message === 'Not allowed by CORS') {
        statusCode = 403;
        msg = 'Not allowed by CORS';
    }

    if (statusCode >= 500) {
        console.error('[error]', err);
    }

    const body = {
        success: false,
        msg,
        ...(err.extras && typeof err.extras === 'object' ? err.extras : {})
    };

    if (process.env.NODE_ENV !== 'production' && statusCode >= 500 && err.stack) {
        body.stack = err.stack;
    }

    res.status(statusCode).json(body);
}

module.exports = {
    notFoundHandler,
    errorHandler
};
