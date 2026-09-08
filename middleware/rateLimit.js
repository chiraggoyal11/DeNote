const rateLimit = require('express-rate-limit');

// In-memory store — fine for a single free-tier Render instance ($0/mo).
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        msg: 'Too many requests. Please try again later.'
    }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        msg: 'Too many auth attempts. Please try again in a few minutes.'
    }
});

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        msg: 'Too many OTP requests. Please try again later.'
    }
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        msg: 'Upload limit reached. Please try again later.'
    }
});

module.exports = {
    generalLimiter,
    authLimiter,
    otpLimiter,
    uploadLimiter
};
