const bcryptjs = require('bcryptjs');
const crypto = require('crypto');

const HARDCODED_OTP = '123456';

/**
 * Hardcoded OTP is opt-in for local/dev only.
 * - Requires OTP_HARDCODED=true
 * - Always disabled when NODE_ENV=production
 */
function isHardcodedOtpEnabled() {
    if (process.env.NODE_ENV === 'production') return false;
    return process.env.OTP_HARDCODED === 'true';
}

const useHardcodedOtp = isHardcodedOtpEnabled();

function generateOtp() {
    if (useHardcodedOtp) {
        return HARDCODED_OTP;
    }
    return String(crypto.randomInt(100000, 999999));
}

async function hashOtp(otp) {
    const salt = await bcryptjs.genSalt(10);
    return bcryptjs.hash(otp, salt);
}

async function verifyOtp(otp, otpHash) {
    if (!otp || !otpHash) return false;
    if (useHardcodedOtp && String(otp) === HARDCODED_OTP) {
        return true;
    }
    return bcryptjs.compare(String(otp), otpHash);
}

module.exports = {
    HARDCODED_OTP,
    useHardcodedOtp,
    isHardcodedOtpEnabled,
    generateOtp,
    hashOtp,
    verifyOtp
};
