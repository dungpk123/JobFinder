const nodemailer = require('nodemailer');

// Hỗ trợ 2 cách cấu hình Gmail:
// 1) OAuth2 (không cần bật 2FA/App Password) với CLIENT_ID/SECRET + REFRESH_TOKEN
// 2) App Password (yêu cầu bật 2FA) với EMAIL_USER/EMAIL_PASSWORD

const toPositiveMs = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
};

const DEFAULT_MAIL_TIMEOUT_MS = process.env.NODE_ENV === 'production' ? 45000 : 15000;
const MAIL_TIMEOUT_MS = toPositiveMs(process.env.EMAIL_TIMEOUT_MS, DEFAULT_MAIL_TIMEOUT_MS);

let useOAuth2 = Boolean(
    process.env.EMAIL_OAUTH_CLIENT_ID &&
    process.env.EMAIL_OAUTH_CLIENT_SECRET &&
    process.env.EMAIL_OAUTH_REFRESH_TOKEN &&
    process.env.EMAIL_USER
);
const hasAppPassword = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);

let transporter;
let fetchOAuthAccessToken = null;

const createTransport = (auth) => nodemailer.createTransport({
    service: 'gmail',
    auth,
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
});

const withTimeout = (promiseFactory, label) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${MAIL_TIMEOUT_MS}ms`)), MAIL_TIMEOUT_MS);
    Promise.resolve()
        .then(promiseFactory)
        .then((result) => {
            clearTimeout(timer);
            resolve(result);
        })
        .catch((err) => {
            clearTimeout(timer);
            reject(err);
        });
});

if (useOAuth2) {
    // Dùng OAuth2 (không cần 2FA). Cần cài package googleapis: npm i googleapis
    let googleapis;
    try {
        googleapis = require('googleapis');
    } catch (e) {
        console.warn('googleapis chưa được cài. Chạy: npm install googleapis. Tạm thời fallback sang USER/PASS nếu có.');
    }

    if (googleapis) {
        const { google } = googleapis;
        const oAuth2Client = new google.auth.OAuth2(
            process.env.EMAIL_OAUTH_CLIENT_ID,
            process.env.EMAIL_OAUTH_CLIENT_SECRET
        );
        oAuth2Client.setCredentials({ refresh_token: process.env.EMAIL_OAUTH_REFRESH_TOKEN });

        // Tạo transporter động để luôn có accessToken mới
        transporter = createTransport({
            type: 'OAuth2',
            user: process.env.EMAIL_USER,
            clientId: process.env.EMAIL_OAUTH_CLIENT_ID,
            clientSecret: process.env.EMAIL_OAUTH_CLIENT_SECRET,
            refreshToken: process.env.EMAIL_OAUTH_REFRESH_TOKEN,
        });

        // Thêm hàm helper để lấy access token trước khi gửi (đảm bảo token mới)
        fetchOAuthAccessToken = async () => {
            const accessToken = await oAuth2Client.getAccessToken();
            return accessToken?.token || accessToken;
        };
    }
}

if (!transporter && hasAppPassword) {
    // Fallback: App Password
    transporter = createTransport({
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    });
}

if (!transporter) {
    console.warn('[email] EMAIL_USER/EMAIL_PASSWORD (hoặc OAuth2) chưa cấu hình. OTP email sẽ không gửi được.');
}

// Hàm tạo mã OTP 6 số
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hàm gửi email xác thực
async function sendVerificationEmail(email, otp, userName) {
    if (!transporter) {
        return { success: false, error: 'Email transporter is not configured' };
    }

    const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: email,
        subject: 'Xác thực tài khoản JobFinder',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0d6efd;">Xác thực tài khoản JobFinder</h2>
                <p>Xin chào <strong>${userName}</strong>,</p>
                <p>Cảm ơn bạn đã đăng ký tài khoản tại JobFinder. Vui lòng sử dụng mã xác thực bên dưới để hoàn tất đăng ký:</p>
                <div style="background-color: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                    <h1 style="color: #0d6efd; font-size: 36px; letter-spacing: 5px; margin: 0;">${otp}</h1>
                </div>
                <p>Mã xác thực có hiệu lực trong <strong>10 phút</strong>.</p>
                <p>Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email này.</p>
                <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
                <p style="color: #6c757d; font-size: 12px;">
                    Email này được gửi tự động, vui lòng không trả lời.<br>
                    © 2025 JobFinder. All rights reserved.
                </p>
            </div>
        `
    };

    try {
        // Nếu dùng OAuth2, đảm bảo có accessToken mới
        if (typeof fetchOAuthAccessToken === 'function') {
            const accessToken = await withTimeout(() => fetchOAuthAccessToken(), 'Get OAuth access token');
            if (accessToken) {
                mailOptions.auth = {
                    type: 'OAuth2',
                    user: process.env.EMAIL_USER,
                    accessToken,
                };
            }
        }
        await withTimeout(() => transporter.sendMail(mailOptions), 'Send verification email');
        return { success: true };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    generateOTP,
    sendVerificationEmail
};
