const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/db');
const { generateOTP, sendVerificationEmail } = require('../config/email');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Build absolute URL for stored relative paths (e.g., /images/avatars/xxx.png)
const BASE_PATH = (() => {
    const basePath = process.env.BASE_PATH || '/';
    let normalized = basePath;
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
})();
const PUBLIC_PREFIX = BASE_PATH === '/' ? '' : BASE_PATH;
const buildAbsoluteUrl = (req, relativePath) => (relativePath ? `${req.protocol}://${req.get('host')}${relativePath}` : '');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';
const ROLE_CANDIDATE = 'Ứng viên';
const ROLE_EMPLOYER = 'Nhà tuyển dụng';
const ROLE_ADMIN = 'Quản trị';
const ROLE_SUPER_ADMIN = 'Siêu quản trị viên';
const ROLE_PENDING = 'Chưa chọn vai trò';

const isTemplateGoogleClientId = (value) => /^(your_|react_app_|vite_|next_public_)/i.test(value);

const GOOGLE_AUDIENCE_ENV_KEYS = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_IDS',
    'GOOGLE_OAUTH_CLIENT_ID',
    'REACT_APP_GOOGLE_CLIENT_ID',
    'REACT_APP_GOOGLE_OAUTH_CLIENT_ID',
    'VITE_GOOGLE_CLIENT_ID',
    'EMAIL_OAUTH_CLIENT_ID'
];

const GOOGLE_AUDIENCES = Array.from(
    new Set(
        GOOGLE_AUDIENCE_ENV_KEYS
            .flatMap((key) => String(process.env[key] || '').split(','))
            .map((value) => value.trim())
            .filter((value) => value && !isTemplateGoogleClientId(value))
    )
);
const googleOAuthClient = new OAuth2Client();

const PENDING_REGISTRATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS DangKyTam (
    Email VARCHAR(191) PRIMARY KEY,
    MatKhau VARCHAR(255) NOT NULL,
    VaiTro VARCHAR(50) NOT NULL DEFAULT 'Chưa chọn vai trò',
    HoTen VARCHAR(255) NULL,
    SoDienThoai VARCHAR(50) NULL,
    DiaChi TEXT NULL,
    NgaySinh DATE NULL,
    GioiTinh VARCHAR(20) NULL,
    TenCongTy VARCHAR(255) NULL,
    MaSoThue VARCHAR(100) NULL,
    MaXacThuc VARCHAR(20) NOT NULL,
    ThoiGianMaXacThuc DATETIME NOT NULL,
    NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

const dbGetAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row || null);
    });
});

const dbRunAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({
            lastID: this?.lastID || 0,
            changes: this?.changes || 0
        });
    });
});

const getUserWithAvatarByEmail = async (email) => {
    return dbGetAsync(
        `SELECT nd.*, COALESCE(hsv.AnhDaiDien, ntd.Logo, ct.Logo) AS avatar
         FROM NguoiDung nd
         LEFT JOIN HoSoUngVien hsv ON hsv.MaNguoiDung = nd.MaNguoiDung
         LEFT JOIN NhaTuyenDung ntd ON ntd.MaNguoiDung = nd.MaNguoiDung
         LEFT JOIN CongTy ct ON ct.NguoiDaiDien = nd.MaNguoiDung
         WHERE lower(nd.Email) = lower(?)`,
        [normalizeEmail(email)]
    );
};

const getUserWithAvatarById = async (userId) => {
    return dbGetAsync(
        `SELECT nd.*, COALESCE(hsv.AnhDaiDien, ntd.Logo, ct.Logo) AS avatar
         FROM NguoiDung nd
         LEFT JOIN HoSoUngVien hsv ON hsv.MaNguoiDung = nd.MaNguoiDung
         LEFT JOIN NhaTuyenDung ntd ON ntd.MaNguoiDung = nd.MaNguoiDung
         LEFT JOIN CongTy ct ON ct.NguoiDaiDien = nd.MaNguoiDung
         WHERE nd.MaNguoiDung = ?`,
        [userId]
    );
};

const normalizeRoleInput = (value, fallback = ROLE_PENDING) => {
    const raw = String(value || '').trim();
    const normalized = raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (!normalized) return fallback;
    if (normalized === 'ung vien' || normalized === 'ungvien') return ROLE_CANDIDATE;
    if (normalized === 'nha tuyen dung' || normalized === 'nhatuyendung') return ROLE_EMPLOYER;
    if (normalized === 'quan tri' || normalized === 'quantri') return ROLE_ADMIN;
    if (normalized === 'sieu quan tri vien' || normalized === 'sieuquantrivien') return ROLE_SUPER_ADMIN;
    if (
        normalized === 'chua chon vai tro'
        || normalized === 'chuachonvaitro'
        || normalized === 'pending'
        || normalized === 'none'
    ) {
        return ROLE_PENDING;
    }

    return raw || fallback;
};

const isPendingRole = (role) => normalizeRoleInput(role, ROLE_PENDING) === ROLE_PENDING;

