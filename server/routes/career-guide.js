const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/auth');
const { isCloudinaryConfigured, uploadImageFromPath } = require('../config/cloudinary');
const articleSamples = require('../mocks/articleSamples');

const isMysql = /^mysql:\/\//i.test(process.env.DATABASE_URL || '');

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
    db.run(sql, params, function runCallback(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const BASE_PATH = (() => {
  const basePath = process.env.BASE_PATH || '/';
  let normalized = basePath;
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
})();
const PUBLIC_PREFIX = BASE_PATH === '/' ? '' : BASE_PATH;

const isAbsoluteUrl = (value = '') => /^https?:\/\//i.test(value) || value.startsWith('//');
const buildAbsoluteUrl = (req, relativePath) => {
  if (!relativePath) return '';
  if (isAbsoluteUrl(relativePath)) {
    return relativePath.startsWith('//') ? `${req.protocol}:${relativePath}` : relativePath;
  }
  return `${req.protocol}://${req.get('host')}${relativePath}`;
};

const CAREER_GUIDE_IMAGE_DIR = path.join(__dirname, '../public/images/career-guide');
try {
  fs.mkdirSync(CAREER_GUIDE_IMAGE_DIR, { recursive: true });
} catch (err) {
  console.warn('[career-guide] cannot ensure upload directory:', err?.message || err);
}

const careerGuideImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CAREER_GUIDE_IMAGE_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const usage = String(req.query?.usage || 'inline').trim().toLowerCase() === 'cover' ? 'cover' : 'inline';
    const userId = Number(req.user?.id || 0);
    cb(null, `career_${usage}_${userId || 'user'}_${Date.now()}${ext}`);
  }
});

const careerGuideImageUpload = multer({
  storage: careerGuideImageStorage,
  limits: {
    fileSize: 8 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!String(file?.mimetype || '').startsWith('image/')) {
      return cb(new Error('Chỉ hỗ trợ tải lên file ảnh.'));
    }
    cb(null, true);
  }
});

const runCareerGuideImageUpload = (req, res, next) => {
  careerGuideImageUpload.single('upload')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'Kích thước ảnh tối đa là 8MB.' });
      }
      return res.status(400).json({ success: false, error: err.message || 'Upload ảnh không thành công.' });
    }

    return res.status(400).json({ success: false, error: err.message || 'Upload ảnh không thành công.' });
  });
};

const resolveCareerAuthorType = (role) => {
  const normalizedRole = String(role || '').trim();

  if (normalizedRole === 'Nhà tuyển dụng') {
    return 'employer';
  }

  if (normalizedRole === 'Quản trị' || normalizedRole === 'Siêu quản trị viên') {
    return 'admin';
  }

  return 'candidate';
};

const isCareerAdminRole = (role) => (
  role === 'Quản trị' || role === 'Siêu quản trị viên'
);

const normalizeCareerGuideStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'draft' ? 'draft' : 'published';
};

const normalizeCareerGuideTags = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(', ');
  }

  return String(value || '').trim();
};

const OPTIONAL_CAREER_GUIDE_COLUMNS = [
  { name: 'Slug', sqliteType: 'TEXT', mysqlType: 'VARCHAR(255) NULL' },
  { name: 'MoTaNgan', sqliteType: 'TEXT', mysqlType: 'TEXT NULL' },
  { name: 'DanhMuc', sqliteType: 'TEXT', mysqlType: 'VARCHAR(120) NULL' },
  { name: 'Tags', sqliteType: 'TEXT', mysqlType: 'TEXT NULL' },
  { name: 'AnhBia', sqliteType: 'TEXT', mysqlType: 'TEXT NULL' },
  { name: 'TrangThai', sqliteType: "TEXT DEFAULT 'published'", mysqlType: "VARCHAR(20) NOT NULL DEFAULT 'published'" }
];

let careerGuideColumnsCachePromise = null;

const clearCareerGuideColumnsCache = () => {
  careerGuideColumnsCachePromise = null;
};

const loadCareerGuideColumnSet = async () => {
  if (careerGuideColumnsCachePromise) {
    return careerGuideColumnsCachePromise;
  }

  careerGuideColumnsCachePromise = (async () => {
    if (isMysql) {
      const rows = await dbAll(
        `SELECT COLUMN_NAME AS columnName
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'CamNangNgheNghiep'`
      );

      return new Set(
        (rows || [])
          .map((row) => String(row?.columnName || '').trim().toLowerCase())
          .filter(Boolean)
      );
    }

    const rows = await dbAll(`PRAGMA table_info('CamNangNgheNghiep')`);
    return new Set(
      (rows || [])
        .map((row) => String(row?.name || '').trim().toLowerCase())
        .filter(Boolean)
    );
  })();

  try {
    return await careerGuideColumnsCachePromise;
  } catch (err) {
    careerGuideColumnsCachePromise = null;
    throw err;
  }
};

