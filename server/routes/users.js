
const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const db = require('../config/db');

const BASE_PATH = (() => {
  const basePath = process.env.BASE_PATH || '/';
  let normalized = basePath;
  if (!normalized.startsWith('/')) normalized = '/' + normalized;
  if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
})();
const PUBLIC_PREFIX = BASE_PATH === '/' ? '' : BASE_PATH;

const buildAvatarRelativePath = (filename) => `${PUBLIC_PREFIX}/images/avatars/${filename}`;
const buildAbsoluteUrl = (req, relativePath) => (relativePath ? `${req.protocol}://${req.get('host')}${relativePath}` : '');
const safeJsonArray = (val) => {
  try {
    const arr = Array.isArray(val) ? val : [];
    return JSON.stringify(arr);
  } catch (err) {
    console.warn('JSON stringify failed, fallback to []', err);
    return '[]';
  }
};
const parseJsonArray = (text) => {
  try {
    const parsed = JSON.parse(text || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/images/avatars'));
  },
  filename: function (req, file, cb) {
    // Đặt tên file: userId_timestamp.ext
    const ext = path.extname(file.originalname);
    const userId = req.body.userId || 'unknown';
    cb(null, `avatar_${userId}_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Chỉ chấp nhận file ảnh.'));
    }
    cb(null, true);
  }
});

// API upload avatar
router.post('/upload-avatar', upload.single('avatar'), (req, res) => {
  const userId = req.body.userId;
  if (!userId || !req.file) {
    return res.status(400).json({ error: 'Thiếu userId hoặc file.' });
  }
  const numUserId = parseInt(userId, 10);
  if (Number.isNaN(numUserId)) {
    return res.status(400).json({ error: 'userId không hợp lệ' });
  }
  const avatarUrl = buildAvatarRelativePath(req.file.filename);
  const absoluteUrl = buildAbsoluteUrl(req, avatarUrl);

  // Upsert: nếu chưa có HoSoUngVien thì tạo mới để không bị mất avatar sau reload
  db.get('SELECT MaHoSo FROM HoSoUngVien WHERE MaNguoiDung = ?', [numUserId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Lỗi kiểm tra HoSoUngVien', details: err.message });
    }

    if (row) {
      db.run(
        'UPDATE HoSoUngVien SET AnhDaiDien = ?, NgayCapNhat = datetime("now", "localtime") WHERE MaNguoiDung = ?',
        [avatarUrl, numUserId],
        function (err2) {
          if (err2) {
            return res.status(500).json({ error: 'Lỗi cập nhật DB', details: err2.message });
          }
          return res.json({ success: true, avatarUrl, absoluteUrl });
        }
      );
      return;
    }

    db.run(
      `INSERT INTO HoSoUngVien (MaNguoiDung, AnhDaiDien, NgayTao, NgayCapNhat)
       VALUES (?, ?, datetime("now", "localtime"), datetime("now", "localtime"))`,
      [numUserId, avatarUrl],
      function (err3) {
        if (err3) {
          return res.status(500).json({ error: 'Lỗi tạo HoSoUngVien', details: err3.message });
        }
        return res.json({ success: true, avatarUrl, absoluteUrl });
      }
    );
  });
});

// API update user profile
router.post('/update-profile', (req, res) => {
  const { userId, fullName, position, phone, birthday, gender, city, address, personalLink, introHtml, educationList, workList, languageList } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'Thiếu userId' });
  }

  // Convert userId to number if needed
  const numUserId = parseInt(userId, 10);
  if (isNaN(numUserId)) {
    return res.status(400).json({ error: 'userId không hợp lệ' });
  }

  console.log('Updating profile for userId:', numUserId, { fullName, phone, birthday, gender, city, address });
  const introContent = introHtml || '';
  const educationJson = safeJsonArray(educationList);
  const workJson = safeJsonArray(workList);
  const languageJson = safeJsonArray(languageList);

  // Update NguoiDung table (HoTen, SoDienThoai, DiaChi)
  db.run(
    `UPDATE NguoiDung 
     SET HoTen = ?, SoDienThoai = ?, DiaChi = ?, NgayCapNhat = datetime("now", "localtime") 
     WHERE MaNguoiDung = ?`,
    [fullName || '', phone || '', address || '', numUserId],
    function (err) {
      if (err) {
        console.error('Error updating NguoiDung:', err);
        return res.status(500).json({ error: 'Lỗi cập nhật bảng NguoiDung', details: err.message });
      }

      console.log('NguoiDung updated, rows changed:', this.changes);

      // Check if HoSoUngVien exists
      db.get('SELECT MaHoSo FROM HoSoUngVien WHERE MaNguoiDung = ?', [numUserId], (err, row) => {
        if (err) {
          console.error('Error checking HoSoUngVien:', err);
          return res.status(500).json({ error: 'Lỗi kiểm tra HoSoUngVien', details: err.message });
        }

        if (row) {
          // HoSoUngVien exists, update it
          db.run(
            `UPDATE HoSoUngVien 
             SET NgaySinh = ?, GioiTinh = ?, ThanhPho = ?, ChucDanh = ?, LinkCaNhan = ?, GioiThieuBanThan = ?, EducationListJson = ?, WorkListJson = ?, LanguageListJson = ?, NgayCapNhat = datetime("now", "localtime") 
             WHERE MaNguoiDung = ?`,
            [birthday || '', gender || '', city || '', position || '', introContent, educationJson, workJson, languageJson, numUserId],
            function (err) {
              if (err) {
                console.error('Error updating HoSoUngVien:', err);
                return res.json({ success: true, message: 'Cập nhật thông tin thành công (chỉ cơ bản)' });
              }
              console.log('HoSoUngVien updated, rows changed:', this.changes);
              return res.json({ success: true, message: 'Cập nhật thông tin thành công' });
            }
          );
        } else {
          // HoSoUngVien doesn't exist, create it
          db.run(
            `INSERT INTO HoSoUngVien (MaNguoiDung, NgaySinh, GioiTinh, ThanhPho, ChucDanh, LinkCaNhan, GioiThieuBanThan, EducationListJson, WorkListJson, LanguageListJson, NgayTao, NgayCapNhat)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now", "localtime"), datetime("now", "localtime"))`,
            [numUserId, birthday || '', gender || '', city || '', position || '', personalLink || '', introContent, educationJson, workJson, languageJson],
            function (err) {
              if (err) {
                console.error('Error inserting HoSoUngVien:', err);
                return res.json({ success: true, message: 'Cập nhật thông tin thành công (chỉ cơ bản)' });
              }
              console.log('HoSoUngVien created');
              return res.json({ success: true, message: 'Cập nhật thông tin thành công' });
            }
          );
        }
      });
    }
  );
});