const buildLoginResponse = (req, user) => {
    const avatarRelative = user.avatar || '';
    const normalizedAvatar = avatarRelative
        ? `${PUBLIC_PREFIX}${avatarRelative.startsWith('/') ? '' : '/'}${avatarRelative.replace(/^\/+/, '')}`
        : '';
    const avatarAbsolute = buildAbsoluteUrl(req, normalizedAvatar);

    const isSuperAdmin = !!(user.IsSuperAdmin || user.isSuperAdmin);
    const normalizedRole = normalizeRoleInput(user.VaiTro, ROLE_PENDING);
    const roleLabel = isSuperAdmin ? ROLE_SUPER_ADMIN : normalizedRole;
    const needsOnboarding = !isSuperAdmin && normalizedRole === ROLE_PENDING;
    const token = jwt.sign({ id: user.MaNguoiDung, role: roleLabel, isSuperAdmin }, JWT_SECRET, { expiresIn: '1h' });

    return {
        token,
        needsOnboarding,
        nextStep: needsOnboarding ? '/onboarding/role' : null,
        user: {
            id: user.MaNguoiDung,
            email: user.Email,
            role: roleLabel,
            name: user.HoTen,
            isSuperAdmin,
            needsOnboarding,
            avatar: avatarAbsolute || normalizedAvatar || '',
            avatarUrl: normalizedAvatar,
            avatarAbsoluteUrl: avatarAbsolute,
            AnhDaiDien: normalizedAvatar
        }
    };
};

const verifyGoogleCredential = async (credential) => {
    if (!GOOGLE_AUDIENCES.length) {
        throw new Error('Google login chưa được cấu hình trên máy chủ.');
    }

    if (!credential || typeof credential !== 'string') {
        throw new Error('Thiếu credential từ Google.');
    }

    const ticket = await googleOAuthClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_AUDIENCES
    });

    const payload = ticket.getPayload() || {};

    if (!payload.email) {
        throw new Error('Không lấy được email từ tài khoản Google.');
    }

    if (payload.email_verified === false) {
        throw new Error('Email Google chưa được xác thực.');
    }

    return payload;
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const isUniqueConstraintError = (err) => {
    const msg = String(err?.message || '').toLowerCase();
    return msg.includes('unique constraint failed')
        || msg.includes('duplicate entry')
        || msg.includes('er_dup_entry');
};

const isUnknownColumnError = (err) => {
    const msg = String(err?.message || '').toLowerCase();
    return msg.includes('unknown column') || msg.includes('no such column');
};

const passwordStrengthError = (password) => {
    if (!password || password.length < 8) {
        return 'Mật khẩu phải có ít nhất 8 ký tự';
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
        return 'Mật khẩu phải bao gồm cả chữ và số';
    }

    return null;
};

const parseBooleanEnv = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return false;
    return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const shouldExposeOtpInResponse = process.env.NODE_ENV !== 'production'
    || parseBooleanEnv(process.env.EXPOSE_OTP_IN_RESPONSE);

let ensurePendingRegistrationTablePromise = null;
let ensurePendingRegistrationColumnsPromise = null;
const ensurePendingRegistrationColumns = async () => {
    if (!ensurePendingRegistrationColumnsPromise) {
        const alterQueries = [
            'ALTER TABLE DangKyTam ADD COLUMN NgaySinh DATE NULL',
            'ALTER TABLE DangKyTam ADD COLUMN GioiTinh VARCHAR(20) NULL'
        ];

        ensurePendingRegistrationColumnsPromise = (async () => {
            for (const query of alterQueries) {
                try {
                    await dbRunAsync(query);
                } catch (err) {
                    const message = String(err?.message || '').toLowerCase();
                    if (!message.includes('duplicate column')) {
                        throw err;
                    }
                }
            }
        })().catch((err) => {
            ensurePendingRegistrationColumnsPromise = null;
            throw err;
        });
    }

    return ensurePendingRegistrationColumnsPromise;
};

const ensurePendingRegistrationTable = async () => {
    if (!ensurePendingRegistrationTablePromise) {
        ensurePendingRegistrationTablePromise = (async () => {
            await dbRunAsync(PENDING_REGISTRATION_TABLE_SQL);
            await ensurePendingRegistrationColumns();
        })().catch((err) => {
            ensurePendingRegistrationTablePromise = null;
            throw err;
        });
    }

    return ensurePendingRegistrationTablePromise;
};

const cleanupUnverifiedUserById = async (userId) => {
    if (!userId) return;

    await dbRunAsync('DELETE FROM CongTy WHERE NguoiDaiDien = ?', [userId]);
    await dbRunAsync('DELETE FROM NhaTuyenDung WHERE MaNguoiDung = ?', [userId]);
    await dbRunAsync('DELETE FROM NguoiDung WHERE MaNguoiDung = ? AND IFNULL(TrangThai, 0) <> 1', [userId]);
};

const buildRegistrationResponse = ({ email, otp, extra = {} }) => {
    const payload = {
        message: 'Vui lòng kiểm tra email để lấy mã xác thực',
        email,
        requireVerification: true,
        ...extra
    };

    if (shouldExposeOtpInResponse) {
        payload.otp = otp;
    }

    return payload;
};

