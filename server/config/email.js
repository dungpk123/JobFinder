const nodemailer = require('nodemailer');

// Hỗ trợ 2 cách cấu hình Gmail:
// 1) OAuth2 (không cần bật 2FA/App Password) với CLIENT_ID/SECRET + REFRESH_TOKEN
// 2) App Password (yêu cầu bật 2FA) với EMAIL_USER/EMAIL_PASSWORD

const toPositiveMs = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
};

const asTrimmed = (value) => String(value || '').trim();
const normalizeAppPassword = (value) => asTrimmed(value).replace(/\s+/g, '');
const toBoolean = (value, fallback) => {
    const normalized = asTrimmed(value).toLowerCase();
    if (!normalized) return fallback;
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
};

const EMAIL_USER = asTrimmed(process.env.EMAIL_USER);
const EMAIL_PASSWORD = normalizeAppPassword(process.env.EMAIL_PASSWORD);
const EMAIL_FROM = asTrimmed(process.env.EMAIL_FROM) || EMAIL_USER;
const EMAIL_PROVIDER_RAW = asTrimmed(process.env.EMAIL_PROVIDER).toLowerCase() || 'smtp';
const EMAIL_PROVIDER = ['smtp', 'resend', 'gmail_api'].includes(EMAIL_PROVIDER_RAW)
    ? EMAIL_PROVIDER_RAW
    : 'smtp';
const RESEND_API_KEY = asTrimmed(process.env.RESEND_API_KEY);

const EMAIL_OAUTH_CLIENT_ID = asTrimmed(process.env.EMAIL_OAUTH_CLIENT_ID);
const EMAIL_OAUTH_CLIENT_SECRET = asTrimmed(process.env.EMAIL_OAUTH_CLIENT_SECRET);
const EMAIL_OAUTH_REFRESH_TOKEN = asTrimmed(process.env.EMAIL_OAUTH_REFRESH_TOKEN);

const EMAIL_SMTP_HOST = asTrimmed(process.env.EMAIL_SMTP_HOST) || 'smtp.gmail.com';
const EMAIL_SMTP_PORT = toPositiveMs(process.env.EMAIL_SMTP_PORT, 587);
const EMAIL_SMTP_SECURE = toBoolean(process.env.EMAIL_SMTP_SECURE, EMAIL_SMTP_PORT === 465);
const EMAIL_SMTP_REQUIRE_TLS = toBoolean(process.env.EMAIL_SMTP_REQUIRE_TLS, !EMAIL_SMTP_SECURE);

const DEFAULT_MAIL_TIMEOUT_MS = process.env.NODE_ENV === 'production' ? 45000 : 15000;
const MAIL_TIMEOUT_MS = toPositiveMs(process.env.EMAIL_TIMEOUT_MS, DEFAULT_MAIL_TIMEOUT_MS);

const useOAuth2 = Boolean(
    EMAIL_OAUTH_CLIENT_ID &&
    EMAIL_OAUTH_CLIENT_SECRET &&
    EMAIL_OAUTH_REFRESH_TOKEN &&
    EMAIL_USER
);
const hasAppPassword = Boolean(EMAIL_USER && EMAIL_PASSWORD);
const isResendProvider = EMAIL_PROVIDER === 'resend';
const isGmailApiProvider = EMAIL_PROVIDER === 'gmail_api';
const isSmtpProvider = EMAIL_PROVIDER === 'smtp';

const useResendApi = isResendProvider && Boolean(RESEND_API_KEY);
const useGmailApi = isGmailApiProvider && useOAuth2;

let transporter;
let fetchOAuthAccessToken = null;
let gmailApiClient = null;

const getFetch = async () => {
    if (typeof fetch === 'function') {
        return fetch;
    }

    try {
        const mod = await import('node-fetch');
        return mod.default;
    } catch {
        return null;
    }
};

const parseErrorMessage = async (response) => {
    const fallback = `Email provider responded with status ${response.status}`;
    try {
        const payload = await response.json();
        return payload?.message || payload?.error || fallback;
    } catch {
        try {
            const text = await response.text();
            return text || fallback;
        } catch {
            return fallback;
        }
    }
};

const encodeHeader = (value) => `=?UTF-8?B?${Buffer.from(String(value || ''), 'utf8').toString('base64')}?=`;

const encodeBase64Url = (value) => Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const htmlToText = (html) => String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

const buildMimeMessage = ({ from, to, subject, html }) => {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const text = htmlToText(html);

    return [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${encodeHeader(subject)}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        text,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        html,
        '',
        `--${boundary}--`,
        ''
    ].join('\r\n');
};

const sendMailViaGmailApi = async ({ to, subject, html }) => {
    if (!gmailApiClient) {
        throw new Error('Gmail API client is not configured');
    }

    const mimeMessage = buildMimeMessage({ from: EMAIL_FROM, to, subject, html });
    const raw = encodeBase64Url(mimeMessage);

    await gmailApiClient.users.messages.send({
        userId: 'me',
        requestBody: { raw },
    });
};