const selectCareerGuideColumn = (columnSet, columnName, alias, fallbackExpression = 'NULL') => {
  const hasColumn = columnSet.has(String(columnName || '').toLowerCase());
  return `${hasColumn ? `cg.${columnName}` : fallbackExpression} AS ${alias}`;
};

const buildCareerGuidePostSelectFields = (columnSet) => `
      cg.MaBaiViet AS id,
      cg.TieuDe AS title,
      cg.NoiDung AS content,
      cg.MaTacGia AS authorId,
      cg.LoaiTacGia AS authorType,
      cg.NgayTao AS createdAt,
      cg.NgayCapNhat AS updatedAt,
      cg.LuotXem AS views,
      ${selectCareerGuideColumn(columnSet, 'Slug', 'slug')},
      ${selectCareerGuideColumn(columnSet, 'MoTaNgan', 'excerpt')},
      ${selectCareerGuideColumn(columnSet, 'DanhMuc', 'category')},
      ${selectCareerGuideColumn(columnSet, 'Tags', 'tags')},
      ${selectCareerGuideColumn(columnSet, 'AnhBia', 'coverImage')},
      ${selectCareerGuideColumn(columnSet, 'TrangThai', 'status', "'published'")},
      0 AS isSample,
      CASE
        WHEN cg.LoaiTacGia = 'candidate' THEN COALESCE(u.HoTen, 'Ẩn danh')
        WHEN cg.LoaiTacGia = 'employer' THEN COALESCE(ntd.TenCongTy, u.HoTen, 'Nhà tuyển dụng')
        ELSE 'Admin'
      END AS authorName
`;

const ensureCareerGuideOptionalColumns = async () => {
  const columnSet = await loadCareerGuideColumnSet();

  for (const column of OPTIONAL_CAREER_GUIDE_COLUMNS) {
    const normalizedName = String(column.name || '').toLowerCase();
    if (columnSet.has(normalizedName)) continue;

    if (isMysql) {
      await dbRun(`ALTER TABLE CamNangNgheNghiep ADD COLUMN ${column.name} ${column.mysqlType}`);
    } else {
      await dbRun(`ALTER TABLE CamNangNgheNghiep ADD COLUMN ${column.name} ${column.sqliteType}`);
    }

    clearCareerGuideColumnsCache();
    const refreshed = await loadCareerGuideColumnSet();
    if (!refreshed.has(normalizedName)) {
      throw new Error(`Không thể tạo cột ${column.name} cho CamNangNgheNghiep`);
    }
  }
};