const savePendingRegistration = async ({
    email,
    passwordHash,
    role,
    name,
    phone,
    address,
    birthday,
    gender,
    companyName,
    taxCode,
    otp,
    otpExpiry
}) => {
    await ensurePendingRegistrationTable();

    await dbRunAsync(
        `INSERT OR REPLACE INTO DangKyTam
        (Email, MatKhau, VaiTro, HoTen, SoDienThoai, DiaChi, NgaySinh, GioiTinh, TenCongTy, MaSoThue, MaXacThuc, ThoiGianMaXacThuc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            email,
            passwordHash,
            role,
            name || null,
            phone || null,
            address || null,
            birthday || null,
            gender || null,
            companyName || null,
            taxCode || null,
            otp,
            otpExpiry
        ]
    );
};

const toNullableString = (value) => {
    const normalized = String(value || '').trim();
    return normalized ? normalized : null;
};

const toNullableDate = (value) => {
    const normalized = String(value || '').trim();
    return normalized ? normalized : null;
};

const toNullableInteger = (value, fallback = 0) => {
    if (value === null || typeof value === 'undefined' || value === '') return fallback;
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return parsed;
};

const toJsonArrayString = (value) => {
    if (Array.isArray(value)) {
        return JSON.stringify(value);
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? JSON.stringify(parsed) : '[]';
        } catch {
            return '[]';
        }
    }

    return '[]';
};

const updateBasicUserInfo = async ({ userId, fullName, phone, address, role }) => {
    const updates = [];
    const params = [];

    if (typeof fullName !== 'undefined') {
        updates.push('HoTen = ?');
        params.push(toNullableString(fullName));
    }

    if (typeof phone !== 'undefined') {
        updates.push('SoDienThoai = ?');
        params.push(toNullableString(phone));
    }

    if (typeof address !== 'undefined') {
        updates.push('DiaChi = ?');
        params.push(toNullableString(address));
    }

    if (typeof role !== 'undefined') {
        updates.push('VaiTro = ?');
        params.push(normalizeRoleInput(role, ROLE_PENDING));
    }

    if (!updates.length) {
        return;
    }

    updates.push('NgayCapNhat = CURRENT_TIMESTAMP');

    await dbRunAsync(
        `UPDATE NguoiDung SET ${updates.join(', ')} WHERE MaNguoiDung = ?`,
        [...params, userId]
    );
};

const ensureCandidateProfileWithJsonColumns = async ({
    userId,
    birthday,
    gender,
    address,
    city,
    district,
    intro,
    experienceYears,
    education,
    avatar,
    title,
    personalLink,
    educationList,
    workList,
    languageList
}, jsonColumns) => {
    const existing = await dbGetAsync('SELECT MaHoSo FROM HoSoUngVien WHERE MaNguoiDung = ?', [userId]);

    const profileParams = [
        toNullableDate(birthday),
        toNullableString(gender),
        toNullableString(address),
        toNullableString(city),
        toNullableString(district),
        toNullableString(intro),
        toNullableInteger(experienceYears, 0),
        toNullableString(education),
        toNullableString(avatar),
        toNullableString(title),
        toNullableString(personalLink),
        toJsonArrayString(educationList),
        toJsonArrayString(workList),
        toJsonArrayString(languageList)
    ];

    if (existing?.MaHoSo) {
        await dbRunAsync(
            `UPDATE HoSoUngVien
             SET NgaySinh = ?,
                 GioiTinh = ?,
                 DiaChi = ?,
                 ThanhPho = ?,
                 QuanHuyen = ?,
                 GioiThieuBanThan = ?,
                 SoNamKinhNghiem = ?,
                 TrinhDoHocVan = ?,
                 AnhDaiDien = ?,
                 ChucDanh = ?,
                 LinkCaNhan = ?,
                 ${jsonColumns.education} = ?,
                 ${jsonColumns.work} = ?,
                 ${jsonColumns.language} = ?,
                 NgayCapNhat = CURRENT_TIMESTAMP
             WHERE MaNguoiDung = ?`,
            [...profileParams, userId]
        );
        return;
    }

    await dbRunAsync(
        `INSERT INTO HoSoUngVien
        (MaNguoiDung, NgaySinh, GioiTinh, DiaChi, ThanhPho, QuanHuyen, GioiThieuBanThan, SoNamKinhNghiem, TrinhDoHocVan, AnhDaiDien, ChucDanh, LinkCaNhan, ${jsonColumns.education}, ${jsonColumns.work}, ${jsonColumns.language}, NgayTao, NgayCapNhat)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, ...profileParams]
    );
};

const ensureCandidateProfile = async (payload) => {
    const vietnameseColumns = {
        education: 'DanhSachHocVanJson',
        work: 'DanhSachKinhNghiemJson',
        language: 'DanhSachNgoaiNguJson'
    };

    try {
        await ensureCandidateProfileWithJsonColumns(payload, vietnameseColumns);
        return;
    } catch (err) {
        if (!isUnknownColumnError(err)) {
            throw err;
        }
    }

    const legacyColumns = {
        education: 'EducationListJson',
        work: 'WorkListJson',
        language: 'LanguageListJson'
    };

    await ensureCandidateProfileWithJsonColumns(payload, legacyColumns);
};

