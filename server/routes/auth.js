const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/sqlite');
const { generateOTP, sendVerificationEmail } = require('../config/email');
const fetch = require('node-fetch');
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
router.post('/register', async (req, res) => {
    const { email, password, confirmPassword, role, name, phone, address } = req.body;
    try {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email hợp lệ' });
        }
        
        if (typeof confirmPassword !== 'undefined' && password !== confirmPassword) {
            return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp' });
        }
        
        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự' });
        }
        
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        if (!hasLetter || !hasNumber) {
            return res.status(400).json({ error: 'Mật khẩu phải bao gồm cả chữ và số' });
        }
        
        // Check if email already exists
        db.get('SELECT MaNguoiDung FROM NguoiDung WHERE Email = ?', [email], async (err, existingUser) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (existingUser) {
                return res.status(400).json({ error: 'Email này đã được sử dụng. Vui lòng sử dụng email khác.' });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            const otp = generateOTP();
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes
            
            db.run(
                'INSERT INTO NguoiDung (Email, MatKhau, VaiTro, HoTen, SoDienThoai, DiaChi, TrangThai, MaXacThuc, ThoiGianMaXacThuc) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
                [email, hashedPassword, role || 'Ứng viên', name, phone, address, otp, otpExpiry],
                async function(err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            return res.status(400).json({ error: 'Email này đã được sử dụng. Vui lòng sử dụng email khác.' });
                        }
                        return res.status(500).json({ error: err.message });
                    }
                    
                    // Gửi email xác thực
                    try {
                        const emailResult = await sendVerificationEmail(email, otp, name);
                        if (!emailResult.success) {
                            console.error('Email sending failed:', emailResult.error);
                        }
                    } catch (emailError) {
                        console.error('Email error:', emailError);
                    }
                    
                    res.status(201).json({ 
                        message: 'Vui lòng kiểm tra email để lấy mã xác thực',
                        email: email,
                        requireVerification: true,
                        otp: otp // TẠM THỜI hiển thị OTP trong response để test (XÓA SAU KHI EMAIL HOẠT ĐỘNG)
                    });
                }
            );
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    db.get(
        `SELECT nd.*, hsv.AnhDaiDien AS avatar
         FROM NguoiDung nd
         LEFT JOIN HoSoUngVien hsv ON hsv.MaNguoiDung = nd.MaNguoiDung
         WHERE nd.Email = ?`,
        [email],
        async (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(401).json({ error: 'Tài khoản không tồn tại' });
        }

        // Kiểm tra tài khoản đã xác thực chưa
        if (user.TrangThai === 0) {
            return res.status(403).json({ error: 'Tài khoản chưa được xác thực. Vui lòng kiểm tra email.' });
        }

        // Kiểm tra tài khoản có bị khóa không
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
                // Tăng số lần đăng nhập sai
                const newFailCount = (user.SoLanDangNhapSai || 0) + 1;
                let updateQuery = 'UPDATE NguoiDung SET SoLanDangNhapSai = ?';
                let params = [newFailCount];
                let lockMsg = '';
                if (newFailCount >= 5) {
                    // Khóa tài khoản 5 phút
                    const lockUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
                    updateQuery += ', ThoiGianKhoaDangNhap = ?';
                    params.push(lockUntil);
                    lockMsg = ' Tài khoản bị khóa 5 phút.';
                }
                updateQuery += ' WHERE MaNguoiDung = ?';
                params.push(user.MaNguoiDung);
                db.run(updateQuery, params, (err2) => {
                    // Không cần xử lý err2 ở đây
                });
                return res.status(401).json({ error: 'Bạn đã nhập sai mật khẩu.' + lockMsg });
            }

            // Đăng nhập đúng: reset số lần sai và thời gian khóa
            db.run('UPDATE NguoiDung SET SoLanDangNhapSai = 0, ThoiGianKhoaDangNhap = NULL WHERE MaNguoiDung = ?', [user.MaNguoiDung]);

            const avatarRelative = user.avatar || '';
            // If stored path already has BASE prefix, keep it; otherwise it is relative to root
            const normalizedAvatar = avatarRelative ? `${PUBLIC_PREFIX}${avatarRelative.startsWith('/') ? '' : '/'}${avatarRelative.replace(/^\/+/, '')}` : '';
            const avatarAbsolute = buildAbsoluteUrl(req, normalizedAvatar);

            const isSuperAdmin = !!(user.IsSuperAdmin || user.isSuperAdmin);
            const roleLabel = isSuperAdmin ? 'Siêu quản trị viên' : user.VaiTro;
            const token = jwt.sign({ id: user.MaNguoiDung, role: roleLabel, isSuperAdmin }, JWT_SECRET, { expiresIn: '1h' });
            res.json({ 
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
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
});

// Register Employer (with company info)
router.post('/register-employer', async (req, res) => {
    const { email, password, name, phone, companyName, taxCode, address } = req.body;
    try {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email hợp lệ' });
        }
        
        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 8 ký tự' });
        }
        
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        if (!hasLetter || !hasNumber) {

// Change password
router.post('/change-password', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập lại.' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn.' });
    }

    const userId = decoded.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
    }

    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasLetter || !hasNumber) {
        return res.status(400).json({ error: 'Mật khẩu mới phải bao gồm cả chữ và số.' });
    }

    db.get('SELECT MaNguoiDung, MatKhau FROM NguoiDung WHERE MaNguoiDung = ?', [userId], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
        }

        try {
            const isValid = await bcrypt.compare(currentPassword, user.MatKhau);
            if (!isValid) {
                return res.status(401).json({ error: 'Mật khẩu hiện tại không chính xác.' });
            }

            const isSamePassword = await bcrypt.compare(newPassword, user.MatKhau);
            if (isSamePassword) {
                return res.status(400).json({ error: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.' });
            }

            const hashed = await bcrypt.hash(newPassword, 10);
            db.run('UPDATE NguoiDung SET MatKhau = ? WHERE MaNguoiDung = ?', [hashed, userId], (updateErr) => {
                if (updateErr) {
                    return res.status(500).json({ error: updateErr.message });
                }
                res.json({ message: 'Đổi mật khẩu thành công.' });
            });
        } catch (hashErr) {
            res.status(500).json({ error: hashErr.message });
        }
    });
});
            return res.status(400).json({ error: 'Mật khẩu phải bao gồm cả chữ và số' });
        }
        
        // Check if email already exists
        db.get('SELECT MaNguoiDung FROM NguoiDung WHERE Email = ?', [email], async (err, existingUser) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (existingUser) {
                return res.status(400).json({ error: 'Email này đã được sử dụng. Vui lòng sử dụng email khác.' });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            const otp = generateOTP();
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
            
            // First create the user
            db.run(
                'INSERT INTO NguoiDung (Email, MatKhau, VaiTro, HoTen, SoDienThoai, DiaChi, TrangThai, MaXacThuc, ThoiGianMaXacThuc) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)',
                [email, hashedPassword, 'Nhà tuyển dụng', name, phone, address, otp, otpExpiry],
                async function(err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            return res.status(400).json({ error: 'Email này đã được sử dụng. Vui lòng sử dụng email khác.' });
                        }
                        return res.status(500).json({ error: err.message });
                    }
                    
                    const userId = this.lastID;
                    
                    // Then create the company
                    db.run(
                        'INSERT INTO CongTy (TenCongTy, MaSoThue, DiaChi, NguoiDaiDien) VALUES (?, ?, ?, ?)',
                        [companyName, taxCode, address, userId],
                        async function(err) {
                            if (err) {
                                return res.status(500).json({ error: err.message });
                            }
                            
                            // Gửi email xác thực
                            try {
                                const emailResult = await sendVerificationEmail(email, otp, name);
                                if (!emailResult.success) {
                                    console.error('Email sending failed:', emailResult.error);
                                }
                            } catch (emailError) {
                                console.error('Email error:', emailError);
                            }
                            
                            res.status(201).json({ 
                                message: 'Vui lòng kiểm tra email để lấy mã xác thực',
                                email: email,
                                requireVerification: true,
                                userId: userId,
                                companyId: this.lastID,
                                otp: otp // TẠM THỜI hiển thị OTP để test
                            });
                        }
                    );
                }
            );
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verify OTP
router.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    
    db.get('SELECT * FROM NguoiDung WHERE Email = ?', [email], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }
        
        // Kiểm tra OTP đã hết hạn chưa
        const now = new Date();
        const otpExpiry = new Date(user.ThoiGianMaXacThuc);
        if (now > otpExpiry) {
            return res.status(400).json({ error: 'Mã xác thực đã hết hạn. Vui lòng đăng ký lại.' });
        }
        
        // Kiểm tra OTP có khớp không
        if (user.MaXacThuc !== otp) {
            return res.status(400).json({ error: 'Mã xác thực không đúng' });
        }
        
        // Cập nhật trạng thái tài khoản
        db.run(
            'UPDATE NguoiDung SET TrangThai = 1, MaXacThuc = NULL, ThoiGianMaXacThuc = NULL WHERE MaNguoiDung = ?',
            [user.MaNguoiDung],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ 
                    message: 'Xác thực thành công! Bạn có thể đăng nhập ngay.',
                    success: true 
                });
            }
        );
    });
});

