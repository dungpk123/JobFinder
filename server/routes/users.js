
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../config/db');
const { isCloudinaryConfigured, uploadImageFromPath } = require('../config/cloudinary');

const isAbsoluteUrl = (value = '') => /^https?:\/\//i.test(value) || value.startsWith('//');
const buildAbsoluteUrl = (req, relativePath) => {
  if (!relativePath) return '';
  if (isAbsoluteUrl(relativePath)) {
    return relativePath.startsWith('//') ? `${req.protocol}:${relativePath}` : relativePath;
  }
  return `${req.protocol}://${req.get('host')}${relativePath}`;
};

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

const isSchemaDriftError = (err) => {
  const message = String(err?.message || '').toLowerCase();
  return (
    message.includes('no such table')
    || message.includes('no such column')
    || message.includes('unknown column')
    || message.includes("doesn't exist")
  );
};

const getWithFallback = (queries, params, done) => {
  const queue = Array.isArray(queries) ? [...queries] : [];
  if (queue.length === 0) return done(null, null);

  const runNext = () => {
    const sql = queue.shift();
    if (!sql) return done(null, null);

    db.get(sql, params, (err, row) => {
      if (!err) return done(null, row || null);

      if (isSchemaDriftError(err)) {
        if (queue.length > 0) {
          console.warn('Schema drift detected, trying fallback query:', err.message);
          return runNext();
        }
        console.warn('Schema drift detected, skipping optional query:', err.message);
        return done(null, null);
      }

      return done(err);
    });
  };

  runNext();
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
router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
  const userId = req.body.userId;
  if (!userId || !req.file) {
    return res.status(400).json({ error: 'Thiếu userId hoặc file.' });
  }
  const numUserId = parseInt(userId, 10);
  if (Number.isNaN(numUserId)) {
    return res.status(400).json({ error: 'userId không hợp lệ' });
  }

  if (!isCloudinaryConfigured()) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(500).json({
      error: 'Cloudinary chưa được cấu hình trên server. Vui lòng cấu hình biến môi trường CLOUDINARY_*.'
    });
  }

  let avatarUrl = '';
  try {
    const uploadResult = await uploadImageFromPath(req.file.path, {
      folder: 'jobfinder/avatars',
      public_id: `avatar_${numUserId}_${Date.now()}`
    });
    avatarUrl = uploadResult?.secure_url || uploadResult?.url || '';
    if (!avatarUrl) {
      throw new Error('Cloudinary không trả về URL ảnh.');
    }
  } catch (err) {
    return res.status(500).json({ error: `Không thể upload ảnh lên Cloudinary: ${err.message}` });
  } finally {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
  }

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
  const {
    userId,
    fullName,
    position,
    phone,
    birthday,
    gender,
    city,
    district,
    address,
    personalLink,
    introHtml,
    education,
    avatar
  } = req.body;
  
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

  const continueUpdateCandidateProfile = () => {
    // Check if HoSoUngVien exists
    db.get('SELECT MaHoSo FROM HoSoUngVien WHERE MaNguoiDung = ?', [numUserId], (err, row) => {
      if (err) {
        if (isSchemaDriftError(err)) {
          console.warn('HoSoUngVien table/column is missing, skip candidate profile update:', err.message);
          return res.json({ success: true, message: 'Cập nhật thông tin thành công (chỉ cơ bản)' });
        }
        console.error('Error checking HoSoUngVien:', err);
        return res.status(500).json({ error: 'Lỗi kiểm tra HoSoUngVien', details: err.message });
      }

      if (row) {
        // HoSoUngVien exists, update it
        db.run(
          `UPDATE HoSoUngVien 
           SET NgaySinh = ?, GioiTinh = ?, DiaChi = ?, ThanhPho = ?, QuanHuyen = ?, ChucDanh = ?, LinkCaNhan = ?, GioiThieuBanThan = ?, TrinhDoHocVan = ?, AnhDaiDien = ?, NgayCapNhat = datetime("now", "localtime") 
           WHERE MaNguoiDung = ?`,
          [
            birthday || '',
            gender || '',
            address || '',
            city || '',
            district || '',
            position || '',
            personalLink || '',
            introContent,
            education || '',
            avatar || '',
            numUserId
          ],
          function (updateErr) {
            if (updateErr) {
              console.error('Error updating HoSoUngVien:', updateErr);
              return res.json({ success: true, message: 'Cập nhật thông tin thành công (chỉ cơ bản)' });
            }
            console.log('HoSoUngVien updated, rows changed:', this.changes);
            return res.json({ success: true, message: 'Cập nhật thông tin thành công' });
          }
        );
      } else {
        // HoSoUngVien doesn't exist, create it
        db.run(
          `INSERT INTO HoSoUngVien (MaNguoiDung, NgaySinh, GioiTinh, DiaChi, ThanhPho, QuanHuyen, ChucDanh, LinkCaNhan, GioiThieuBanThan, TrinhDoHocVan, AnhDaiDien, NgayTao, NgayCapNhat)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now", "localtime"), datetime("now", "localtime"))`,
          [
            numUserId,
            birthday || '',
            gender || '',
            address || '',
            city || '',
            district || '',
            position || '',
            personalLink || '',
            introContent,
            education || '',
            avatar || ''
          ],
          function (insertErr) {
            if (insertErr) {
              console.error('Error inserting HoSoUngVien:', insertErr);
              return res.json({ success: true, message: 'Cập nhật thông tin thành công (chỉ cơ bản)' });
            }
            console.log('HoSoUngVien created');
            return res.json({ success: true, message: 'Cập nhật thông tin thành công' });
          }
        );
      }
    });
  };

  // Update NguoiDung table (HoTen, SoDienThoai, DiaChi)
  db.run(
    `UPDATE NguoiDung 
     SET HoTen = ?, SoDienThoai = ?, DiaChi = ?, NgayCapNhat = datetime("now", "localtime") 
     WHERE MaNguoiDung = ?`,
    [fullName || '', phone || '', address || '', numUserId],
    function (err) {
      if (err && isSchemaDriftError(err)) {
        console.warn('NguoiDung.DiaChi is missing, fallback to basic update:', err.message);
        return db.run(
          `UPDATE NguoiDung 
           SET HoTen = ?, SoDienThoai = ?, NgayCapNhat = datetime("now", "localtime") 
           WHERE MaNguoiDung = ?`,
          [fullName || '', phone || '', numUserId],
          function (fallbackErr) {
            if (fallbackErr) {
              console.error('Error updating NguoiDung with fallback query:', fallbackErr);
              return res.status(500).json({ error: 'Lỗi cập nhật bảng NguoiDung', details: fallbackErr.message });
            }

            console.log('NguoiDung updated by fallback query, rows changed:', this.changes);
            return continueUpdateCandidateProfile();
          }
        );
      }

      if (err) {
        console.error('Error updating NguoiDung:', err);
        return res.status(500).json({ error: 'Lỗi cập nhật bảng NguoiDung', details: err.message });
      }

      console.log('NguoiDung updated, rows changed:', this.changes);
      return continueUpdateCandidateProfile();
    }
  );
});

