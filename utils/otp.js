const crypto = require('crypto');
const bcryptjs = require('bcryptjs');

function generateOtp() {
    return String(crypto.randomInt(100000, 999999));
}

async function hashOtp(otp) {
    const salt = await bcryptjs.genSalt(10);
    return bcryptjs.hash(otp, salt);
}

async function verifyOtp(otp, otpHash) {
    if (!otp || !otpHash) return false;
    return bcryptjs.compare(String(otp), otpHash);
}

module.exports = {
    generateOtp,
    hashOtp,
    verifyOtp
};