// Resend OTP
router.post('/resend-otp', async (req, res) => {
    const { email } = req.body;
    
    db.get('SELECT * FROM NguoiDung WHERE Email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }
        
        if (user.TrangThai === 1) {
            return res.status(400).json({ error: 'Tài khoản đã được xác thực' });
        }
        
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        
        db.run(
            'UPDATE NguoiDung SET MaXacThuc = ?, ThoiGianMaXacThuc = ? WHERE MaNguoiDung = ?',
            [otp, otpExpiry, user.MaNguoiDung],
            async (err) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                const emailResult = await sendVerificationEmail(email, otp, user.HoTen);
                if (!emailResult.success) {
                    return res.status(500).json({ error: 'Không thể gửi email. Vui lòng thử lại.' });
                }
                
                res.json({ message: 'Đã gửi lại mã xác thực. Vui lòng kiểm tra email.' });
            }
        );
    });
});

// Forgot password - gửi mã đặt lại mật khẩu
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    db.get('SELECT * FROM NguoiDung WHERE Email = ?', [email], async (err, user) => {
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

                const emailResult = await sendVerificationEmail(email, otp, user.HoTen || email);
                if (!emailResult.success) {
                    return res.status(500).json({ error: 'Không thể gửi email. Vui lòng thử lại.' });
                }

                // In development, return the OTP in the response to simplify testing
                if (process.env.NODE_ENV !== 'production') {
                    return res.json({ message: 'Đã gửi mã đặt lại mật khẩu. Vui lòng kiểm tra email.', otp });
                }

                res.json({ message: 'Đã gửi mã đặt lại mật khẩu. Vui lòng kiểm tra email.' });
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

    db.get('SELECT * FROM NguoiDung WHERE Email = ?', [email], async (err, user) => {
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
                    res.json({ message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.' });
                }
            );
        } catch (hashErr) {
            res.status(500).json({ error: hashErr.message });
        }
    });
});

// Logout (client-side, just return success)
router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// Verify token
router.get('/verify-token', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        res.json({ valid: true, user });
    });
});

module.exports = router;