const ensureEmployerAndCompanyProfile = async ({
    userId,
    companyName,
    taxCode,
    website,
    address,
    city,
    description,
    logo,
    industry
}) => {
    const user = await dbGetAsync('SELECT HoTen, DiaChi FROM NguoiDung WHERE MaNguoiDung = ?', [userId]);
    const resolvedCompanyName = toNullableString(companyName) || toNullableString(user?.HoTen) || 'Doanh nghiệp';
    const resolvedAddress = toNullableString(address) || toNullableString(user?.DiaChi);

    const employer = await dbGetAsync('SELECT MaNhaTuyenDung FROM NhaTuyenDung WHERE MaNguoiDung = ?', [userId]);
    if (employer?.MaNhaTuyenDung) {
        await dbRunAsync(
            `UPDATE NhaTuyenDung
             SET TenCongTy = ?,
                 MaSoThue = ?,
                 Website = ?,
                 DiaChi = ?,
                 ThanhPho = ?,
                 MoTa = ?,
                 Logo = ?,
                 NgayCapNhat = CURRENT_TIMESTAMP
             WHERE MaNguoiDung = ?`,
            [
                resolvedCompanyName,
                toNullableString(taxCode),
                toNullableString(website),
                resolvedAddress,
                toNullableString(city),
                toNullableString(description),
                toNullableString(logo),
                userId
            ]
        );
    } else {
        await dbRunAsync(
            `INSERT INTO NhaTuyenDung
            (MaNguoiDung, TenCongTy, MaSoThue, Website, DiaChi, ThanhPho, MoTa, Logo, NgayTao, NgayCapNhat)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                userId,
                resolvedCompanyName,
                toNullableString(taxCode),
                toNullableString(website),
                resolvedAddress,
                toNullableString(city),
                toNullableString(description),
                toNullableString(logo)
            ]
        );
    }

    const company = await dbGetAsync(
        'SELECT MaCongTy FROM CongTy WHERE NguoiDaiDien = ? ORDER BY MaCongTy DESC LIMIT 1',
        [userId]
    );

    if (company?.MaCongTy) {
        await dbRunAsync(
            `UPDATE CongTy
             SET TenCongTy = ?,
                 MaSoThue = ?,
                 DiaChi = ?,
                 ThanhPho = ?,
                 Website = ?,
                 LinhVuc = ?,
                 MoTa = ?,
                 Logo = ?,
                 NgayCapNhat = CURRENT_TIMESTAMP
             WHERE MaCongTy = ?`,
            [
                resolvedCompanyName,
                toNullableString(taxCode),
                resolvedAddress,
                toNullableString(city),
                toNullableString(website),
                toNullableString(industry),
                toNullableString(description),
                toNullableString(logo),
                company.MaCongTy
            ]
        );
        return;
    }

    await dbRunAsync(
        `INSERT INTO CongTy
        (TenCongTy, MaSoThue, DiaChi, ThanhPho, Website, LinhVuc, MoTa, Logo, NguoiDaiDien, NgayTao, NgayCapNhat)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
            resolvedCompanyName,
            toNullableString(taxCode),
            resolvedAddress,
            toNullableString(city),
            toNullableString(website),
            toNullableString(industry),
            toNullableString(description),
            toNullableString(logo),
            userId
        ]
    );
};

const sendOtpToPendingRegistration = async ({ email, otp, userName }) => {
    const emailResult = await sendVerificationEmail(email, otp, userName || email);

    if (emailResult?.success) {
        return { success: true };
    }

    const reason = emailResult?.error || 'Không thể gửi email. Vui lòng thử lại.';
    return { success: false, error: reason };
};

const verifyLegacyUnverifiedUserOtp = async ({ email, otp }) => {
    const user = await dbGetAsync('SELECT * FROM NguoiDung WHERE lower(Email) = lower(?)', [email]);
    if (!user) {
        return { handled: false };
    }

    if (Number(user.TrangThai) === 1) {
        return { handled: true, status: 400, body: { error: 'Tài khoản đã được xác thực' } };
    }

    const now = new Date();
    const otpExpiry = user.ThoiGianMaXacThuc ? new Date(user.ThoiGianMaXacThuc) : null;
    if (!otpExpiry || Number.isNaN(otpExpiry.getTime()) || now > otpExpiry) {
        return { handled: true, status: 400, body: { error: 'Mã xác thực đã hết hạn. Vui lòng đăng ký lại.' } };
    }

    if (String(user.MaXacThuc || '') !== String(otp || '')) {
        return { handled: true, status: 400, body: { error: 'Mã xác thực không đúng' } };
    }

    await dbRunAsync(
        'UPDATE NguoiDung SET TrangThai = 1, MaXacThuc = NULL, ThoiGianMaXacThuc = NULL WHERE MaNguoiDung = ?',
        [user.MaNguoiDung]
    );

    return {
        handled: true,
        status: 200,
        body: {
            message: 'Xác thực thành công! Bạn có thể đăng nhập ngay.',
            success: true
        }
    };
};