let ensureCareerGuideSchemaPromise = null;
const ensureCareerGuideSchema = async () => {
  if (ensureCareerGuideSchemaPromise) {
    return ensureCareerGuideSchemaPromise;
  }

  ensureCareerGuideSchemaPromise = (async () => {
    if (isMysql) {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS CamNangNgheNghiep (
          MaBaiViet INT NOT NULL AUTO_INCREMENT,
          TieuDe VARCHAR(255) NOT NULL,
          NoiDung LONGTEXT NOT NULL,
          MaTacGia INT NOT NULL,
          LoaiTacGia VARCHAR(50) NOT NULL,
          NgayTao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          NgayCapNhat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          LuotXem INT NOT NULL DEFAULT 0,
          PRIMARY KEY (MaBaiViet),
          KEY IDX_CamNangNgheNghiep_MaTacGia (MaTacGia),
          CONSTRAINT FK_CamNangNgheNghiep_TacGia FOREIGN KEY (MaTacGia) REFERENCES NguoiDung(MaNguoiDung)
        )
      `);

      await dbRun(`
        CREATE TABLE IF NOT EXISTS BinhLuanCamNangNgheNghiep (
          MaBinhLuan INT NOT NULL AUTO_INCREMENT,
          MaBaiViet INT NOT NULL,
          MaNguoiDung INT NOT NULL,
          LoaiNguoiDung VARCHAR(50) NOT NULL,
          NoiDung LONGTEXT NOT NULL,
          NgayTao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (MaBinhLuan),
          KEY IDX_BinhLuanCamNang_MaBaiViet (MaBaiViet),
          KEY IDX_BinhLuanCamNang_MaNguoiDung (MaNguoiDung)
        )
      `);
    } else {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS CamNangNgheNghiep (
          MaBaiViet INTEGER PRIMARY KEY AUTOINCREMENT,
          TieuDe TEXT NOT NULL,
          NoiDung TEXT NOT NULL,
          MaTacGia INTEGER NOT NULL,
          LoaiTacGia TEXT NOT NULL,
          NgayTao TEXT DEFAULT (datetime('now', 'localtime')),
          NgayCapNhat TEXT DEFAULT (datetime('now', 'localtime')),
          LuotXem INTEGER DEFAULT 0,
          FOREIGN KEY (MaTacGia) REFERENCES NguoiDung(MaNguoiDung) ON DELETE RESTRICT
        )
      `);

      await dbRun('CREATE INDEX IF NOT EXISTS IDX_CamNangNgheNghiep_MaTacGia ON CamNangNgheNghiep(MaTacGia)');

      await dbRun(`
        CREATE TABLE IF NOT EXISTS BinhLuanCamNangNgheNghiep (
          MaBinhLuan INTEGER PRIMARY KEY AUTOINCREMENT,
          MaBaiViet INTEGER NOT NULL,
          MaNguoiDung INTEGER NOT NULL,
          LoaiNguoiDung TEXT NOT NULL,
          NoiDung TEXT NOT NULL,
          NgayTao TEXT DEFAULT (datetime('now', 'localtime')),
          FOREIGN KEY (MaBaiViet) REFERENCES CamNangNgheNghiep(MaBaiViet) ON DELETE CASCADE,
          FOREIGN KEY (MaNguoiDung) REFERENCES NguoiDung(MaNguoiDung) ON DELETE CASCADE
        )
      `);

      await dbRun('CREATE INDEX IF NOT EXISTS IDX_BinhLuanCamNang_MaBaiViet ON BinhLuanCamNangNgheNghiep(MaBaiViet)');
      await dbRun('CREATE INDEX IF NOT EXISTS IDX_BinhLuanCamNang_MaNguoiDung ON BinhLuanCamNangNgheNghiep(MaNguoiDung)');
    }

    clearCareerGuideColumnsCache();
    await loadCareerGuideColumnSet();
    await ensureCareerGuideOptionalColumns();
    await ensureCareerCommentModerationColumn();
  })();

  try {
    await ensureCareerGuideSchemaPromise;
  } catch (err) {
    ensureCareerGuideSchemaPromise = null;
    throw err;
  }
};

const FORBIDDEN_CAREER_COMMENT_TERMS = [
  'lua dao',
  'lừa đảo',
  'lua bip',
  'lừa bịp',
  'oc cho',
  'óc chó',
  'suc vat',
  'súc vật',
  'khon nan',
  'khốn nạn',
  'dit',
  'địt',
  'dm',
  'đm',
  'vkl',
  'cac',
  'cặc',
  'lon',
  'lồn'
];

const normalizeTextForModeration = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const NORMALIZED_FORBIDDEN_TERMS = Array.from(
  new Set(FORBIDDEN_CAREER_COMMENT_TERMS.map(normalizeTextForModeration).filter(Boolean))
);

const detectForbiddenCareerTerms = (content) => {
  const normalizedContent = normalizeTextForModeration(content);
  if (!normalizedContent) {
    return { blocked: false, matches: [] };
  }

  const matches = NORMALIZED_FORBIDDEN_TERMS.filter((term) => {
    if (term.includes(' ')) {
      return normalizedContent.includes(term);
    }

    const pattern = new RegExp(`(^|\\s)${escapeRegExp(term)}(?=\\s|$)`, 'i');
    return pattern.test(normalizedContent);
  });

  return {
    blocked: matches.length > 0,
    matches
  };
};