// API get user profile
router.get('/profile/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'userId không hợp lệ' });
  }

  const userQueries = [
      `SELECT MaNguoiDung AS userId, Email, HoTen, SoDienThoai, DiaChi,
        NgayTao AS NguoiDungNgayTao, NgayCapNhat AS NguoiDungNgayCapNhat
     FROM NguoiDung
     WHERE MaNguoiDung = ?`,
      `SELECT MaNguoiDung AS userId, Email, HoTen, SoDienThoai,
        NgayTao AS NguoiDungNgayTao, NgayCapNhat AS NguoiDungNgayCapNhat
     FROM NguoiDung
      WHERE MaNguoiDung = ?`,
     `SELECT *
      FROM NguoiDung
      WHERE MaNguoiDung = ?`
  ];

  const candidateQueries = [
    `SELECT NgaySinh, GioiTinh, DiaChi AS DiaChiHoSo, ThanhPho, QuanHuyen, AnhDaiDien, ChucDanh, LinkCaNhan,
            GioiThieuBanThan, TrinhDoHocVan,
        NgayTao AS HoSoNgayTao, NgayCapNhat AS HoSoNgayCapNhat
     FROM HoSoUngVien
     WHERE MaNguoiDung = ?`,
      `SELECT NgaySinh, GioiTinh, DiaChi AS DiaChiHoSo, ThanhPho, QuanHuyen, AnhDaiDien,
        NgayTao AS HoSoNgayTao, NgayCapNhat AS HoSoNgayCapNhat
     FROM HoSoUngVien
      WHERE MaNguoiDung = ?`,
     `SELECT *
      FROM HoSoUngVien
      WHERE MaNguoiDung = ?`
  ];

  getWithFallback(userQueries, [userId], (userErr, userRow) => {
    if (userErr) {
      console.error('Error fetching profile base user:', userErr);
      return res.status(500).json({ error: 'Lỗi truy vấn hồ sơ', details: userErr.message });
    }
    if (!userRow) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    getWithFallback(candidateQueries, [userId], (candidateErr, candidateRow) => {
      if (candidateErr) {
        // Keep account page usable even when optional candidate profile query fails unexpectedly.
        console.warn('Error fetching candidate profile details, continue with base user:', candidateErr.message);
      }

      const row = { ...userRow, ...(candidateErr ? {} : (candidateRow || {})) };

      const resolvedUserId = firstDefined(row.userId, row.MaNguoiDung, userId);
      const resolvedFullName = row.HoTen || '';
      const resolvedEmail = row.Email || '';
      const resolvedPhone = row.SoDienThoai || '';
      const resolvedAddress = row.DiaChi || row.DiaChiHoSo || '';
      const resolvedBirthday = row.NgaySinh || '';
      const resolvedGender = row.GioiTinh || 'Nam';
      const resolvedCity = row.ThanhPho || '';
      const resolvedDistrict = row.QuanHuyen || '';
      const resolvedAvatar = row.AnhDaiDien || '';
      const resolvedPosition = row.ChucDanh || '';
      const resolvedPersonalLink = row.LinkCaNhan || '';
      const resolvedIntro = row.GioiThieuBanThan || '';
      const resolvedEducation = row.TrinhDoHocVan || '';
      const resolvedCreatedAt = firstDefined(row.HoSoNgayTao, row.NgayTao, row.NguoiDungNgayTao, '');
      const resolvedUpdatedAt = firstDefined(row.HoSoNgayCapNhat, row.NgayCapNhat, row.NguoiDungNgayCapNhat, '');

      return res.json({
        success: true,
        profile: {
          userId: resolvedUserId,
          email: resolvedEmail,
          fullName: resolvedFullName,
          phone: resolvedPhone,
          address: resolvedAddress,
          birthday: resolvedBirthday,
          gender: resolvedGender,
          city: resolvedCity,
          district: resolvedDistrict,
          avatarUrl: resolvedAvatar,
          avatarAbsoluteUrl: buildAbsoluteUrl(req, resolvedAvatar),
          position: resolvedPosition,
          personalLink: resolvedPersonalLink,
          introHtml: resolvedIntro,
          experienceYears: 0,
          education: resolvedEducation,
          educationList: [],
          workList: [],
          languageList: [],
          createdAt: resolvedCreatedAt,
          updatedAt: resolvedUpdatedAt,
          raw: {
            MaNguoiDung: resolvedUserId,
            HoTen: resolvedFullName,
            Email: resolvedEmail,
            SoDienThoai: resolvedPhone,
            NgaySinh: resolvedBirthday,
            GioiTinh: resolvedGender,
            DiaChi: resolvedAddress,
            ThanhPho: resolvedCity,
            QuanHuyen: resolvedDistrict,
            GioiThieuBanThan: resolvedIntro,
            SoNamKinhNghiem: 0,
            TrinhDoHocVan: resolvedEducation,
            AnhDaiDien: resolvedAvatar,
            ChucDanh: resolvedPosition,
            LinkCaNhan: resolvedPersonalLink,
            DanhSachHocVanJson: '[]',
            DanhSachKinhNghiemJson: '[]',
            DanhSachNgoaiNguJson: '[]',
            NgayTao: resolvedCreatedAt,
            NgayCapNhat: resolvedUpdatedAt
          }
        }
      });
    });
  });
});

module.exports = router;