const resendLegacyUnverifiedUserOtp = async ({ email }) => {
    const user = await dbGetAsync('SELECT * FROM NguoiDung WHERE lower(Email) = lower(?)', [email]);
    if (!user) {
        return { handled: false };
    }

    if (Number(user.TrangThai) === 1) {
        return { handled: true, status: 400, body: { error: 'Tài khoản đã được xác thực' } };
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await dbRunAsync(
        'UPDATE NguoiDung SET MaXacThuc = ?, ThoiGianMaXacThuc = ? WHERE MaNguoiDung = ?',
        [otp, otpExpiry, user.MaNguoiDung]
    );

    const emailResult = await sendVerificationEmail(email, otp, user.HoTen || email);
    if (!emailResult?.success) {
        if (shouldExposeOtpInResponse) {
            return {
                handled: true,
                status: 200,
                body: {
                    message: 'Không thể gửi email lúc này. Dùng mã OTP tạm thời để xác thực.',
                    otp,
                    otpDeliveryFailed: true
                }
            };
        }
        return { handled: true, status: 500, body: { error: 'Không thể gửi email. Vui lòng thử lại.' } };
    }

    const body = { message: 'Đã gửi lại mã xác thực. Vui lòng kiểm tra email.' };
    if (shouldExposeOtpInResponse) {
        body.otp = otp;
    }

    return { handled: true, status: 200, body };
};

// Endpoint to expose public configuration (especially Google Client ID)
// This allows frontend to use runtime config instead of relying on build-time env vars
router.get('/config', (req, res) => {
    const firstValidGoogleClientId = GOOGLE_AUDIENCES[0] || '';
    
    res.json({
        googleClientId: firstValidGoogleClientId,
        apiBase: process.env.API_BASE || 'http://localhost:3001'
    });
});

router.post('/register', async (req, res) => {
    const { email, password, confirmPassword, name, phone, address, birthday, gender, acceptedTerms } = req.body;

    try {
        const normalizedEmail = normalizeEmail(email);

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email hợp lệ' });
        }

        if (!acceptedTerms) {
            return res.status(400).json({ error: 'Bạn cần đồng ý điều khoản sử dụng để tiếp tục.' });
        }

        if (typeof confirmPassword !== 'undefined' && password !== confirmPassword) {
            return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp' });
        }

        const passwordError = passwordStrengthError(password);
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }

        const existingUser = await dbGetAsync('SELECT MaNguoiDung, TrangThai FROM NguoiDung WHERE lower(Email) = lower(?)', [normalizedEmail]);
        if (existingUser && Number(existingUser.TrangThai) === 1) {
            return res.status(400).json({ error: 'Email này đã được sử dụng. Vui lòng sử dụng email khác.' });
        }

        if (existingUser && Number(existingUser.TrangThai) !== 1) {
            await cleanupUnverifiedUserById(existingUser.MaNguoiDung);
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await savePendingRegistration({
            email: normalizedEmail,
            passwordHash: hashedPassword,
            role: ROLE_PENDING,
            name,
            phone,
            address,
            birthday,
            gender,
            otp,
            otpExpiry
        });

        const otpDispatchResult = await sendOtpToPendingRegistration({
            email: normalizedEmail,
            otp,
            userName: name || normalizedEmail
        });

        return res.status(otpDispatchResult.success ? 201 : 202).json(buildRegistrationResponse({
            email: normalizedEmail,
            otp,
            extra: otpDispatchResult.success
                ? {}
                : {
                    message: 'Đăng ký tạm thành công. Hệ thống chưa gửi được email xác thực, vui lòng vào màn hình xác thực và bấm "Gửi lại mã".',
                    otpDeliveryFailed: true
                }
        }));
    } catch (err) {
        if (isUniqueConstraintError(err)) {
            return res.status(400).json({ error: 'Email này đã được sử dụng. Vui lòng sử dụng email khác.' });
        }

        return res.status(500).json({ error: err.message || 'Đăng ký thất bại' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const normalizedEmail = normalizeEmail(req.body?.email || '');
    const password = String(req.body?.password || '');

    if (!normalizedEmail || !password) {
        return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' });
    }

    try {
        const user = await getUserWithAvatarByEmail(normalizedEmail);
        if (!user) {
            return res.status(401).json({ error: 'Tài khoản không tồn tại' });
        }

        if (Number(user.TrangThai) !== 1) {
            return res.status(403).json({ error: 'Tài khoản chưa được xác thực. Vui lòng kiểm tra email.' });
        }

        const isValid = await bcrypt.compare(password, user.MatKhau || '');
        if (!isValid) {
            return res.status(401).json({ error: 'Bạn đã nhập sai mật khẩu.' });
        }

        return res.json(buildLoginResponse(req, user));
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Đăng nhập thất bại' });
    }
});

router.post('/google-login', async (req, res) => {
    const credential = String(req.body?.credential || '').trim();

    try {
        const googlePayload = await verifyGoogleCredential(credential);
        const normalizedEmail = normalizeEmail(googlePayload.email);
        const displayName = String(googlePayload.name || '').trim();

        if (!normalizedEmail) {
            return res.status(400).json({ error: 'Email Google không hợp lệ.' });
        }

        let user = await getUserWithAvatarByEmail(normalizedEmail);

        if (!user) {
            // Tạo mật khẩu ngẫu nhiên để đáp ứng schema hiện tại (MatKhau NOT NULL).
            const randomPassword = `google_${crypto.randomBytes(24).toString('hex')}`;
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            await dbRunAsync(
                `INSERT INTO NguoiDung
                (Email, MatKhau, VaiTro, HoTen, TrangThai, MaXacThuc, ThoiGianMaXacThuc)
                VALUES (?, ?, ?, ?, 1, NULL, NULL)`,
                [
                    normalizedEmail,
                    hashedPassword,
                    ROLE_PENDING,
                    displayName || null
                ]
            );
        } else {
            const updates = [];
            const params = [];

            if (Number(user.TrangThai) !== 1) {
                updates.push('TrangThai = 1');
            }
            if (user.MaXacThuc) {
                updates.push('MaXacThuc = NULL');
            }
            if (user.ThoiGianMaXacThuc) {
                updates.push('ThoiGianMaXacThuc = NULL');
            }
            if ((!user.HoTen || !String(user.HoTen).trim()) && displayName) {
                updates.push('HoTen = ?');
                params.push(displayName);
            }

            if (updates.length) {
                await dbRunAsync(
                    `UPDATE NguoiDung SET ${updates.join(', ')} WHERE MaNguoiDung = ?`,
                    [...params, user.MaNguoiDung]
                );
            }
        }

        user = await getUserWithAvatarByEmail(normalizedEmail);

        if (!user) {
            return res.status(500).json({ error: 'Không thể tạo tài khoản từ Google.' });
        }

        return res.json(buildLoginResponse(req, user));
    } catch (err) {
        const message = String(err?.message || '').toLowerCase();

        if (
            message.includes('audience')
            || message.includes('issuer')
            || message.includes('invalid')
            || message.includes('expired')
            || message.includes('jwt')
        ) {
            return res.status(401).json({ error: 'Google credential không hợp lệ hoặc đã hết hạn.' });
        }

        return res.status(500).json({
            error: err?.message || 'Đăng nhập Google thất bại.'
        });
    }
});

router.post('/select-role', authenticateToken, async (req, res) => {
    const userId = Number.parseInt(req.user?.id, 10);
    if (!Number.isFinite(userId)) {
        return res.status(401).json({ error: 'Token không hợp lệ.' });
    }

    const selectedRole = normalizeRoleInput(req.body?.role, '');
    if (![ROLE_CANDIDATE, ROLE_EMPLOYER].includes(selectedRole)) {
        return res.status(400).json({ error: 'Vai trò không hợp lệ. Chỉ hỗ trợ Ứng viên hoặc Nhà tuyển dụng.' });
    }

    try {
        const user = await getUserWithAvatarById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
        }

        await updateBasicUserInfo({ userId, role: selectedRole });

        if (selectedRole === ROLE_EMPLOYER) {
            await ensureEmployerAndCompanyProfile({
                userId,
                companyName: req.body?.companyName,
                taxCode: req.body?.taxCode,
                website: req.body?.website,
                address: req.body?.address,
                city: req.body?.city,
                description: req.body?.description,
                logo: req.body?.logo,
                industry: req.body?.industry
            });
        } else {
            await ensureCandidateProfile({
                userId,
                birthday: req.body?.birthday,
                gender: req.body?.gender,
                address: req.body?.address
            });
        }

        const refreshedUser = await getUserWithAvatarById(userId);
        if (!refreshedUser) {
            return res.status(404).json({ error: 'Không thể tải lại thông tin người dùng.' });
        }

        const loginPayload = buildLoginResponse(req, refreshedUser);
        const roleKey = selectedRole === ROLE_EMPLOYER ? 'employer' : 'candidate';

        return res.json({
            success: true,
            message: 'Đã lưu vai trò thành công.',
            selectedRole,
            nextStep: `/onboarding/profile?role=${roleKey}`,
            ...loginPayload
        });
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Không thể lưu vai trò.' });
    }
});

router.post('/complete-profile', authenticateToken, async (req, res) => {
    const userId = Number.parseInt(req.user?.id, 10);
    if (!Number.isFinite(userId)) {
        return res.status(401).json({ error: 'Token không hợp lệ.' });
    }

    try {
        const existingUser = await getUserWithAvatarById(userId);
        if (!existingUser) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
        }

        const requestedRole = normalizeRoleInput(req.body?.role, '');
        const fallbackRole = normalizeRoleInput(existingUser.VaiTro, ROLE_PENDING);
        const role = [ROLE_CANDIDATE, ROLE_EMPLOYER].includes(requestedRole)
            ? requestedRole
            : fallbackRole;

        if (![ROLE_CANDIDATE, ROLE_EMPLOYER].includes(role)) {
            return res.status(400).json({ error: 'Vui lòng chọn vai trò trước khi hoàn thiện hồ sơ.' });
        }

        const fullName = req.body?.fullName ?? req.body?.HoTen;
        const phone = req.body?.phone ?? req.body?.SoDienThoai;
        const address = req.body?.address ?? req.body?.DiaChi;

        await updateBasicUserInfo({
            userId,
            fullName,
            phone,
            address,
            role
        });

        if (role === ROLE_CANDIDATE) {
            await ensureCandidateProfile({
                userId,
                birthday: req.body?.birthday ?? req.body?.NgaySinh,
                gender: req.body?.gender ?? req.body?.GioiTinh,
                address,
                city: req.body?.city ?? req.body?.ThanhPho,
                district: req.body?.district ?? req.body?.QuanHuyen,
                intro: req.body?.introHtml ?? req.body?.GioiThieuBanThan,
                experienceYears: req.body?.experienceYears ?? req.body?.SoNamKinhNghiem,
                education: req.body?.education ?? req.body?.TrinhDoHocVan,
                avatar: req.body?.avatar ?? req.body?.AnhDaiDien,
                title: req.body?.title ?? req.body?.ChucDanh ?? req.body?.position,
                personalLink: req.body?.personalLink ?? req.body?.LinkCaNhan,
                educationList: req.body?.educationList,
                workList: req.body?.workList,
                languageList: req.body?.languageList
            });
        } else {
            await ensureEmployerAndCompanyProfile({
                userId,
                companyName: req.body?.companyName ?? req.body?.TenCongTy,
                taxCode: req.body?.taxCode ?? req.body?.MaSoThue,
                website: req.body?.website ?? req.body?.Website,
                address,
                city: req.body?.city ?? req.body?.ThanhPho,
                description: req.body?.description ?? req.body?.MoTa,
                logo: req.body?.logo ?? req.body?.Logo,
                industry: req.body?.industry ?? req.body?.LinhVuc
            });
        }

        const refreshedUser = await getUserWithAvatarById(userId);
        if (!refreshedUser) {
            return res.status(404).json({ error: 'Không thể tải lại thông tin người dùng.' });
        }

        const loginPayload = buildLoginResponse(req, refreshedUser);

        return res.json({
            success: true,
            message: 'Hoàn thiện hồ sơ thành công.',
            redirectTo: role === ROLE_EMPLOYER ? '/employer' : '/profile',
            ...loginPayload
        });
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Không thể lưu hồ sơ.' });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    const normalizedEmail = normalizeEmail(email);
    const normalizedOtp = String(otp || '').trim();

    if (!normalizedEmail) {
        return res.status(400).json({ error: 'Thiếu email xác thực' });
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
        return res.status(400).json({ error: 'Mã xác thực không đúng định dạng' });
    }

    try {
        await ensurePendingRegistrationTable();

        const pending = await dbGetAsync('SELECT * FROM DangKyTam WHERE Email = ?', [normalizedEmail]);

        if (!pending) {
            const legacyResult = await verifyLegacyUnverifiedUserOtp({ email: normalizedEmail, otp: normalizedOtp });
            if (!legacyResult.handled) {
                return res.status(404).json({ error: 'Không tìm thấy tài khoản chờ xác thực' });
            }
            return res.status(legacyResult.status).json(legacyResult.body);
        }

        const now = new Date();
        const otpExpiry = new Date(pending.ThoiGianMaXacThuc);
        if (Number.isNaN(otpExpiry.getTime()) || now > otpExpiry) {
            return res.status(400).json({ error: 'Mã xác thực đã hết hạn. Vui lòng gửi lại mã.' });
        }

        if (String(pending.MaXacThuc || '') !== normalizedOtp) {
            return res.status(400).json({ error: 'Mã xác thực không đúng' });
        }

        const existingUser = await dbGetAsync('SELECT MaNguoiDung, TrangThai FROM NguoiDung WHERE lower(Email) = lower(?)', [normalizedEmail]);
        if (existingUser && Number(existingUser.TrangThai) === 1) {
            await dbRunAsync('DELETE FROM DangKyTam WHERE Email = ?', [normalizedEmail]);
            return res.status(400).json({ error: 'Email này đã được sử dụng. Vui lòng sử dụng email khác.' });
        }

        if (existingUser && Number(existingUser.TrangThai) !== 1) {
            await cleanupUnverifiedUserById(existingUser.MaNguoiDung);
        }

        const role = normalizeRoleInput(pending.VaiTro, ROLE_PENDING);
        let createdUserId = 0;

        try {
            const insertUserResult = await dbRunAsync(
                `INSERT INTO NguoiDung
                (Email, MatKhau, VaiTro, HoTen, SoDienThoai, DiaChi, TrangThai, MaXacThuc, ThoiGianMaXacThuc)
                VALUES (?, ?, ?, ?, ?, ?, 1, NULL, NULL)`,
                [
                    normalizedEmail,
                    pending.MatKhau,
                    role,
                    pending.HoTen || null,
                    pending.SoDienThoai || null,
                    pending.DiaChi || null
                ]
            );
            createdUserId = insertUserResult.lastID;

            if (role === ROLE_EMPLOYER) {
                await ensureEmployerAndCompanyProfile({
                    userId: createdUserId,
                    companyName: pending.TenCongTy,
                    taxCode: pending.MaSoThue,
                    address: pending.DiaChi,
                    city: null,
                    website: null,
                    description: null,
                    logo: null,
                    industry: null
                });
            }

            if (role === ROLE_CANDIDATE) {
                await ensureCandidateProfile({
                    userId: createdUserId,
                    birthday: pending.NgaySinh,
                    gender: pending.GioiTinh,
                    address: pending.DiaChi
                });
            }

            await dbRunAsync('DELETE FROM DangKyTam WHERE Email = ?', [normalizedEmail]);

            const createdUser = await getUserWithAvatarById(createdUserId);
            if (!createdUser) {
                return res.status(500).json({ error: 'Không thể tải thông tin tài khoản sau xác thực.' });
            }

            let nextStep = '/onboarding/role';
            let message = 'Xác thực thành công! Hãy chọn vai trò để tiếp tục.';
            if (role === ROLE_EMPLOYER) {
                nextStep = '/onboarding/profile?role=employer';
                message = 'Xác thực thành công! Hãy hoàn thiện hồ sơ nhà tuyển dụng.';
            } else if (role === ROLE_CANDIDATE) {
                nextStep = '/onboarding/profile?role=candidate';
                message = 'Xác thực thành công! Hãy hoàn thiện hồ sơ ứng viên.';
            }

            const loginPayload = buildLoginResponse(req, createdUser);

            return res.json({
                success: true,
                message,
                nextStep,
                prefill: {
                    fullName: pending.HoTen || '',
                    phone: pending.SoDienThoai || '',
                    address: pending.DiaChi || '',
                    birthday: pending.NgaySinh || '',
                    gender: pending.GioiTinh || ''
                },
                ...loginPayload
            });
        } catch (createErr) {
            if (createdUserId) {
                await dbRunAsync('DELETE FROM CongTy WHERE NguoiDaiDien = ?', [createdUserId]);
                await dbRunAsync('DELETE FROM NhaTuyenDung WHERE MaNguoiDung = ?', [createdUserId]);
                await dbRunAsync('DELETE FROM NguoiDung WHERE MaNguoiDung = ?', [createdUserId]);
            }

            throw createErr;
        }
    } catch (err) {
        if (isUniqueConstraintError(err)) {
            return res.status(400).json({ error: 'Email này đã được sử dụng. Vui lòng sử dụng email khác.' });
        }

        return res.status(500).json({ error: err.message || 'Không thể xác thực OTP' });
    }
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
        return res.status(400).json({ error: 'Thiếu email để gửi lại mã xác thực' });
    }

    try {
        await ensurePendingRegistrationTable();

        const pending = await dbGetAsync('SELECT * FROM DangKyTam WHERE Email = ?', [normalizedEmail]);

        if (pending) {
            const otp = generateOTP();
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

            await dbRunAsync(
                'UPDATE DangKyTam SET MaXacThuc = ?, ThoiGianMaXacThuc = ?, NgayTao = CURRENT_TIMESTAMP WHERE Email = ?',
                [otp, otpExpiry, normalizedEmail]
            );

            const emailResult = await sendVerificationEmail(normalizedEmail, otp, pending.HoTen || pending.TenCongTy || normalizedEmail);
            if (!emailResult?.success) {
                if (shouldExposeOtpInResponse) {
                    return res.json({
                        message: 'Không thể gửi email lúc này. Dùng mã OTP tạm thời để xác thực.',
                        otp,
                        otpDeliveryFailed: true
                    });
                }
                return res.status(500).json({ error: 'Không thể gửi email. Vui lòng thử lại.' });
            }

            const payload = { message: 'Đã gửi lại mã xác thực. Vui lòng kiểm tra email.' };
            if (shouldExposeOtpInResponse) {
                payload.otp = otp;
            }

            return res.json(payload);
        }

        const legacyResult = await resendLegacyUnverifiedUserOtp({ email: normalizedEmail });
        if (!legacyResult.handled) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản chờ xác thực' });
        }

        return res.status(legacyResult.status).json(legacyResult.body);
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Không thể gửi lại mã xác thực' });
    }
});