let ensureCareerCommentModerationColumnPromise = null;
const ensureCareerCommentModerationColumn = async () => {
  if (ensureCareerCommentModerationColumnPromise) return ensureCareerCommentModerationColumnPromise;

  ensureCareerCommentModerationColumnPromise = (async () => {
    if (isMysql) {
      const tableExists = await dbGet(
        `SELECT COUNT(*) AS c
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'BinhLuanCamNangNgheNghiep'`
      );

      if (Number(tableExists?.c || 0) === 0) return;

      const column = await dbGet(
        `SELECT COUNT(*) AS c
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'BinhLuanCamNangNgheNghiep'
           AND COLUMN_NAME = 'BiAn'`
      );

      if (Number(column?.c || 0) === 0) {
        await dbRun('ALTER TABLE BinhLuanCamNangNgheNghiep ADD COLUMN BiAn TINYINT(1) NOT NULL DEFAULT 0');
      }

      return;
    }

    const table = await dbGet(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name = 'BinhLuanCamNangNgheNghiep'`
    );
    if (!table) return;

    const columns = await dbAll(`PRAGMA table_info('BinhLuanCamNangNgheNghiep')`);
    const hasBiAn = columns.some((col) => String(col?.name || '').toLowerCase() === 'bian');

    if (!hasBiAn) {
      await dbRun('ALTER TABLE BinhLuanCamNangNgheNghiep ADD COLUMN BiAn INTEGER DEFAULT 0');
    }
  })();

  try {
    await ensureCareerCommentModerationColumnPromise;
  } catch (err) {
    ensureCareerCommentModerationColumnPromise = null;
    throw err;
  }
};

const getSortedSamples = () => [...articleSamples]
  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

const mapSamplePost = (sample) => ({
  id: sample.id,
  slug: sample.slug,
  title: sample.title,
  excerpt: sample.excerpt,
  category: sample.category,
  tags: sample.tags,
  coverImage: sample.coverImage,
  content: sample.content,
  authorId: 0,
  authorType: 'admin',
  createdAt: sample.publishedAt,
  updatedAt: sample.publishedAt,
  views: Number(sample.views || 0),
  authorName: sample.author || 'Ban biên tập JobFinder',
  isSample: true
});

const findSamplePost = (idOrSlug) => articleSamples.find((sample) => (
  String(sample.id) === String(idOrSlug) || sample.slug === idOrSlug
));

const isMissingCareerGuideTableError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  if (!message) return false;

  const mentionsCareerGuideTable =
    message.includes('camnangnghenghiep')
    || message.includes('binhluancamnangnghenghiep')
    || message.includes('careerguide');

  return mentionsCareerGuideTable
    && (message.includes('no such table') || message.includes("doesn't exist"));
};

const sendSampleList = (res, { page, limit, offset }) => {
  const samples = getSortedSamples();
  const pagedSamples = samples.slice(offset, offset + limit).map(mapSamplePost);

  return res.json({
    success: true,
    posts: pagedSamples,
    pagination: {
      page,
      limit,
      total: samples.length,
      totalPages: Math.max(1, Math.ceil(samples.length / limit))
    }
  });
};

// Get all career guide posts with pagination
router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(30, parseInt(req.query.limit, 10) || 10));
  const offset = (page - 1) * limit;

  try {
    await ensureCareerGuideSchema();

    const columnSet = await loadCareerGuideColumnSet();
    const hasStatusColumn = columnSet.has('trangthai');
    const countRow = await dbGet(
      hasStatusColumn
        ? "SELECT COUNT(*) AS total FROM CamNangNgheNghiep WHERE COALESCE(TrangThai, 'published') = 'published'"
        : 'SELECT COUNT(*) AS total FROM CamNangNgheNghiep'
    );
    const total = Number(countRow?.total || 0);

    if (!total) {
      return sendSampleList(res, { page, limit, offset });
    }

    const statusWhereClause = hasStatusColumn
      ? "COALESCE(cg.TrangThai, 'published') = 'published'"
      : '1 = 1';

    const sql = `
      SELECT
        ${buildCareerGuidePostSelectFields(columnSet)}
      FROM CamNangNgheNghiep cg
      LEFT JOIN NguoiDung u ON cg.MaTacGia = u.MaNguoiDung
      LEFT JOIN NhaTuyenDung ntd ON ntd.MaNguoiDung = u.MaNguoiDung
      WHERE ${statusWhereClause}
      ORDER BY cg.NgayTao DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await dbAll(sql, [limit, offset]);

    return res.json({
      success: true,
      posts: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    if (isMissingCareerGuideTableError(error)) {
      return sendSampleList(res, { page, limit, offset });
    }
    return res.status(500).json({ success: false, error: 'Lỗi khi tải danh sách bài viết' });
  }
});

// Get current user's posts (authenticated)
router.get('/my-posts', authenticateToken, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(30, parseInt(req.query.limit, 10) || 10));
  const offset = (page - 1) * limit;

  const userId = Number(req.user?.id || 0);
  const userType = resolveCareerAuthorType(req.user?.role);

  try {
    await ensureCareerGuideSchema();
    const columnSet = await loadCareerGuideColumnSet();

    const countRow = await dbGet(
      `SELECT COUNT(*) AS total
       FROM CamNangNgheNghiep
       WHERE MaTacGia = ? AND LoaiTacGia = ?`,
      [userId, userType]
    );

    const total = Number(countRow?.total || 0);
    const rows = await dbAll(
      `SELECT
         ${buildCareerGuidePostSelectFields(columnSet)}
       FROM CamNangNgheNghiep cg
       LEFT JOIN NguoiDung u ON cg.MaTacGia = u.MaNguoiDung
       LEFT JOIN NhaTuyenDung ntd ON ntd.MaNguoiDung = u.MaNguoiDung
       WHERE cg.MaTacGia = ? AND cg.LoaiTacGia = ?
       ORDER BY cg.NgayCapNhat DESC, cg.NgayTao DESC
       LIMIT ? OFFSET ?`,
      [userId, userType, limit, offset]
    );

    return res.json({
      success: true,
      posts: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Lỗi khi tải bài viết của bạn' });
  }
});

router.post('/upload-image', authenticateToken, runCareerGuideImageUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Vui lòng chọn một ảnh để tải lên.' });
  }

  const usage = String(req.query?.usage || 'inline').trim().toLowerCase() === 'cover' ? 'cover' : 'inline';
  const localRelativeUrl = `${PUBLIC_PREFIX}/images/career-guide/${req.file.filename}`;

  try {
    if (isCloudinaryConfigured()) {
      const uploadResult = await uploadImageFromPath(req.file.path, {
        folder: usage === 'cover' ? 'jobfinder/career-guide/covers' : 'jobfinder/career-guide/content',
        public_id: `${usage}_${req.user?.id || 'user'}_${Date.now()}`
      });

      const cloudUrl = uploadResult?.secure_url || uploadResult?.url || '';
      if (!cloudUrl) {
        throw new Error('Cloudinary không trả về URL ảnh hợp lệ.');
      }

      if (req.file.path) {
        fs.unlink(req.file.path, () => {});
      }

      return res.json({
        success: true,
        url: cloudUrl,
        absoluteUrl: buildAbsoluteUrl(req, cloudUrl),
        source: 'cloudinary'
      });
    }

    return res.json({
      success: true,
      url: localRelativeUrl,
      absoluteUrl: buildAbsoluteUrl(req, localRelativeUrl),
      source: 'local'
    });
  } catch (error) {
    console.error('[career-guide] upload image failed:', error?.message || error);

    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, () => {});
    }

    return res.status(500).json({ success: false, error: 'Không thể tải ảnh lên. Vui lòng thử lại.' });
  }
});

