const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { generateOTP, sendVerificationEmail } = require('../config/email');
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

const PENDING_REGISTRATION_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS DangKyTam (
    Email VARCHAR(191) PRIMARY KEY,
    MatKhau VARCHAR(255) NOT NULL,
    VaiTro VARCHAR(50) NOT NULL DEFAULT 'Ứng viên',
    HoTen VARCHAR(255) NULL,
    SoDienThoai VARCHAR(50) NULL,
    DiaChi TEXT NULL,
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

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const isUniqueConstraintError = (err) => {
    const msg = String(err?.message || '').toLowerCase();
    return msg.includes('unique constraint failed')
        || msg.includes('duplicate entry')
        || msg.includes('er_dup_entry');
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
const ensurePendingRegistrationTable = async () => {
    if (!ensurePendingRegistrationTablePromise) {
        ensurePendingRegistrationTablePromise = dbRunAsync(PENDING_REGISTRATION_TABLE_SQL)
            .catch((err) => {
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
    companyName,
    taxCode,
    otp,
    otpExpiry
}) => {
    await ensurePendingRegistrationTable();

    await dbRunAsync(
        `INSERT OR REPLACE INTO DangKyTam
        (Email, MatKhau, VaiTro, HoTen, SoDienThoai, DiaChi, TenCongTy, MaSoThue, MaXacThuc, ThoiGianMaXacThuc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            email,
            passwordHash,
            role,
            name || null,
            phone || null,
            address || null,
            companyName || null,
            taxCode || null,
            otp,
            otpExpiry
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

router.post('/register', async (req, res) => {
    const { email, password, confirmPassword, role, name, phone, address } = req.body;

    try {
        const normalizedEmail = normalizeEmail(email);

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email hợp lệ' });
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
            role: role || 'Ứng viên',
            name,
            phone,
            address,
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
    const { email, password } = req.body;

    db.get(
        `SELECT nd.*, hsv.AnhDaiDien AS avatar
         FROM NguoiDung nd
         LEFT JOIN HoSoUngVien hsv ON hsv.MaNguoiDung = nd.MaNguoiDung
         WHERE lower(nd.Email) = lower(?)`,
        [normalizeEmail(email)],
        async (err, user) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!user) {
                return res.status(401).json({ error: 'Tài khoản không tồn tại' });
            }

            if (Number(user.TrangThai) === 0) {
                return res.status(403).json({ error: 'Tài khoản chưa được xác thực. Vui lòng kiểm tra email.' });
            }

            if (user.ThoiGianKhoaDangNhap) {
                const now = new Date();
                const lockTime = new Date(user.ThoiGianKhoaDangNhap);
                if (now < lockTime) {
                    const minutes = Math.ceil((lockTime - now) / 60000);
                    return res.status(403).json({ error: `Tài khoản bị khóa do nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutes} phút.` });
                }
            }

            try {
                const isValid = await bcrypt.compare(password, user.MatKhau);
                if (!isValid) {
                    const newFailCount = (user.SoLanDangNhapSai || 0) + 1;
                    let updateQuery = 'UPDATE NguoiDung SET SoLanDangNhapSai = ?';
                    const params = [newFailCount];
                    let lockMsg = '';

                    if (newFailCount >= 5) {
                        const lockUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
                        updateQuery += ', ThoiGianKhoaDangNhap = ?';
                        params.push(lockUntil);
                        lockMsg = ' Tài khoản bị khóa 5 phút.';
                    }

                    updateQuery += ' WHERE MaNguoiDung = ?';
                    params.push(user.MaNguoiDung);
                    db.run(updateQuery, params, () => {});

                    return res.status(401).json({ error: 'Bạn đã nhập sai mật khẩu.' + lockMsg });
                }

                db.run('UPDATE NguoiDung SET SoLanDangNhapSai = 0, ThoiGianKhoaDangNhap = NULL WHERE MaNguoiDung = ?', [user.MaNguoiDung]);

                const avatarRelative = user.avatar || '';
                const normalizedAvatar = avatarRelative
                    ? `${PUBLIC_PREFIX}${avatarRelative.startsWith('/') ? '' : '/'}${avatarRelative.replace(/^\/+/, '')}`
                    : '';
                const avatarAbsolute = buildAbsoluteUrl(req, normalizedAvatar);

                const isSuperAdmin = !!(user.IsSuperAdmin || user.isSuperAdmin);
                const roleLabel = isSuperAdmin ? 'Siêu quản trị viên' : user.VaiTro;
                const token = jwt.sign({ id: user.MaNguoiDung, role: roleLabel, isSuperAdmin }, JWT_SECRET, { expiresIn: '1h' });

                return res.json({
                    token,
                    user: {
                        id: user.MaNguoiDung,
                        email: user.Email,
                        role: roleLabel,
                        name: user.HoTen,
                        isSuperAdmin,
                        avatar: avatarAbsolute || normalizedAvatar || '',
                        avatarUrl: normalizedAvatar,
                        avatarAbsoluteUrl: avatarAbsolute,
                        AnhDaiDien: normalizedAvatar
                    }
                });
            } catch (compareError) {
                return res.status(500).json({ error: compareError.message });
            }
        }
    );
});

// Register Employer (with company info)
router.post('/register-employer', async (req, res) => {
    const { email, password, confirmPassword, name, phone, companyName, taxCode, address } = req.body;

    try {
        const normalizedEmail = normalizeEmail(email);

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email hợp lệ' });
        }

        if (!companyName || !String(companyName).trim()) {
            return res.status(400).json({ error: 'Vui lòng nhập tên công ty' });
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
            role: 'Nhà tuyển dụng',
            name,
            phone,
            address,
            companyName,
            taxCode,
            otp,
            otpExpiry
        });

        const otpDispatchResult = await sendOtpToPendingRegistration({
            email: normalizedEmail,
            otp,
            userName: name || companyName || normalizedEmail
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

        const role = pending.VaiTro || 'Ứng viên';
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

            if (role === 'Nhà tuyển dụng') {
                await dbRunAsync(
                    'INSERT INTO CongTy (TenCongTy, MaSoThue, DiaChi, NguoiDaiDien) VALUES (?, ?, ?, ?)',
                    [
                        pending.TenCongTy || pending.HoTen || 'Doanh nghiệp',
                        pending.MaSoThue || null,
                        pending.DiaChi || null,
                        createdUserId
                    ]
                );
            }

            await dbRunAsync('DELETE FROM DangKyTam WHERE Email = ?', [normalizedEmail]);

            return res.json({
                message: 'Xác thực thành công! Bạn có thể đăng nhập ngay.',
                success: true
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