// Forgot password - gửi mã đặt lại mật khẩu
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    db.get('SELECT * FROM NguoiDung WHERE lower(Email) = lower(?)', [normalizeEmail(email)], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }

        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 phút

        db.run(
            'UPDATE NguoiDung SET MaXacThuc = ?, ThoiGianMaXacThuc = ? WHERE MaNguoiDung = ?',
            [otp, otpExpiry, user.MaNguoiDung],
            async (updateErr) => {
                if (updateErr) {
                    return res.status(500).json({ error: updateErr.message });
                }

                const emailResult = await sendVerificationEmail(normalizeEmail(email), otp, user.HoTen || normalizeEmail(email));
                if (!emailResult.success) {
                    if (shouldExposeOtpInResponse) {
                        return res.json({
                            message: 'Không thể gửi email lúc này. Dùng mã OTP tạm thời để đặt lại mật khẩu.',
                            otp,
                            otpDeliveryFailed: true
                        });
                    }
                    return res.status(500).json({ error: 'Không thể gửi email. Vui lòng thử lại.' });
                }

                if (shouldExposeOtpInResponse) {
                    return res.json({ message: 'Đã gửi mã đặt lại mật khẩu. Vui lòng kiểm tra email.', otp });
                }

                return res.json({ message: 'Đã gửi mã đặt lại mật khẩu. Vui lòng kiểm tra email.' });
            }
        );
    });
});