// Get single post with comments
router.get('/:id', async (req, res) => {
  const rawIdentifier = String(req.params.id || '').trim();
  const trackViewFlag = String(req.query?.trackView ?? '1').trim().toLowerCase();
  const shouldTrackView = !['0', 'false', 'off', 'no'].includes(trackViewFlag);

  try {
    await ensureCareerGuideSchema();
    const columnSet = await loadCareerGuideColumnSet();

    const isNumericId = /^[0-9]+$/.test(rawIdentifier);
    let whereClause = '1 = 0';
    let whereParams = [];

    if (isNumericId) {
      whereClause = 'cg.MaBaiViet = ?';
      whereParams = [Number(rawIdentifier)];
    } else if (columnSet.has('slug')) {
      whereClause = 'cg.Slug = ?';
      whereParams = [rawIdentifier];
    }

    const post = whereClause === '1 = 0'
      ? null
      : await dbGet(
        `SELECT
           ${buildCareerGuidePostSelectFields(columnSet)}
         FROM CamNangNgheNghiep cg
         LEFT JOIN NguoiDung u ON cg.MaTacGia = u.MaNguoiDung
         LEFT JOIN NhaTuyenDung ntd ON ntd.MaNguoiDung = u.MaNguoiDung
         WHERE ${whereClause}
         LIMIT 1`,
        whereParams
      );

    if (!post) {
      const samplePost = findSamplePost(rawIdentifier);
      if (!samplePost) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
      }

      return res.json({
        success: true,
        post: mapSamplePost(samplePost),
        comments: []
      });
    }

    if (shouldTrackView) {
      await dbRun('UPDATE CamNangNgheNghiep SET LuotXem = LuotXem + 1 WHERE MaBaiViet = ?', [post.id]);
    }

    const comments = await dbAll(
      `SELECT
         cgc.MaBinhLuan AS id,
         cgc.NoiDung AS content,
         cgc.MaNguoiDung AS userId,
         cgc.LoaiNguoiDung AS userType,
         cgc.NgayTao AS createdAt,
         CASE
           WHEN cgc.LoaiNguoiDung = 'candidate' THEN COALESCE(u.HoTen, 'Ẩn danh')
           WHEN cgc.LoaiNguoiDung = 'employer' THEN COALESCE(ntd.TenCongTy, u.HoTen, 'Nhà tuyển dụng')
           ELSE 'Admin'
         END AS userName
       FROM BinhLuanCamNangNgheNghiep cgc
       LEFT JOIN NguoiDung u ON cgc.MaNguoiDung = u.MaNguoiDung
       LEFT JOIN NhaTuyenDung ntd ON ntd.MaNguoiDung = u.MaNguoiDung
       WHERE cgc.MaBaiViet = ? AND IFNULL(cgc.BiAn, 0) = 0
       ORDER BY cgc.NgayTao DESC`,
      [post.id]
    );

    return res.json({
      success: true,
      post: {
        ...post,
        views: Number(post.views || 0) + (shouldTrackView ? 1 : 0)
      },
      comments: comments || []
    });
  } catch (error) {
    if (isMissingCareerGuideTableError(error)) {
      const samplePost = findSamplePost(rawIdentifier);
      if (!samplePost) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
      }

      return res.json({
        success: true,
        post: mapSamplePost(samplePost),
        comments: []
      });
    }

    return res.status(500).json({ success: false, error: 'Lỗi khi tải bài viết' });
  }
});

