const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { isCloudinaryConfigured, uploadImageFromPath } = require('../config/cloudinary');

const router = express.Router();

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const isAbsoluteUrl = (value = '') => /^https?:\/\//i.test(value) || value.startsWith('//');
const buildAbsoluteUrl = (req, relativePath) => {
  if (!relativePath) return '';
  if (isAbsoluteUrl(relativePath)) {
    return relativePath.startsWith('//') ? `${req.protocol}:${relativePath}` : relativePath;
  }
  return `${req.protocol}://${req.get('host')}${relativePath}`;
};

const parseJsonArray = (text) => {
  try {
    const parsed = JSON.parse(text || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getCompanyWithOwner = async (id) => {
  return dbGet(
    `SELECT
        c.MaCongTy,
        c.TenCongTy,
        c.MaSoThue,
        c.ThanhPho,
        c.Website,
        c.NguoiDaiDien,
        nd.TrangThai AS TrangThaiDaiDien,
        nd.Email AS EmailDaiDien,
        nd.HoTen AS TenNguoiDaiDien
     FROM CongTy c
     LEFT JOIN NguoiDung nd ON nd.MaNguoiDung = c.NguoiDaiDien
     WHERE c.MaCongTy = ?`,
    [id]
  );
};

const toInt = (v, def) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : def;
};

const isMysql = /^mysql:\/\//i.test(process.env.DATABASE_URL || '');

let ensureNguoiDungNgayXoaColumnPromise = null;
const ensureNguoiDungNgayXoaColumn = async () => {
  if (ensureNguoiDungNgayXoaColumnPromise) return ensureNguoiDungNgayXoaColumnPromise;

  ensureNguoiDungNgayXoaColumnPromise = (async () => {
    if (isMysql) {
      const row = await dbGet(
        `SELECT COUNT(*) AS c
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'NguoiDung'
           AND COLUMN_NAME = 'NgayXoa'`
      );
      if (Number(row?.c || 0) === 0) {
        await dbRun('ALTER TABLE NguoiDung ADD COLUMN NgayXoa DATETIME NULL');
      }
      return;
    }

    const columns = await dbAll(`PRAGMA table_info('NguoiDung')`);
    const hasNgayXoa = columns.some((col) => String(col?.name || '').toLowerCase() === 'ngayxoa');
    if (!hasNgayXoa) {
      await dbRun('ALTER TABLE NguoiDung ADD COLUMN NgayXoa TEXT');
    }
  })();

  try {
    await ensureNguoiDungNgayXoaColumnPromise;
  } catch (err) {
    ensureNguoiDungNgayXoaColumnPromise = null;
    throw err;
  }
};

let ensureCvTemplateTablePromise = null;
const ensureCvTemplateTable = async () => {
  if (ensureCvTemplateTablePromise) return ensureCvTemplateTablePromise;

  ensureCvTemplateTablePromise = (async () => {
    const mysqlSql = `
      CREATE TABLE IF NOT EXISTS CvTemplate (
        MaTemplateCV INT AUTO_INCREMENT PRIMARY KEY,
        TenTemplate VARCHAR(255) NOT NULL,
        Slug VARCHAR(191) NOT NULL UNIQUE,
        MoTa TEXT NULL,
        ThumbnailUrl TEXT NULL,
        HtmlContent LONGTEXT NOT NULL,
        TrangThai TINYINT DEFAULT 1,
        NguoiTao INT NULL,
        NguoiCapNhat INT NULL,
        NgayTao DATETIME DEFAULT CURRENT_TIMESTAMP,
        NgayCapNhat DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const sqliteSql = `
      CREATE TABLE IF NOT EXISTS CvTemplate (
        MaTemplateCV INTEGER PRIMARY KEY AUTOINCREMENT,
        TenTemplate TEXT NOT NULL,
        Slug TEXT NOT NULL UNIQUE,
        MoTa TEXT,
        ThumbnailUrl TEXT,
        HtmlContent TEXT NOT NULL,
        TrangThai INTEGER DEFAULT 1,
        NguoiTao INTEGER,
        NguoiCapNhat INTEGER,
        NgayTao TEXT DEFAULT (datetime('now', 'localtime')),
        NgayCapNhat TEXT DEFAULT (datetime('now', 'localtime'))
      )
    `;

    await dbRun(isMysql ? mysqlSql : sqliteSql);

    if (isMysql) {
      const row = await dbGet(
        `SELECT COUNT(*) AS c
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'CvTemplate'
           AND COLUMN_NAME = 'ThumbnailUrl'`
      );

      if (Number(row?.c || 0) === 0) {
        await dbRun('ALTER TABLE CvTemplate ADD COLUMN ThumbnailUrl TEXT NULL');
      }
      return;
    }

    const columns = await dbAll(`PRAGMA table_info('CvTemplate')`);
    const hasThumbnailUrl = columns.some((col) => String(col?.name || '').toLowerCase() === 'thumbnailurl');
    if (!hasThumbnailUrl) {
      await dbRun('ALTER TABLE CvTemplate ADD COLUMN ThumbnailUrl TEXT');
    }
  })();

  try {
    await ensureCvTemplateTablePromise;
  } catch (err) {
    ensureCvTemplateTablePromise = null;
    throw err;
  }
};

const normalizeSlug = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '');

const mapUserRow = (row) => {
  if (!row) return null;
  return {
    MaNguoiDung: row.MaNguoiDung,
    Email: row.Email,
    HoTen: row.HoTen,
    SoDienThoai: row.SoDienThoai,
    VaiTro: row.VaiTro,
    TrangThai: row.TrangThai,
    NgayTao: row.NgayTao,
    NgayCapNhat: row.NgayCapNhat,
    NgayXoa: row.NgayXoa || null,
    IsSuperAdmin: Number(row.IsSuperAdmin || 0)
  };
};

const getUserById = (id) => dbGet(
  `SELECT
      MaNguoiDung,
      Email,
      HoTen,
      SoDienThoai,
      CASE WHEN IFNULL(IsSuperAdmin, 0) = 1 THEN 'Siêu quản trị viên' ELSE VaiTro END AS VaiTro,
      TrangThai,
      NgayTao,
      NgayCapNhat,
      NgayXoa,
      IFNULL(IsSuperAdmin, 0) AS IsSuperAdmin
   FROM NguoiDung
   WHERE MaNguoiDung = ?`,
  [id]
).then(mapUserRow);

const cvTemplateThumbnailTmpDir = path.join(__dirname, '../public/images/template-thumbnails');
fs.mkdirSync(cvTemplateThumbnailTmpDir, { recursive: true });

const cvTemplateThumbnailStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, cvTemplateThumbnailTmpDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `cv_template_thumb_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const uploadCvTemplateThumbnail = multer({
  storage: cvTemplateThumbnailStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!String(file?.mimetype || '').startsWith('image/')) {
      return cb(new Error('Chỉ chấp nhận file ảnh cho thumbnail.'));
    }
    return cb(null, true);
  }
});

const handleCvTemplateThumbnailUpload = (req, res, next) => {
  uploadCvTemplateThumbnail.single('thumbnail')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'Kích thước ảnh không vượt quá 2MB.' });
    }

    return res.status(400).json({ success: false, error: err.message || 'Không thể tải ảnh lên.' });
  });
};