// Reset password using OTP (from email)
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
    }

    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasLetter || !hasNumber) {
        return res.status(400).json({ error: 'Mật khẩu mới phải bao gồm cả chữ và số' });
    }

    db.get('SELECT * FROM NguoiDung WHERE lower(Email) = lower(?)', [normalizeEmail(email)], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });

        const now = new Date();
        const otpExpiry = user.ThoiGianMaXacThuc ? new Date(user.ThoiGianMaXacThuc) : null;
        if (!otpExpiry || now > otpExpiry) {
            return res.status(400).json({ error: 'Mã đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu lại.' });
        }

        if (user.MaXacThuc !== otp) {
            return res.status(400).json({ error: 'Mã đặt lại mật khẩu không đúng' });
        }

        try {
            const hashed = await bcrypt.hash(newPassword, 10);
            db.run(
                'UPDATE NguoiDung SET MatKhau = ?, MaXacThuc = NULL, ThoiGianMaXacThuc = NULL WHERE MaNguoiDung = ?',
                [hashed, user.MaNguoiDung],
                (updateErr) => {
                    if (updateErr) return res.status(500).json({ error: updateErr.message });
                    return res.json({ message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' });
                }
            );
        } catch (hashErr) {
            return res.status(500).json({ error: hashErr.message });
        }
    });
});

// Logout (client-side, just return success)
router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// Verify token
router.get('/verify-token', (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        return res.json({ valid: true, user });
    });
});

module.exports = router;