const sendMailViaResend = async ({ to, subject, html }) => {
    const fetchImpl = await getFetch();
    if (!fetchImpl) {
        throw new Error('Fetch API is not available for Resend provider');
    }

    const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: EMAIL_FROM,
            to: [to],
            subject,
            html,
        }),
    });

    if (!response.ok) {
        const errorMessage = await parseErrorMessage(response);
        throw new Error(errorMessage);
    }

    return response.json().catch(() => ({}));
};

const createTransport = (auth) => nodemailer.createTransport({
    host: EMAIL_SMTP_HOST,
    port: EMAIL_SMTP_PORT,
    secure: EMAIL_SMTP_SECURE,
    requireTLS: EMAIL_SMTP_REQUIRE_TLS,
    auth,
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
    dnsTimeout: Math.min(MAIL_TIMEOUT_MS, 15000),
    tls: {
        servername: EMAIL_SMTP_HOST,
    },
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

if ((isSmtpProvider || isGmailApiProvider) && useOAuth2) {
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
            EMAIL_OAUTH_CLIENT_ID,
            EMAIL_OAUTH_CLIENT_SECRET
        );
        oAuth2Client.setCredentials({ refresh_token: EMAIL_OAUTH_REFRESH_TOKEN });

        if (useGmailApi) {
            gmailApiClient = google.gmail({
                version: 'v1',
                auth: oAuth2Client,
            });
        }

        if (isSmtpProvider) {
            // Tạo transporter động để luôn có accessToken mới
            transporter = createTransport({
                type: 'OAuth2',
                user: EMAIL_USER,
                clientId: EMAIL_OAUTH_CLIENT_ID,
                clientSecret: EMAIL_OAUTH_CLIENT_SECRET,
                refreshToken: EMAIL_OAUTH_REFRESH_TOKEN,
            });

            // Thêm hàm helper để lấy access token trước khi gửi (đảm bảo token mới)
            fetchOAuthAccessToken = async () => {
                const accessToken = await oAuth2Client.getAccessToken();
                return accessToken?.token || accessToken;
            };
        }
    }
}

if (isSmtpProvider && !transporter && hasAppPassword) {
    // Fallback: App Password
    transporter = createTransport({
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
    });
}

if (EMAIL_PROVIDER !== EMAIL_PROVIDER_RAW) {
    console.warn(`[email] EMAIL_PROVIDER="${EMAIL_PROVIDER_RAW}" không hợp lệ. Fallback về "smtp".`);
}

if (useResendApi) {
    console.info('[email] Resend API provider is enabled.');
} else if (isResendProvider) {
    console.warn('[email] EMAIL_PROVIDER=resend nhưng thiếu RESEND_API_KEY.');
} else if (useGmailApi) {
    console.info('[email] Gmail API provider is enabled.');
} else if (isGmailApiProvider) {
    console.warn('[email] EMAIL_PROVIDER=gmail_api nhưng thiếu OAuth2 config.');
} else if (transporter) {
    console.info(`[email] SMTP ready host=${EMAIL_SMTP_HOST} port=${EMAIL_SMTP_PORT} secure=${EMAIL_SMTP_SECURE} requireTLS=${EMAIL_SMTP_REQUIRE_TLS}`);
} else {
    console.warn('[email] SMTP provider chưa có cấu hình hợp lệ.');
}

// Hàm tạo mã OTP 6 số
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Hàm gửi email xác thực
async function sendVerificationEmail(email, otp, userName) {
    const mailOptions = {
        from: EMAIL_FROM,
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
        if (isResendProvider) {
            if (!useResendApi) {
                return { success: false, error: 'Resend provider is not configured' };
            }

            await withTimeout(
                () => sendMailViaResend({ to: email, subject: mailOptions.subject, html: mailOptions.html }),
                'Send verification email'
            );
            return { success: true };
        }

        if (isGmailApiProvider) {
            if (!useGmailApi) {
                return { success: false, error: 'Gmail API provider is not configured' };
            }

            await withTimeout(
                () => sendMailViaGmailApi({ to: email, subject: mailOptions.subject, html: mailOptions.html }),
                'Send verification email'
            );
            return { success: true };
        }

        if (!transporter) {
            return { success: false, error: 'SMTP transporter is not configured' };
        }

        // Nếu dùng OAuth2, đảm bảo có accessToken mới
        if (typeof fetchOAuthAccessToken === 'function') {
            const accessToken = await withTimeout(() => fetchOAuthAccessToken(), 'Get OAuth access token');
            if (accessToken) {
                mailOptions.auth = {
                    type: 'OAuth2',
                    user: EMAIL_USER,
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