router.use(authenticateToken, authorizeRole(['Quản trị', 'Siêu quản trị viên']));

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ success: false, error: 'Chỉ Siêu quản trị viên mới có quyền thực hiện thao tác này' });
  }
  return next();
};

router.get('/overview', async (req, res) => {
  await ensureCvTemplateTable().catch(() => null);

  const tables = [
    'NguoiDung',
    'CongTy',
    'NhaTuyenDung',
    'TinTuyenDung',
    'HoSoUngVien',
    'HoSoCV',
    'UngTuyen',
    'LuuTin',
    'ThongBao',
    'BaoCao',
    'NhatKyQuanTri',
    'DanhMucCongViec',
    'KyNang',
    'CvTemplate'
  ];

  const counts = {};
  await Promise.all(
    tables.map(async (t) => {
      try {
        const row = await dbGet(`SELECT COUNT(*) AS c FROM ${t}`);
        counts[t] = row?.c != null ? Number(row.c) : 0;
      } catch {
        counts[t] = 0;
      }
    })
  );

  return res.json({ success: true, counts });
});

router.get('/users', async (req, res) => {
  try {
    await ensureNguoiDungNgayXoaColumn();

    const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
    const offset = Math.max(toInt(req.query.offset, 0), 0);

    const rows = await dbAll(
            `SELECT MaNguoiDung, Email, HoTen, SoDienThoai,
              CASE WHEN IFNULL(IsSuperAdmin, 0) = 1 THEN 'Siêu quản trị viên' ELSE VaiTro END AS VaiTro,
              TrangThai, NgayTao, NgayCapNhat, NgayXoa, IFNULL(IsSuperAdmin, 0) AS IsSuperAdmin
       FROM NguoiDung
       ORDER BY MaNguoiDung DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return res.json({ success: true, users: rows.map(mapUserRow) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.get('/users/:id/detail', async (req, res) => {
  try {
    await ensureNguoiDungNgayXoaColumn();

    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const row = await dbGet(
      `SELECT
          nd.MaNguoiDung,
          nd.Email,
          nd.HoTen,
          nd.SoDienThoai,
          nd.DiaChi,
          CASE WHEN IFNULL(nd.IsSuperAdmin, 0) = 1 THEN 'Siêu quản trị viên' ELSE nd.VaiTro END AS VaiTro,
          nd.TrangThai,
          nd.NgayTao,
          nd.NgayCapNhat,
          nd.NgayXoa,
          IFNULL(nd.IsSuperAdmin, 0) AS IsSuperAdmin,
          hsv.NgaySinh,
          hsv.GioiTinh,
          hsv.ThanhPho AS UngVienThanhPho,
          hsv.QuanHuyen AS UngVienQuanHuyen,
          hsv.DiaChi AS UngVienDiaChi,
          hsv.ChucDanh,
          hsv.TrinhDoHocVan,
          hsv.SoNamKinhNghiem,
          hsv.LinkCaNhan,
          hsv.GioiThieuBanThan,
          hsv.AnhDaiDien,
          hsv.EducationListJson,
          hsv.WorkListJson,
          hsv.LanguageListJson,
          ntd.MaNhaTuyenDung,
          COALESCE(ntd.TenCongTy, c.TenCongTy) AS TenCongTy,
          COALESCE(ntd.MaSoThue, c.MaSoThue) AS MaSoThue,
          COALESCE(ntd.Website, c.Website) AS Website,
          COALESCE(ntd.DiaChi, c.DiaChi) AS DiaChiCongTy,
          COALESCE(ntd.ThanhPho, c.ThanhPho) AS ThanhPhoCongTy,
          COALESCE(ntd.MoTa, c.MoTa) AS MoTaCongTy,
          COALESCE(ntd.Logo, c.Logo) AS LogoCongTy
       FROM NguoiDung nd
       LEFT JOIN HoSoUngVien hsv ON hsv.MaNguoiDung = nd.MaNguoiDung
       LEFT JOIN NhaTuyenDung ntd ON ntd.MaNguoiDung = nd.MaNguoiDung
       LEFT JOIN CongTy c ON c.NguoiDaiDien = nd.MaNguoiDung
       WHERE nd.MaNguoiDung = ?`,
      [id]
    );

    if (!row) return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });

    const avatarUrl = row.AnhDaiDien || row.LogoCongTy || '';
    const candidateProfile = row.ChucDanh
      || row.UngVienThanhPho
      || row.GioiThieuBanThan
      || row.NgaySinh
      || row.AnhDaiDien
      ? {
        NgaySinh: row.NgaySinh || null,
        GioiTinh: row.GioiTinh || '',
        ThanhPho: row.UngVienThanhPho || '',
        QuanHuyen: row.UngVienQuanHuyen || '',
        DiaChi: row.UngVienDiaChi || '',
        ChucDanh: row.ChucDanh || '',
        TrinhDoHocVan: row.TrinhDoHocVan || '',
        SoNamKinhNghiem: Number(row.SoNamKinhNghiem || 0),
        LinkCaNhan: row.LinkCaNhan || '',
        GioiThieuBanThan: row.GioiThieuBanThan || '',
        EducationList: parseJsonArray(row.EducationListJson),
        WorkList: parseJsonArray(row.WorkListJson),
        LanguageList: parseJsonArray(row.LanguageListJson)
      }
      : null;

    const employerProfile = row.TenCongTy
      || row.Website
      || row.DiaChiCongTy
      || row.ThanhPhoCongTy
      ? {
        MaNhaTuyenDung: row.MaNhaTuyenDung || null,
        TenCongTy: row.TenCongTy || '',
        MaSoThue: row.MaSoThue || '',
        Website: row.Website || '',
        DiaChi: row.DiaChiCongTy || '',
        ThanhPho: row.ThanhPhoCongTy || '',
        MoTa: row.MoTaCongTy || ''
      }
      : null;

    return res.json({
      success: true,
      detail: {
        user: mapUserRow(row),
        avatarUrl,
        avatarAbsoluteUrl: buildAbsoluteUrl(req, avatarUrl),
        candidateProfile,
        employerProfile
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    await ensureNguoiDungNgayXoaColumn();

    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const allowedRoles = ['Ứng viên', 'Nhà tuyển dụng', 'Quản trị'];
    const role = req.body?.role != null ? String(req.body.role) : null;
    const status = req.body?.status != null ? toInt(req.body.status, null) : null;

    if (role != null && !allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'VaiTro không hợp lệ' });
    }
    if (status != null && ![0, 1].includes(status)) {
      return res.status(400).json({ success: false, error: 'TrangThai không hợp lệ (0/1)' });
    }

    const target = await dbGet(
      'SELECT MaNguoiDung, VaiTro, IFNULL(IsSuperAdmin, 0) AS IsSuperAdmin FROM NguoiDung WHERE MaNguoiDung = ?',
      [id]
    );
    if (!target) return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });

    if (Number(target.IsSuperAdmin) === 1 || target.VaiTro === 'Quản trị') {
      return res.status(400).json({ success: false, error: 'Không thể chỉnh sửa tài khoản quản trị/siêu quản trị' });
    }

    const fields = [];
    const params = [];
    if (role != null) {
      fields.push('VaiTro = ?');
      params.push(role);
    }
    if (status != null) {
      fields.push('TrangThai = ?');
      params.push(status);
      if (status === 1) {
        fields.push('NgayXoa = NULL');
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có dữ liệu cập nhật' });
    }

    fields.push('NgayCapNhat = datetime("now", "localtime")');

    await dbRun(`UPDATE NguoiDung SET ${fields.join(', ')} WHERE MaNguoiDung = ?`, [...params, id]);

    const user = await getUserById(id);

    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await ensureNguoiDungNgayXoaColumn();

    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    if (req.user?.id === id) {
      return res.status(400).json({ success: false, error: 'Không thể tự xóa tài khoản của bạn' });
    }

    const target = await dbGet(
      'SELECT MaNguoiDung, Email, VaiTro, IFNULL(IsSuperAdmin, 0) AS IsSuperAdmin FROM NguoiDung WHERE MaNguoiDung = ?',
      [id]
    );
    if (!target) return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });

    if (Number(target.IsSuperAdmin) === 1 || target.VaiTro === 'Quản trị') {
      return res.status(400).json({ success: false, error: 'Không thể xóa tài khoản quản trị/siêu quản trị' });
    }

    await dbRun(
      `UPDATE NguoiDung
       SET TrangThai = 0,
           NgayXoa = COALESCE(NgayXoa, datetime("now", "localtime")),
           NgayCapNhat = datetime("now", "localtime")
       WHERE MaNguoiDung = ?`,
      [id]
    );

    const user = await getUserById(id);
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.post('/users/:id/restore', async (req, res) => {
  try {
    await ensureNguoiDungNgayXoaColumn();

    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const target = await dbGet(
      'SELECT MaNguoiDung, VaiTro, IFNULL(IsSuperAdmin, 0) AS IsSuperAdmin FROM NguoiDung WHERE MaNguoiDung = ?',
      [id]
    );
    if (!target) return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });

    if (Number(target.IsSuperAdmin) === 1 || target.VaiTro === 'Quản trị') {
      return res.status(400).json({ success: false, error: 'Không thể thao tác với tài khoản quản trị/siêu quản trị' });
    }

    await dbRun(
      `UPDATE NguoiDung
       SET TrangThai = 1,
           NgayXoa = NULL,
           NgayCapNhat = datetime("now", "localtime")
       WHERE MaNguoiDung = ?`,
      [id]
    );

    const user = await getUserById(id);
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
    const offset = Math.max(toInt(req.query.offset, 0), 0);

    const rows = await dbAll(
      `SELECT
          ttd.MaTin,
          ttd.TieuDe,
          ttd.ThanhPho,
          ttd.TrangThai,
          ttd.NgayDang,
          ntd.MaNhaTuyenDung,
          ntd.TenCongTy
       FROM TinTuyenDung ttd
       LEFT JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
       ORDER BY datetime(ttd.NgayDang) DESC, ttd.MaTin DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return res.json({ success: true, jobs: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.patch('/jobs/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const allowedStatuses = ['Nháp', 'Đã đăng', 'Đã đóng', 'Lưu trữ'];
    const status = String(req.body?.status || '').trim();
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'TrangThai không hợp lệ' });
    }

    const existing = await dbGet('SELECT MaTin FROM TinTuyenDung WHERE MaTin = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy tin tuyển dụng' });

    await dbRun(
      'UPDATE TinTuyenDung SET TrangThai = ? WHERE MaTin = ?',
      [status, id]
    );

    const job = await dbGet(
      `SELECT MaTin, TieuDe, ThanhPho, TrangThai, NgayDang, MaNhaTuyenDung
       FROM TinTuyenDung
       WHERE MaTin = ?`,
      [id]
    );

    return res.json({ success: true, job });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.delete('/jobs/:id', requireSuperAdmin, async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const existing = await dbGet('SELECT MaTin FROM TinTuyenDung WHERE MaTin = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy tin tuyển dụng' });

    await dbRun('DELETE FROM TinTuyenDung WHERE MaTin = ?', [id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.get('/companies', async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
    const offset = Math.max(toInt(req.query.offset, 0), 0);

    const rows = await dbAll(
      `SELECT
          c.MaCongTy,
          c.TenCongTy,
          c.MaSoThue,
          c.ThanhPho,
          c.Website,
          c.NguoiDaiDien,
          c.NgayTao,
          nd.TrangThai AS TrangThaiDaiDien,
          nd.Email AS EmailDaiDien,
          nd.HoTen AS TenNguoiDaiDien
       FROM CongTy c
       LEFT JOIN NguoiDung nd ON nd.MaNguoiDung = c.NguoiDaiDien
       ORDER BY c.MaCongTy DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return res.json({ success: true, companies: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.patch('/companies/:id', requireSuperAdmin, async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const status = req.body?.status != null ? toInt(req.body.status, null) : null;
    if (status == null || ![0, 1].includes(status)) {
      return res.status(400).json({ success: false, error: 'TrangThai không hợp lệ (0/1)' });
    }

    const company = await getCompanyWithOwner(id);
    if (!company) return res.status(404).json({ success: false, error: 'Không tìm thấy công ty' });

    if (company.NguoiDaiDien) {
      await dbRun(
        'UPDATE NguoiDung SET TrangThai = ?, NgayCapNhat = datetime("now", "localtime") WHERE MaNguoiDung = ?',
        [status, company.NguoiDaiDien]
      );
    }

    const updated = await getCompanyWithOwner(id);
    return res.json({ success: true, company: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.delete('/companies/:id', requireSuperAdmin, async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const company = await dbGet('SELECT MaCongTy FROM CongTy WHERE MaCongTy = ?', [id]);
    if (!company) return res.status(404).json({ success: false, error: 'Không tìm thấy công ty' });

    await dbRun('DELETE FROM CongTy WHERE MaCongTy = ?', [id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
    const offset = Math.max(toInt(req.query.offset, 0), 0);

    const rows = await dbAll(
      `SELECT
          bc.MaBaoCao,
          bc.MaNguoiBaoCao,
          nd.Email AS EmailNguoiBaoCao,
          bc.LoaiDoiTuong,
          bc.MaDoiTuong,
          bc.LyDo,
          bc.ChiTiet,
          bc.TrangThai,
          bc.NgayBaoCao
       FROM BaoCao bc
       LEFT JOIN NguoiDung nd ON nd.MaNguoiDung = bc.MaNguoiBaoCao
       ORDER BY datetime(bc.NgayBaoCao) DESC, bc.MaBaoCao DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return res.json({ success: true, reports: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const status = String(req.body?.status || '').trim();
    if (!status) return res.status(400).json({ success: false, error: 'TrangThai không hợp lệ' });

    const existing = await dbGet('SELECT MaBaoCao FROM BaoCao WHERE MaBaoCao = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy báo cáo' });

    await dbRun('UPDATE BaoCao SET TrangThai = ? WHERE MaBaoCao = ?', [status, id]);

    const report = await dbGet(
      `SELECT MaBaoCao, MaNguoiBaoCao, LoaiDoiTuong, MaDoiTuong, LyDo, ChiTiet, TrangThai, NgayBaoCao
       FROM BaoCao
       WHERE MaBaoCao = ?`,
      [id]
    );

    return res.json({ success: true, report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.get('/templates', async (req, res) => {
  try {
    await ensureCvTemplateTable();

    const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
    const offset = Math.max(toInt(req.query.offset, 0), 0);
    const search = String(req.query.search || '').trim().toLowerCase();

    const whereParts = [];
    const whereParams = [];

    if (search) {
      whereParts.push('(lower(TenTemplate) LIKE ? OR lower(Slug) LIKE ? OR lower(IFNULL(MoTa, "")) LIKE ?)');
      const like = `%${search}%`;
      whereParams.push(like, like, like);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const templates = await dbAll(
      `SELECT
          MaTemplateCV,
          TenTemplate,
          Slug,
          MoTa,
          ThumbnailUrl,
          TrangThai,
          NgayTao,
          NgayCapNhat
       FROM CvTemplate
       ${whereSql}
       ORDER BY MaTemplateCV DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );

    const totalRow = await dbGet(
      `SELECT COUNT(*) AS c
       FROM CvTemplate
       ${whereSql}`,
      whereParams
    );

    return res.json({ success: true, templates, total: Number(totalRow?.c || 0) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.get('/templates/:id', async (req, res) => {
  try {
    await ensureCvTemplateTable();

    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const template = await dbGet(
      `SELECT
          MaTemplateCV,
          TenTemplate,
          Slug,
          MoTa,
          ThumbnailUrl,
          HtmlContent,
          TrangThai,
          NgayTao,
          NgayCapNhat
       FROM CvTemplate
       WHERE MaTemplateCV = ?`,
      [id]
    );

    if (!template) return res.status(404).json({ success: false, error: 'Không tìm thấy template' });
    return res.json({ success: true, template });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.post('/templates/upload-thumbnail', handleCvTemplateThumbnailUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Thiếu file thumbnail.' });
  }

  if (!isCloudinaryConfigured()) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    return res.status(500).json({
      success: false,
      error: 'Cloudinary chưa được cấu hình trên server. Vui lòng cấu hình biến môi trường CLOUDINARY_*.'
    });
  }

  try {
    const uploadResult = await uploadImageFromPath(req.file.path, {
      folder: 'jobfinder/cv-template-thumbnails',
      public_id: `cv_template_thumb_${Date.now()}`
    });

    const thumbnailUrl = uploadResult?.secure_url || uploadResult?.url || '';
    if (!thumbnailUrl) {
      throw new Error('Cloudinary không trả về URL thumbnail.');
    }

    return res.json({
      success: true,
      thumbnailUrl,
      thumbnailAbsoluteUrl: buildAbsoluteUrl(req, thumbnailUrl)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Không thể upload thumbnail.' });
  } finally {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
  }
});

router.post('/templates', async (req, res) => {
  try {
    await ensureCvTemplateTable();

    const name = String(req.body?.name || '').trim();
    const slug = normalizeSlug(req.body?.slug || name);
    const description = String(req.body?.description || '').trim();
    const thumbnailUrl = String(req.body?.thumbnailUrl || req.body?.ThumbnailUrl || '').trim();
    const htmlContent = String(req.body?.htmlContent || '');
    const status = req.body?.status != null ? toInt(req.body.status, null) : 1;

    if (!name) return res.status(400).json({ success: false, error: 'Tên template là bắt buộc' });
    if (!slug) return res.status(400).json({ success: false, error: 'Slug không hợp lệ' });
    if (thumbnailUrl && !isAbsoluteUrl(thumbnailUrl)) return res.status(400).json({ success: false, error: 'Thumbnail URL không hợp lệ' });
    if (!htmlContent.trim()) return res.status(400).json({ success: false, error: 'HTML content là bắt buộc' });
    if (![0, 1].includes(status)) return res.status(400).json({ success: false, error: 'TrangThai không hợp lệ (0/1)' });

    const duplicate = await dbGet('SELECT MaTemplateCV FROM CvTemplate WHERE lower(Slug) = ?', [slug]);
    if (duplicate) {
      return res.status(409).json({ success: false, error: 'Slug đã tồn tại, vui lòng dùng slug khác' });
    }

    await dbRun(
      `INSERT INTO CvTemplate (
        TenTemplate, Slug, MoTa, ThumbnailUrl, HtmlContent, TrangThai, NguoiTao, NguoiCapNhat, NgayTao, NgayCapNhat
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now", "localtime"), datetime("now", "localtime"))`,
      [name, slug, description || null, thumbnailUrl || null, htmlContent, status, req.user?.id || null, req.user?.id || null]
    );

    const template = await dbGet(
      `SELECT MaTemplateCV, TenTemplate, Slug, MoTa, ThumbnailUrl, HtmlContent, TrangThai, NgayTao, NgayCapNhat
       FROM CvTemplate
       WHERE lower(Slug) = ?`,
      [slug]
    );

    return res.status(201).json({ success: true, template });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.patch('/templates/:id', async (req, res) => {
  try {
    await ensureCvTemplateTable();

    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const existing = await dbGet('SELECT MaTemplateCV, TenTemplate, Slug FROM CvTemplate WHERE MaTemplateCV = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy template' });

    const fields = [];
    const params = [];

    if (req.body?.name != null) {
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ success: false, error: 'Tên template là bắt buộc' });
      fields.push('TenTemplate = ?');
      params.push(name);
    }

    if (req.body?.slug != null || req.body?.name != null) {
      const nextName = req.body?.name != null ? String(req.body.name || '').trim() : existing.TenTemplate;
      const slug = normalizeSlug(req.body?.slug || nextName);
      if (!slug) return res.status(400).json({ success: false, error: 'Slug không hợp lệ' });

      const duplicate = await dbGet(
        'SELECT MaTemplateCV FROM CvTemplate WHERE lower(Slug) = ? AND MaTemplateCV <> ?',
        [slug, id]
      );
      if (duplicate) {
        return res.status(409).json({ success: false, error: 'Slug đã tồn tại, vui lòng dùng slug khác' });
      }

      fields.push('Slug = ?');
      params.push(slug);
    }

    if (req.body?.description != null) {
      fields.push('MoTa = ?');
      params.push(String(req.body.description || '').trim() || null);
    }

    if (req.body?.thumbnailUrl != null || req.body?.ThumbnailUrl != null) {
      const nextThumbnailUrl = String(req.body?.thumbnailUrl ?? req.body?.ThumbnailUrl ?? '').trim();
      if (nextThumbnailUrl && !isAbsoluteUrl(nextThumbnailUrl)) {
        return res.status(400).json({ success: false, error: 'Thumbnail URL không hợp lệ' });
      }
      fields.push('ThumbnailUrl = ?');
      params.push(nextThumbnailUrl || null);
    }

    if (req.body?.htmlContent != null) {
      const htmlContent = String(req.body.htmlContent || '');
      if (!htmlContent.trim()) return res.status(400).json({ success: false, error: 'HTML content là bắt buộc' });
      fields.push('HtmlContent = ?');
      params.push(htmlContent);
    }

    if (req.body?.status != null) {
      const status = toInt(req.body.status, null);
      if (![0, 1].includes(status)) return res.status(400).json({ success: false, error: 'TrangThai không hợp lệ (0/1)' });
      fields.push('TrangThai = ?');
      params.push(status);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có dữ liệu cập nhật' });
    }

    fields.push('NguoiCapNhat = ?');
    params.push(req.user?.id || null);
    fields.push('NgayCapNhat = datetime("now", "localtime")');

    await dbRun(`UPDATE CvTemplate SET ${fields.join(', ')} WHERE MaTemplateCV = ?`, [...params, id]);

    const template = await dbGet(
      `SELECT MaTemplateCV, TenTemplate, Slug, MoTa, ThumbnailUrl, HtmlContent, TrangThai, NgayTao, NgayCapNhat
       FROM CvTemplate
       WHERE MaTemplateCV = ?`,
      [id]
    );

    return res.json({ success: true, template });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    await ensureCvTemplateTable();

    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const existing = await dbGet('SELECT MaTemplateCV FROM CvTemplate WHERE MaTemplateCV = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy template' });

    await dbRun('DELETE FROM CvTemplate WHERE MaTemplateCV = ?', [id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

module.exports = router;
