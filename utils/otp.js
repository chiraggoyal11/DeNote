const bcryptjs = require('bcryptjs');

// Temporary hardcoded OTP until SendGrid/Twilio are wired up.
// Set OTP_HARDCODED=false later and restore random generation + real delivery.
const HARDCODED_OTP = '123456';
const useHardcodedOtp = process.env.OTP_HARDCODED !== 'false';

function generateOtp() {
    if (useHardcodedOtp) {
        return HARDCODED_OTP;
    }
    const crypto = require('crypto');
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
    generateOtp,
    hashOtp,
    verifyOtp
};