// Create new post (authenticated)
router.post('/', authenticateToken, async (req, res) => {
  const title = String(req.body?.title || '').trim();
  const content = String(req.body?.content || '').trim();

  if (!title || !content) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin bài viết' });
  }

  const userId = Number(req.user?.id || 0);
  const userType = resolveCareerAuthorType(req.user?.role);

  try {
    await ensureCareerGuideSchema();
    const columnSet = await loadCareerGuideColumnSet();

    const insertColumns = ['TieuDe', 'NoiDung', 'MaTacGia', 'LoaiTacGia'];
    const insertValues = [title, content, userId, userType];

    const slug = String(req.body?.slug || '').trim();
    const excerpt = String(req.body?.excerpt || '').trim();
    const category = String(req.body?.category || '').trim();
    const tags = normalizeCareerGuideTags(req.body?.tags);
    const coverImage = String(req.body?.coverImage || '').trim();
    const status = normalizeCareerGuideStatus(req.body?.status);

    if (columnSet.has('slug')) {
      insertColumns.push('Slug');
      insertValues.push(slug || null);
    }

    if (columnSet.has('motangan')) {
      insertColumns.push('MoTaNgan');
      insertValues.push(excerpt || null);
    }

    if (columnSet.has('danhmuc')) {
      insertColumns.push('DanhMuc');
      insertValues.push(category || null);
    }

    if (columnSet.has('tags')) {
      insertColumns.push('Tags');
      insertValues.push(tags || null);
    }

    if (columnSet.has('anhbia')) {
      insertColumns.push('AnhBia');
      insertValues.push(coverImage || null);
    }

    if (columnSet.has('trangthai')) {
      insertColumns.push('TrangThai');
      insertValues.push(status);
    }

    const placeholders = insertColumns.map(() => '?').join(', ');
    const sql = `
      INSERT INTO CamNangNgheNghiep (${insertColumns.join(', ')})
      VALUES (${placeholders})
    `;

    const inserted = await dbRun(sql, insertValues);

    return res.json({
      success: true,
      postId: inserted.lastID,
      message: 'Đăng bài thành công'
    });
  } catch (error) {
    console.error('[career-guide] create post failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Lỗi khi tạo bài viết' });
  }
});