// API get user profile
router.get('/profile/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'userId không hợp lệ' });
  }

  db.get(
    `SELECT nd.MaNguoiDung AS userId, nd.Email, nd.HoTen, nd.SoDienThoai, nd.DiaChi,
            hsv.NgaySinh, hsv.GioiTinh, hsv.ThanhPho, hsv.AnhDaiDien, hsv.ChucDanh, hsv.LinkCaNhan,
            hsv.GioiThieuBanThan, hsv.EducationListJson, hsv.WorkListJson, hsv.LanguageListJson
     FROM NguoiDung nd
     LEFT JOIN HoSoUngVien hsv ON hsv.MaNguoiDung = nd.MaNguoiDung
     WHERE nd.MaNguoiDung = ?`,
    [userId],
    (err, row) => {
      if (err) {
        console.error('Error fetching profile:', err);
        return res.status(500).json({ error: 'Lỗi truy vấn hồ sơ', details: err.message });
      }
      if (!row) {
        return res.status(404).json({ error: 'Không tìm thấy người dùng' });
      }

      return res.json({
        success: true,
        profile: {
          userId: row.userId,
          email: row.Email,
          fullName: row.HoTen || '',
          phone: row.SoDienThoai || '',
          address: row.DiaChi || '',
          birthday: row.NgaySinh || '',
          gender: row.GioiTinh || 'Nam',
          city: row.ThanhPho || '',
          avatarUrl: row.AnhDaiDien || '',
          avatarAbsoluteUrl: buildAbsoluteUrl(req, row.AnhDaiDien || ''),
          position: row.ChucDanh || '',
          personalLink: row.LinkCaNhan || '',
          introHtml: row.GioiThieuBanThan || '',
          educationList: parseJsonArray(row.EducationListJson),
          workList: parseJsonArray(row.WorkListJson),
          languageList: parseJsonArray(row.LanguageListJson)
        }
      });
    }
  );
});

module.exports = router;
