const nodemailer = require('nodemailer');
const axios = require('axios');

async function sendEmailOtp(email, otp) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        console.log(`[OTP] Email to ${email}: ${otp} (SMTP not configured — logged for development)`);
        return { delivered: false, channel: 'console' };
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT || 587),
        secure: String(SMTP_PORT) === '465',
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });

    await transporter.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to: email,
        subject: 'DeNote password reset OTP',
        text: `Your DeNote password reset code is ${otp}. It expires in 10 minutes.`,
        html: `<p>Your DeNote password reset code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`
    });

    return { delivered: true, channel: 'email' };
}

async function sendSmsOtp(phone, otp) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
        console.log(`[OTP] SMS to ${phone}: ${otp} (Twilio not configured — logged for development)`);
        return { delivered: false, channel: 'console' };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({
        To: phone,
        From: TWILIO_FROM_NUMBER,
        Body: `Your DeNote password reset code is ${otp}. It expires in 10 minutes.`
    });

    await axios.post(url, params.toString(), {
        auth: {
            username: TWILIO_ACCOUNT_SID,
            password: TWILIO_AUTH_TOKEN
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return { delivered: true, channel: 'sms' };
}

module.exports = {
    sendEmailOtp,
    sendSmsOtp
};