// Add comment (authenticated)
router.post('/:id/comments', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const rawIdentifier = String(id || '').trim();
  
  // Get user info from JWT token
  const userId = req.user.id;
  const userRole = req.user.role;
  
  // Determine userType based on role
  let userType = 'candidate';
  if (userRole === 'Nhà tuyển dụng') {
    userType = 'employer';
  } else if (userRole === 'Quản trị' || userRole === 'Siêu quản trị viên') {
    userType = 'admin';
  }

  const normalizedContent = String(content || '').trim();
  if (!normalizedContent) {
    return res.status(400).json({ success: false, error: 'Nội dung bình luận không được để trống' });
  }

  if (normalizedContent.length > 1000) {
    return res.status(400).json({ success: false, error: 'Nội dung bình luận quá dài (tối đa 1000 ký tự)' });
  }

  let isHidden = 0;

  const userIdAsNumber = Number(userId || 0);
  if (!Number.isInteger(userIdAsNumber) || userIdAsNumber <= 0) {
    return res.status(401).json({ success: false, error: 'Thông tin tài khoản không hợp lệ' });
  }

  try {
    await ensureCareerGuideSchema();
    await ensureCareerCommentModerationColumn();
    const columnSet = await loadCareerGuideColumnSet();
    const moderationResult = detectForbiddenCareerTerms(normalizedContent);
    isHidden = moderationResult.blocked ? 1 : 0;

    const isNumericId = /^[0-9]+$/.test(rawIdentifier);
    let postId = 0;

    if (isNumericId) {
      postId = Number(rawIdentifier);
    } else if (columnSet.has('slug')) {
      const matchedPost = await dbGet('SELECT MaBaiViet AS id FROM CamNangNgheNghiep WHERE Slug = ? LIMIT 1', [rawIdentifier]);
      postId = Number(matchedPost?.id || 0);
    }

    if (!Number.isInteger(postId) || postId <= 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết để bình luận' });
    }

    const nowExpression = isMysql ? 'NOW()' : "datetime('now')";
    const sql = `
      INSERT INTO BinhLuanCamNangNgheNghiep (MaBaiViet, MaNguoiDung, LoaiNguoiDung, NoiDung, BiAn, NgayTao)
      VALUES (?, ?, ?, ?, ?, ${nowExpression})
    `;

    const inserted = await dbRun(sql, [postId, userIdAsNumber, userType, normalizedContent, isHidden]);

    if (isHidden) {
      return res.json({
        success: true,
        commentId: inserted.lastID,
        hidden: true,
        message: 'Bình luận chứa từ ngữ không phù hợp nên đã được ẩn khỏi danh sách hiển thị.'
      });
    }

    return res.json({ success: true, commentId: inserted.lastID, hidden: false, message: 'Bình luận thành công' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Lỗi khi thêm bình luận' });
  }
});

// Update post (admin or author)
router.patch('/:id', authenticateToken, async (req, res) => {
  const postId = Number(req.params.id || 0);
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ success: false, error: 'Mã bài viết không hợp lệ' });
  }

  const userId = Number(req.user?.id || 0);
  const userRole = req.user?.role;
  const userType = resolveCareerAuthorType(userRole);
  const isAdmin = isCareerAdminRole(userRole);

  try {
    await ensureCareerGuideSchema();
    const columnSet = await loadCareerGuideColumnSet();

    const post = await dbGet(
      `SELECT MaTacGia AS authorId, LoaiTacGia AS authorType
       FROM CamNangNgheNghiep
       WHERE MaBaiViet = ?`,
      [postId]
    );

    if (!post) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    }

    const isAuthor = Number(post.authorId) === userId && post.authorType === userType;
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền sửa bài viết này' });
    }

    const updates = [];
    const params = [];
    let changedFieldCount = 0;

    if (Object.prototype.hasOwnProperty.call(req.body, 'title')) {
      const nextTitle = String(req.body?.title || '').trim();
      if (!nextTitle) {
        return res.status(400).json({ success: false, error: 'Tiêu đề không được để trống' });
      }
      updates.push('TieuDe = ?');
      params.push(nextTitle);
      changedFieldCount += 1;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'content')) {
      const nextContent = String(req.body?.content || '').trim();
      if (!nextContent) {
        return res.status(400).json({ success: false, error: 'Nội dung không được để trống' });
      }
      updates.push('NoiDung = ?');
      params.push(nextContent);
      changedFieldCount += 1;
    }

    if (columnSet.has('slug') && Object.prototype.hasOwnProperty.call(req.body, 'slug')) {
      updates.push('Slug = ?');
      params.push(String(req.body?.slug || '').trim() || null);
      changedFieldCount += 1;
    }

    if (columnSet.has('motangan') && Object.prototype.hasOwnProperty.call(req.body, 'excerpt')) {
      updates.push('MoTaNgan = ?');
      params.push(String(req.body?.excerpt || '').trim() || null);
      changedFieldCount += 1;
    }

    if (columnSet.has('danhmuc') && Object.prototype.hasOwnProperty.call(req.body, 'category')) {
      updates.push('DanhMuc = ?');
      params.push(String(req.body?.category || '').trim() || null);
      changedFieldCount += 1;
    }

    if (columnSet.has('tags') && Object.prototype.hasOwnProperty.call(req.body, 'tags')) {
      updates.push('Tags = ?');
      params.push(normalizeCareerGuideTags(req.body?.tags) || null);
      changedFieldCount += 1;
    }

    if (columnSet.has('anhbia') && Object.prototype.hasOwnProperty.call(req.body, 'coverImage')) {
      updates.push('AnhBia = ?');
      params.push(String(req.body?.coverImage || '').trim() || null);
      changedFieldCount += 1;
    }

    if (columnSet.has('trangthai') && Object.prototype.hasOwnProperty.call(req.body, 'status')) {
      updates.push('TrangThai = ?');
      params.push(normalizeCareerGuideStatus(req.body?.status));
      changedFieldCount += 1;
    }

    if (changedFieldCount === 0) {
      return res.status(400).json({ success: false, error: 'Không có dữ liệu để cập nhật' });
    }

    updates.push(`NgayCapNhat = ${isMysql ? 'NOW()' : "datetime('now')"}`);

    await dbRun(
      `UPDATE CamNangNgheNghiep
       SET ${updates.join(', ')}
       WHERE MaBaiViet = ?`,
      [...params, postId]
    );

    const updatedPost = await dbGet(
      `SELECT
         ${buildCareerGuidePostSelectFields(columnSet)}
       FROM CamNangNgheNghiep cg
       LEFT JOIN NguoiDung u ON cg.MaTacGia = u.MaNguoiDung
       LEFT JOIN NhaTuyenDung ntd ON ntd.MaNguoiDung = u.MaNguoiDung
       WHERE cg.MaBaiViet = ?`,
      [postId]
    );

    return res.json({
      success: true,
      message: 'Cập nhật bài viết thành công',
      post: updatedPost
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Lỗi khi cập nhật bài viết' });
  }
});

