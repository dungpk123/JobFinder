const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();
const JWT_SECRET = 'your_jwt_secret';

// Change password route
router.post('/', async (req, res) => {
    try {
        // Lấy token từ header
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

        if (!token) {
            return res.status(401).json({ error: 'Vui lòng đăng nhập lại.' });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn.' });
        }

        const userId = decoded.id;
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.' });
        }

        // Validate new password strength
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
        }

        const hasLetter = /[a-zA-Z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);
        if (!hasLetter || !hasNumber) {
            return res.status(400).json({ error: 'Mật khẩu mới phải bao gồm cả chữ và số.' });
        }

        // Get user from database
        db.get('SELECT MaNguoiDung, MatKhau FROM NguoiDung WHERE MaNguoiDung = ?', [userId], async (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Lỗi hệ thống. Vui lòng thử lại.' });
            }
            
            if (!user) {
                return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
            }

            try {
                // Verify current password
                const isValid = await bcrypt.compare(currentPassword, user.MatKhau);
                if (!isValid) {
                    return res.status(401).json({ error: 'Mật khẩu hiện tại không chính xác.' });
                }

                // Check if new password is same as current
                const isSamePassword = await bcrypt.compare(newPassword, user.MatKhau);
                if (isSamePassword) {
                    return res.status(400).json({ error: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.' });
                }

                // Hash new password
                const hashedPassword = await bcrypt.hash(newPassword, 10);
                
                // Update password in database
                db.run('UPDATE NguoiDung SET MatKhau = ? WHERE MaNguoiDung = ?', [hashedPassword, userId], (updateErr) => {
                    if (updateErr) {
                        console.error('Update error:', updateErr);
                        return res.status(500).json({ error: 'Không thể cập nhật mật khẩu. Vui lòng thử lại.' });
                    }
                    
                    res.json({ message: 'Đổi mật khẩu thành công.' });
                });
            } catch (hashErr) {
                console.error('Hash error:', hashErr);
                res.status(500).json({ error: 'Lỗi xử lý mật khẩu. Vui lòng thử lại.' });
            }
        });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: 'Lỗi server. Vui lòng thử lại.' });
    }
});

module.exports = router;