// Delete post (admin or author)
router.delete('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  // Get user info from JWT token
  const userId = req.user.id;
  const userRole = req.user.role;
  const isAdmin = userRole === 'Quản trị' || userRole === 'Siêu quản trị viên';
  
  // Determine userType based on role
  let userType = 'candidate';
  if (userRole === 'Nhà tuyển dụng') {
    userType = 'employer';
  } else if (isAdmin) {
    userType = 'admin';
  }

  // Check if user is author or admin
  const checkSql = 'SELECT MaTacGia as authorId, LoaiTacGia as authorType FROM CamNangNgheNghiep WHERE MaBaiViet = ?';
  
  db.get(checkSql, [id], (err, post) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Lỗi database' });
    }

    if (!post) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    }

    const isAuthor = Number(post.authorId) === Number(userId) && post.authorType === userType;
    
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa bài viết này' });
    }

    // Delete comments first
    db.run('DELETE FROM BinhLuanCamNangNgheNghiep WHERE MaBaiViet = ?', [id], (err) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Lỗi khi xóa bình luận' });
      }

      // Delete post
      db.run('DELETE FROM CamNangNgheNghiep WHERE MaBaiViet = ?', [id], function(err) {
        if (err) {
          return res.status(500).json({ success: false, error: 'Lỗi khi xóa bài viết' });
        }
        res.json({ success: true, message: 'Xóa bài viết thành công' });
      });
    });
  });
});

// Delete comment (admin or author)
router.delete('/:postId/comments/:commentId', authenticateToken, (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const isAdmin = userRole === 'Quản trị' || userRole === 'Siêu quản trị viên';

  let userType = 'candidate';
  if (userRole === 'Nhà tuyển dụng') {
    userType = 'employer';
  } else if (isAdmin) {
    userType = 'admin';
  }

  const checkSql = 'SELECT MaNguoiDung as userId, LoaiNguoiDung as userType FROM BinhLuanCamNangNgheNghiep WHERE MaBinhLuan = ?';
  
  db.get(checkSql, [commentId], (err, comment) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Lỗi database' });
    }

    if (!comment) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bình luận' });
    }

    const isAuthor = Number(comment.userId) === Number(userId) && comment.userType === userType;
    
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa bình luận này' });
    }

    db.run('DELETE FROM BinhLuanCamNangNgheNghiep WHERE MaBinhLuan = ?', [commentId], function(err) {
      if (err) {
        return res.status(500).json({ success: false, error: 'Lỗi khi xóa bình luận' });
      }

      res.json({ success: true, message: 'Xóa bình luận thành công' });
    });
  });
});

module.exports = router;
