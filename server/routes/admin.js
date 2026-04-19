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

const getCompanyWithOwner = async (id) => {
  return dbGet(
    `SELECT
        c.MaCongTy,
        c.TenCongTy,
        c.MaSoThue,
        c.DiaChi,
        c.ThanhPho,
        c.LinhVuc,
        c.MoTa,
        c.NgayTao,
        c.NgayCapNhat,
        c.Website,
        c.NguoiDaiDien,
        COALESCE(c.Logo, ntd.Logo) AS LogoCongTy,
        nd.TrangThai AS TrangThaiDaiDien,
        nd.Email AS EmailDaiDien,
        nd.HoTen AS TenNguoiDaiDien
     FROM CongTy c
     LEFT JOIN NguoiDung nd ON nd.MaNguoiDung = c.NguoiDaiDien
     LEFT JOIN NhaTuyenDung ntd ON ntd.MaNguoiDung = c.NguoiDaiDien
     WHERE c.MaCongTy = ?`,
    [id]
  );
};

const toInt = (v, def) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : def;
};

const cvStoragePath = path.join(__dirname, '../public/cvs');
const ONLINE_META_SUFFIX = '__online.json';
const buildOnlineMetaFilename = (cvFilename) => `${cvFilename}${ONLINE_META_SUFFIX}`;
const normalizeTemplateUsageKey = (value) => String(value || '').trim().toLowerCase();

const collectTemplateUsageByKey = async () => {
  const usageByKey = new Map();

  let rows = [];
  try {
    rows = await dbAll('SELECT TepCV FROM HoSoCV WHERE TepCV IS NOT NULL AND TepCV <> ?', ['']);
  } catch {
    return usageByKey;
  }

  for (const row of rows) {
    const rawFilename = String(row?.TepCV || '').trim();
    if (!rawFilename) continue;

    const filename = path.basename(rawFilename.replace(/\\/g, '/'));
    if (!filename || !/\.html?$/i.test(filename)) continue;

    const metaPath = path.join(cvStoragePath, buildOnlineMetaFilename(filename));
    if (!fs.existsSync(metaPath)) continue;

    let meta = null;
    try {
      meta = JSON.parse(String(fs.readFileSync(metaPath, 'utf8') || '{}'));
    } catch {
      continue;
    }

    const templateKey = normalizeTemplateUsageKey(meta?.templateKey);
    if (!templateKey) continue;

    usageByKey.set(templateKey, Number(usageByKey.get(templateKey) || 0) + 1);
  }

  return usageByKey;
};

const isMysql = /^mysql:\/\//i.test(process.env.DATABASE_URL || '');

const AUDIT_REQUIRED_COLUMNS = [
  'manhatkyquantri',
  'manguoidung',
  'hanhdong',
  'loaidoituong',
  'madoituong',
  'thoigianthaotac'
];
const AUDIT_LEGACY_COLUMNS = [
  'id',
  'user_id',
  'action',
  'entity_type',
  'entity_id',
  'timestamp',
  'manhatky',
  'maquantri',
  'doituong',
  'ghichu',
  'ngaythuchien'
];

const hasColumn = (columnSet, name) => columnSet.has(String(name || '').toLowerCase());

const getAuditSelectExpr = (columnSet, orderedCandidates, fallbackSql, quote) => {
  for (const candidate of orderedCandidates) {
    if (hasColumn(columnSet, candidate)) {
      return `${quote}${candidate}${quote}`;
    }
  }
  return fallbackSql;
};

let ensureAdminAuditTablePromise = null;
const ensureAdminAuditTable = async () => {
  if (ensureAdminAuditTablePromise) return ensureAdminAuditTablePromise;

  ensureAdminAuditTablePromise = (async () => {
    const needsAuditTableRebuild = (columnSet) => {
      const hasAllRequired = AUDIT_REQUIRED_COLUMNS.every((name) => hasColumn(columnSet, name));
      const hasLegacy = AUDIT_LEGACY_COLUMNS.some((name) => hasColumn(columnSet, name));
      return !hasAllRequired || hasLegacy;
    };

    if (isMysql) {
      const createMysqlAuditTableSql = `CREATE TABLE IF NOT EXISTS NhatKyQuanTri (
        MaNhatKyQuanTri INT AUTO_INCREMENT PRIMARY KEY,
        MaNguoiDung INT NULL,
        HanhDong VARCHAR(100) NULL,
        LoaiDoiTuong VARCHAR(100) NULL,
        MaDoiTuong INT NULL,
        ThoiGianThaoTac DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY IDX_NhatKyQuanTri_MaNguoiDung (MaNguoiDung),
        KEY IDX_NhatKyQuanTri_ThoiGianThaoTac (ThoiGianThaoTac)
      )`;

      await dbRun(createMysqlAuditTableSql);

      const mysqlColumns = await dbAll(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'NhatKyQuanTri'`
      );
      const mysqlColumnSet = new Set(
        mysqlColumns
          .map((col) => String(col?.COLUMN_NAME || '').trim().toLowerCase())
          .filter(Boolean)
      );

      if (needsAuditTableRebuild(mysqlColumnSet)) {
        const backupTable = `NhatKyQuanTri_legacy_${Date.now()}`;

        await dbRun(`RENAME TABLE NhatKyQuanTri TO \`${backupTable}\``);
        await dbRun(createMysqlAuditTableSql);

        const idExpr = getAuditSelectExpr(mysqlColumnSet, ['MaNhatKyQuanTri', 'id', 'MaNhatKy'], 'NULL', '`');
        const userIdExpr = getAuditSelectExpr(mysqlColumnSet, ['MaNguoiDung', 'user_id', 'MaQuanTri'], 'NULL', '`');
        const actionExpr = getAuditSelectExpr(mysqlColumnSet, ['HanhDong', 'action'], 'NULL', '`');
        const entityTypeExpr = getAuditSelectExpr(mysqlColumnSet, ['LoaiDoiTuong', 'entity_type', 'DoiTuong'], 'NULL', '`');
        const entityIdExpr = getAuditSelectExpr(mysqlColumnSet, ['MaDoiTuong', 'entity_id'], 'NULL', '`');
        const timestampExpr = getAuditSelectExpr(mysqlColumnSet, ['ThoiGianThaoTac', 'timestamp', 'NgayThucHien'], 'CURRENT_TIMESTAMP', '`');

        await dbRun(
          `INSERT INTO NhatKyQuanTri (MaNhatKyQuanTri, MaNguoiDung, HanhDong, LoaiDoiTuong, MaDoiTuong, ThoiGianThaoTac)
           SELECT
             ${idExpr},
             ${userIdExpr},
             ${actionExpr},
             ${entityTypeExpr},
             ${entityIdExpr},
             COALESCE(${timestampExpr}, CURRENT_TIMESTAMP)
           FROM \`${backupTable}\``
        );

        await dbRun(`DROP TABLE \`${backupTable}\``);
      }

      return;
    }

    const createSqliteAuditTableSql = `CREATE TABLE IF NOT EXISTS NhatKyQuanTri (
      MaNhatKyQuanTri INTEGER PRIMARY KEY AUTOINCREMENT,
      MaNguoiDung INTEGER NULL,
      HanhDong TEXT,
      LoaiDoiTuong TEXT,
      MaDoiTuong INTEGER NULL,
      ThoiGianThaoTac TEXT DEFAULT (datetime('now', 'localtime'))
    )`;

    await dbRun(createSqliteAuditTableSql);

    const sqliteColumns = await dbAll(`PRAGMA table_info('NhatKyQuanTri')`);
    const sqliteColumnSet = new Set(
      sqliteColumns
        .map((col) => String(col?.name || '').trim().toLowerCase())
        .filter(Boolean)
    );

    if (needsAuditTableRebuild(sqliteColumnSet)) {
      const backupTable = `NhatKyQuanTri_legacy_${Date.now()}`;

      await dbRun(`ALTER TABLE NhatKyQuanTri RENAME TO "${backupTable}"`);
      await dbRun(createSqliteAuditTableSql);

      const idExpr = getAuditSelectExpr(sqliteColumnSet, ['MaNhatKyQuanTri', 'id', 'MaNhatKy'], 'NULL', '"');
      const userIdExpr = getAuditSelectExpr(sqliteColumnSet, ['MaNguoiDung', 'user_id', 'MaQuanTri'], 'NULL', '"');
      const actionExpr = getAuditSelectExpr(sqliteColumnSet, ['HanhDong', 'action'], 'NULL', '"');
      const entityTypeExpr = getAuditSelectExpr(sqliteColumnSet, ['LoaiDoiTuong', 'entity_type', 'DoiTuong'], 'NULL', '"');
      const entityIdExpr = getAuditSelectExpr(sqliteColumnSet, ['MaDoiTuong', 'entity_id'], 'NULL', '"');
      const timestampExpr = getAuditSelectExpr(
        sqliteColumnSet,
        ['ThoiGianThaoTac', 'timestamp', 'NgayThucHien'],
        `datetime('now', 'localtime')`,
        '"'
      );

      await dbRun(
        `INSERT INTO NhatKyQuanTri (MaNhatKyQuanTri, MaNguoiDung, HanhDong, LoaiDoiTuong, MaDoiTuong, ThoiGianThaoTac)
         SELECT
           ${idExpr},
           ${userIdExpr},
           ${actionExpr},
           ${entityTypeExpr},
           ${entityIdExpr},
           COALESCE(${timestampExpr}, datetime('now', 'localtime'))
         FROM "${backupTable}"`
      );

      await dbRun(`DROP TABLE "${backupTable}"`);
    }
  })();

  try {
    await ensureAdminAuditTablePromise;
  } catch (err) {
    ensureAdminAuditTablePromise = null;
    throw err;
  }
};

const writeAdminAuditLog = ({ adminId, userId, action, entityType, object, entityId, objectId = null }) => {
  const actionText = String(action || '').trim();
  const entityTypeText = String(entityType || object || '').trim();
  if (!actionText || !entityTypeText) return Promise.resolve();

  const numericUserId = Number.isFinite(Number(userId)) ? Number(userId) : null;
  const numericAdminId = Number.isFinite(Number(adminId)) ? Number(adminId) : null;
  const normalizedUserId = numericUserId ?? numericAdminId;
  const normalizedEntityId = Number.isFinite(Number(entityId))
    ? Number(entityId)
    : (Number.isFinite(Number(objectId)) ? Number(objectId) : null);

  return ensureAdminAuditTable().then(() => dbRun(
    `INSERT INTO NhatKyQuanTri (MaNguoiDung, HanhDong, LoaiDoiTuong, MaDoiTuong, ThoiGianThaoTac)
     VALUES (?, ?, ?, ?, datetime('now', 'localtime'))`,
    [normalizedUserId, actionText, entityTypeText, normalizedEntityId]
  ));
};

const logAdminAction = async (payload) => {
  try {
    await writeAdminAuditLog(payload);
  } catch (err) {
    console.warn('[admin] Failed to write audit log:', err?.message || err);
  }
};

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

const SOFT_DELETE_RETENTION_HOURS = 72;
const SOFT_DELETE_RETENTION_MS = SOFT_DELETE_RETENTION_HOURS * 60 * 60 * 1000;

const parseDbDateTime = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value || '').trim();
  if (!raw) return null;

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const computeSoftDeleteMeta = (deletedAtValue, nowMs = Date.now()) => {
  const deletedAt = parseDbDateTime(deletedAtValue);
  if (!deletedAt) return null;

  const expiresMs = deletedAt.getTime() + SOFT_DELETE_RETENTION_MS;
  return {
    deletedAt: deletedAt.toISOString(),
    expiresAt: new Date(expiresMs).toISOString(),
    remainingMs: expiresMs - nowMs,
    isExpired: expiresMs <= nowMs
  };
};

const isMissingTableError = (err) => {
  const code = String(err?.code || '').toUpperCase();
  const message = String(err?.message || '').toLowerCase();
  return code === 'ER_NO_SUCH_TABLE'
    || message.includes('no such table')
    || message.includes("doesn't exist")
    || message.includes('unknown table');
};

const runDeleteIgnoreMissingTable = async (sql, params = []) => {
  try {
    return await dbRun(sql, params);
  } catch (err) {
    if (isMissingTableError(err)) {
      return { changes: 0 };
    }
    throw err;
  }
};

const deleteByNumericIds = async (tableName, columnName, ids) => {
  const cleaned = (ids || [])
    .map((id) => toInt(id, NaN))
    .filter((id) => Number.isFinite(id));
  if (!cleaned.length) return { changes: 0 };

  const placeholders = cleaned.map(() => '?').join(', ');
  return runDeleteIgnoreMissingTable(
    `DELETE FROM ${tableName} WHERE ${columnName} IN (${placeholders})`,
    cleaned
  );
};

const removeUserPermanently = async (userId) => {
  const id = toInt(userId, NaN);
  if (!Number.isFinite(id)) return false;

  const cvRows = await dbAll(
    'SELECT MaCV FROM HoSoCV WHERE MaNguoiDung = ?',
    [id]
  ).catch(() => []);
  const cvIds = cvRows
    .map((row) => toInt(row?.MaCV, NaN))
    .filter((item) => Number.isFinite(item));

  const employerRows = await dbAll(
    'SELECT MaNhaTuyenDung FROM NhaTuyenDung WHERE MaNguoiDung = ?',
    [id]
  ).catch(() => []);
  const employerIds = employerRows
    .map((row) => toInt(row?.MaNhaTuyenDung, NaN))
    .filter((item) => Number.isFinite(item));

  await runDeleteIgnoreMissingTable('DELETE FROM BinhLuanBaiVietHuongNghiep WHERE MaNguoiDung = ?', [id]);
  await runDeleteIgnoreMissingTable('DELETE FROM BaiVietHuongNghiep WHERE MaTacGia = ?', [id]);
  await runDeleteIgnoreMissingTable('DELETE FROM TinNhan WHERE MaNguoiGui = ? OR MaNguoiNhan = ?', [id, id]);

  for (const employerId of employerIds) {
    const jobRows = await dbAll(
      'SELECT MaTin FROM TinTuyenDung WHERE MaNhaTuyenDung = ?',
      [employerId]
    ).catch(() => []);
    const jobIds = jobRows
      .map((row) => toInt(row?.MaTin, NaN))
      .filter((item) => Number.isFinite(item));

    await deleteByNumericIds('LuuTin', 'MaTin', jobIds);
    await deleteByNumericIds('UngTuyen', 'MaTin', jobIds);
    await deleteByNumericIds('TinNhan', 'MaTin', jobIds);
    await deleteByNumericIds('ThongKeCongViec', 'MaTin', jobIds);
    await deleteByNumericIds('ChiTietTin_KyNang', 'MaTin', jobIds);
    await deleteByNumericIds('TinTuyenDung', 'MaTin', jobIds);

    await runDeleteIgnoreMissingTable('DELETE FROM LuuCV WHERE MaNhaTuyenDung = ?', [employerId]);
  }

  await deleteByNumericIds('UngTuyen', 'MaCV', cvIds);
  await deleteByNumericIds('LuuCV', 'MaCV', cvIds);

  await runDeleteIgnoreMissingTable('DELETE FROM UngTuyen WHERE MaUngVien = ?', [id]);
  await runDeleteIgnoreMissingTable('DELETE FROM LuuTin WHERE MaNguoiDung = ?', [id]);
  await runDeleteIgnoreMissingTable('DELETE FROM HoSoCV WHERE MaNguoiDung = ?', [id]);
  await runDeleteIgnoreMissingTable('DELETE FROM HoSoUngVien WHERE MaNguoiDung = ?', [id]);
  await runDeleteIgnoreMissingTable('DELETE FROM BaoCao WHERE MaNguoiBaoCao = ?', [id]);
  await runDeleteIgnoreMissingTable('DELETE FROM NhatKyQuanTri WHERE MaNguoiDung = ?', [id]);
  await runDeleteIgnoreMissingTable('DELETE FROM NhaTuyenDung WHERE MaNguoiDung = ?', [id]);
  await runDeleteIgnoreMissingTable('DELETE FROM CongTy WHERE NguoiDaiDien = ?', [id]);

  const result = await dbRun('DELETE FROM NguoiDung WHERE MaNguoiDung = ?', [id]);
  return Number(result?.changes || 0) > 0;
};

let purgeExpiredSoftDeletedUsersPromise = null;
const purgeExpiredSoftDeletedUsers = async () => {
  if (purgeExpiredSoftDeletedUsersPromise) return purgeExpiredSoftDeletedUsersPromise;

  purgeExpiredSoftDeletedUsersPromise = (async () => {
    try {
      await ensureNguoiDungNgayXoaColumn();

      const rows = await dbAll(
        `SELECT MaNguoiDung, Email, VaiTro, IFNULL(IsSuperAdmin, 0) AS IsSuperAdmin, NgayXoa
         FROM NguoiDung
         WHERE NgayXoa IS NOT NULL`
      );

      const nowMs = Date.now();
      const expiredUsers = rows.filter((row) => {
        if (Number(row?.IsSuperAdmin || 0) === 1) return false;
        if (String(row?.VaiTro || '').trim() === 'Quản trị') return false;

        const meta = computeSoftDeleteMeta(row?.NgayXoa, nowMs);
        return Boolean(meta?.isExpired);
      });

      for (const row of expiredUsers) {
        const targetId = toInt(row?.MaNguoiDung, NaN);
        if (!Number.isFinite(targetId)) continue;

        try {
          const deleted = await removeUserPermanently(targetId);
          if (deleted) {
            await writeAdminAuditLog({
              userId: null,
              action: `Xóa cứng người dùng quá hạn ${SOFT_DELETE_RETENTION_HOURS}h`,
              entityType: 'NguoiDung',
              entityId: targetId
            }).catch(() => null);
          }
        } catch (err) {
          console.warn(`[admin] Failed to hard-delete expired user ${targetId}:`, err?.message || err);
        }
      }
    } catch (err) {
      console.warn('[admin] Failed to purge expired soft-deleted users:', err?.message || err);
    }
  })();

  try {
    await purgeExpiredSoftDeletedUsersPromise;
  } finally {
    purgeExpiredSoftDeletedUsersPromise = null;
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
        PhongCachCV VARCHAR(50) NULL,
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
        PhongCachCV TEXT,
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

      const styleRow = await dbGet(
        `SELECT COUNT(*) AS c
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'CvTemplate'
           AND COLUMN_NAME = 'PhongCachCV'`
      );

      if (Number(styleRow?.c || 0) === 0) {
        await dbRun('ALTER TABLE CvTemplate ADD COLUMN PhongCachCV VARCHAR(50) NULL');
      }
      return;
    }

    const columns = await dbAll(`PRAGMA table_info('CvTemplate')`);
    const hasThumbnailUrl = columns.some((col) => String(col?.name || '').toLowerCase() === 'thumbnailurl');
    if (!hasThumbnailUrl) {
      await dbRun('ALTER TABLE CvTemplate ADD COLUMN ThumbnailUrl TEXT');
    }

    const hasTemplateStyle = columns.some((col) => String(col?.name || '').toLowerCase() === 'phongcachcv');
    if (!hasTemplateStyle) {
      await dbRun('ALTER TABLE CvTemplate ADD COLUMN PhongCachCV TEXT');
    }
  })();

  try {
    await ensureCvTemplateTablePromise;
  } catch (err) {
    ensureCvTemplateTablePromise = null;
    throw err;
  }
};

let ensureCareerGuideAdminSchemaPromise = null;
const ensureCareerGuideAdminSchema = async () => {
  if (ensureCareerGuideAdminSchemaPromise) return ensureCareerGuideAdminSchemaPromise;

  ensureCareerGuideAdminSchemaPromise = (async () => {
    if (isMysql) {
      await dbRun(`
        CREATE TABLE IF NOT EXISTS BaiVietHuongNghiep (
          MaBaiViet INT NOT NULL AUTO_INCREMENT,
          TieuDe VARCHAR(255) NOT NULL,
          NoiDung LONGTEXT NOT NULL,
          MaTacGia INT NOT NULL,
          LoaiTacGia VARCHAR(50) NOT NULL,
          NgayTao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          NgayCapNhat DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          LuotXem INT NOT NULL DEFAULT 0,
          PRIMARY KEY (MaBaiViet),
          KEY IDX_BaiVietHuongNghiep_MaTacGia (MaTacGia),
          CONSTRAINT FK_BaiVietHuongNghiep_TacGia
            FOREIGN KEY (MaTacGia) REFERENCES NguoiDung(MaNguoiDung)
        )
      `);

      await dbRun(`
        CREATE TABLE IF NOT EXISTS BinhLuanBaiVietHuongNghiep (
          MaBinhLuan INT NOT NULL AUTO_INCREMENT,
          MaBaiViet INT NOT NULL,
          MaNguoiDung INT NOT NULL,
          LoaiNguoiDung VARCHAR(50) NOT NULL,
          NoiDung LONGTEXT NOT NULL,
          NgayTao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (MaBinhLuan),
          KEY IDX_BinhLuanBaiVietHuongNghiep_MaBaiViet (MaBaiViet),
          KEY IDX_BinhLuanBaiVietHuongNghiep_MaNguoiDung (MaNguoiDung)
        )
      `);

      return;
    }

    await dbRun(`
      CREATE TABLE IF NOT EXISTS BaiVietHuongNghiep (
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
    await dbRun('CREATE INDEX IF NOT EXISTS IDX_BaiVietHuongNghiep_MaTacGia ON BaiVietHuongNghiep(MaTacGia)');

    await dbRun(`
      CREATE TABLE IF NOT EXISTS BinhLuanBaiVietHuongNghiep (
        MaBinhLuan INTEGER PRIMARY KEY AUTOINCREMENT,
        MaBaiViet INTEGER NOT NULL,
        MaNguoiDung INTEGER NOT NULL,
        LoaiNguoiDung TEXT NOT NULL,
        NoiDung TEXT NOT NULL,
        NgayTao TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (MaBaiViet) REFERENCES BaiVietHuongNghiep(MaBaiViet) ON DELETE CASCADE,
        FOREIGN KEY (MaNguoiDung) REFERENCES NguoiDung(MaNguoiDung) ON DELETE CASCADE
      )
    `);
    await dbRun('CREATE INDEX IF NOT EXISTS IDX_BinhLuanBaiVietHuongNghiep_MaBaiViet ON BinhLuanBaiVietHuongNghiep(MaBaiViet)');
    await dbRun('CREATE INDEX IF NOT EXISTS IDX_BinhLuanBaiVietHuongNghiep_MaNguoiDung ON BinhLuanBaiVietHuongNghiep(MaNguoiDung)');
  })();

  try {
    await ensureCareerGuideAdminSchemaPromise;
  } catch (err) {
    ensureCareerGuideAdminSchemaPromise = null;
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

const TEMPLATE_STYLE_KEYS = new Set(['professional', 'creative', 'minimal', 'modern']);
const normalizeTemplateStyle = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'professional';
  return TEMPLATE_STYLE_KEYS.has(normalized) ? normalized : 'professional';
};

const normalizeTemplateDocumentHtml = (html = '') => {
  const raw = String(html || '').trim();
  if (!raw) return '';

  const doctypeIndex = raw.search(/<!doctype\s+html/i);
  const htmlIndex = raw.search(/<html[\s>]/i);
  let startIndex = 0;

  if (doctypeIndex >= 0) startIndex = doctypeIndex;
  else if (htmlIndex >= 0) startIndex = htmlIndex;

  const sliced = raw.slice(startIndex).trimStart();
  const closeMatch = sliced.match(/<\/html\s*>/i);
  if (!closeMatch || typeof closeMatch.index !== 'number') return sliced;

  return sliced.slice(0, closeMatch.index + closeMatch[0].length);
};

const mapUserRow = (row) => {
  if (!row) return null;
  const softDeleteMeta = computeSoftDeleteMeta(row.NgayXoa);
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
    SoftDeleteExpiresAt: softDeleteMeta?.expiresAt || null,
    SoftDeleteRemainingMs: softDeleteMeta ? Math.max(softDeleteMeta.remainingMs, 0) : null,
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
  await purgeExpiredSoftDeletedUsers();

  const tables = [
    'NguoiDung',
    'CongTy',
    'NhaTuyenDung',
    'TinTuyenDung',
    'HoSoUngVien',
    'HoSoCV',
    'UngTuyen',
    'LuuTin',
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

router.get('/audit-logs', async (req, res) => {
  try {
    await ensureAdminAuditTable();

    const limit = Math.min(Math.max(toInt(req.query.limit, 30), 1), 200);
    const offset = Math.max(toInt(req.query.offset, 0), 0);
    const userId = req.query.userId != null
      ? toInt(req.query.userId, NaN)
      : (req.query.adminId != null ? toInt(req.query.adminId, NaN) : NaN);
    const action = String(req.query.action || '').trim();
    const entityType = String(req.query.entityType || req.query.object || '').trim();
    const entityId = req.query.entityId != null ? toInt(req.query.entityId, NaN) : NaN;
    const keyword = String(req.query.keyword || '').trim().toLowerCase();
    const fromDate = String(req.query.fromDate || '').trim();
    const toDate = String(req.query.toDate || '').trim();

    const whereParts = [];
    const params = [];

    if (Number.isFinite(userId)) {
      whereParts.push('nk.MaNguoiDung = ?');
      params.push(userId);
    }

    if (action) {
      whereParts.push('lower(IFNULL(nk.HanhDong, "")) = ?');
      params.push(action.toLowerCase());
    }

    if (entityType) {
      whereParts.push('lower(IFNULL(nk.LoaiDoiTuong, "")) = ?');
      params.push(entityType.toLowerCase());
    }

    if (Number.isFinite(entityId)) {
      whereParts.push('nk.MaDoiTuong = ?');
      params.push(entityId);
    }

    if (fromDate) {
      whereParts.push('nk.ThoiGianThaoTac >= ?');
      params.push(`${fromDate} 00:00:00`);
    }

    if (toDate) {
      whereParts.push('nk.ThoiGianThaoTac <= ?');
      params.push(`${toDate} 23:59:59`);
    }

    if (keyword) {
      const like = `%${keyword}%`;
      const entityIdTextExpr = isMysql ? 'CAST(nk.MaDoiTuong AS CHAR)' : 'CAST(nk.MaDoiTuong AS TEXT)';
      whereParts.push(`(
        lower(IFNULL(nk.HanhDong, "")) LIKE ?
        OR lower(IFNULL(nk.LoaiDoiTuong, "")) LIKE ?
        OR lower(IFNULL(${entityIdTextExpr}, "")) LIKE ?
        OR lower(IFNULL(nd.HoTen, "")) LIKE ?
        OR lower(IFNULL(nd.Email, "")) LIKE ?
      )`);
      params.push(like, like, like, like, like);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const rows = await dbAll(
      `SELECT
         nk.MaNhatKyQuanTri AS id,
         nk.MaNguoiDung AS user_id,
         nd.HoTen AS user_name,
         nd.Email AS user_email,
         nk.HanhDong AS action,
         nk.LoaiDoiTuong AS entity_type,
         nk.MaDoiTuong AS entity_id,
         nk.ThoiGianThaoTac AS timestamp
       FROM NhatKyQuanTri nk
       LEFT JOIN NguoiDung nd ON nd.MaNguoiDung = nk.MaNguoiDung
       ${whereSql}
       ORDER BY nk.ThoiGianThaoTac DESC, nk.MaNhatKyQuanTri DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const totalRow = await dbGet(
      `SELECT COUNT(*) AS c
       FROM NhatKyQuanTri nk
       LEFT JOIN NguoiDung nd ON nd.MaNguoiDung = nk.MaNguoiDung
       ${whereSql}`,
      params
    );

    return res.json({
      success: true,
      logs: rows,
      pagination: {
        limit,
        offset,
        total: Number(totalRow?.c || 0)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.delete('/audit-logs/:id', async (req, res) => {
  try {
    await ensureAdminAuditTable();

    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const result = await dbRun('DELETE FROM NhatKyQuanTri WHERE MaNhatKyQuanTri = ?', [id]);
    if (!Number(result?.changes || 0)) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy audit-log' });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.get('/users', async (req, res) => {
  try {
    await ensureNguoiDungNgayXoaColumn();
    await purgeExpiredSoftDeletedUsers();

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
    await purgeExpiredSoftDeletedUsers();

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
          hsv.LinkCaNhan,
          hsv.GioiThieuBanThan,
          hsv.AnhDaiDien,
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
        LinkCaNhan: row.LinkCaNhan || '',
        GioiThieuBanThan: row.GioiThieuBanThan || ''
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
    await purgeExpiredSoftDeletedUsers();

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

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Cập nhật người dùng',
      object: 'NguoiDung',
      objectId: id,
      note: {
        role: role ?? undefined,
        status: status ?? undefined
      }
    });

    const user = await getUserById(id);

    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await ensureNguoiDungNgayXoaColumn();
    await purgeExpiredSoftDeletedUsers();

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

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Xóa mềm người dùng',
      object: 'NguoiDung',
      objectId: id,
      note: {
        email: target.Email || ''
      }
    });

    const user = await getUserById(id);
    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.post('/users/:id/restore', async (req, res) => {
  try {
    await ensureNguoiDungNgayXoaColumn();
    await purgeExpiredSoftDeletedUsers();

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

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Khôi phục người dùng',
      object: 'NguoiDung',
      objectId: id
    });

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

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Cập nhật trạng thái tin tuyển dụng',
      object: 'TinTuyenDung',
      objectId: id,
      note: {
        status
      }
    });

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

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Xóa tin tuyển dụng',
      object: 'TinTuyenDung',
      objectId: id
    });

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
         c.DiaChi,
          c.ThanhPho,
         c.LinhVuc,
         c.MoTa,
         c.Logo,
          c.Website,
          c.NguoiDaiDien,
          c.NgayTao,
         c.NgayCapNhat,
         COALESCE(c.Logo, ntd.Logo) AS LogoCongTy,
          nd.TrangThai AS TrangThaiDaiDien,
          nd.Email AS EmailDaiDien,
          nd.HoTen AS TenNguoiDaiDien
       FROM CongTy c
       LEFT JOIN NguoiDung nd ON nd.MaNguoiDung = c.NguoiDaiDien
       LEFT JOIN NhaTuyenDung ntd ON ntd.MaNguoiDung = c.NguoiDaiDien
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

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Cập nhật trạng thái công ty',
      object: 'CongTy',
      objectId: id,
      note: {
        status,
        representativeUserId: company.NguoiDaiDien || null
      }
    });

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

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Xóa công ty',
      object: 'CongTy',
      objectId: id
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

const normalizeVietnameseText = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd');

const resolveReportTargetType = (rawType) => {
  const text = normalizeVietnameseText(rawType);
  if (!text) return 'unknown';

  if (text.includes('tin') || text.includes('tuyendung') || text.includes('job')) return 'job';
  if (text.includes('nguoidung') || text.includes('ungvien') || text.includes('user')) return 'user';
  if (text.includes('congty') || text.includes('company')) return 'company';
  return 'unknown';
};

const getReportById = (id) => dbGet(
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
   WHERE bc.MaBaoCao = ?`,
  [id]
);

const applyReportModerationActions = async ({ report, hideContent, lockEntity }) => {
  const moderation = {
    targetType: resolveReportTargetType(report?.LoaiDoiTuong),
    targetId: toInt(report?.MaDoiTuong, NaN),
    hideContentRequested: Boolean(hideContent),
    lockEntityRequested: Boolean(lockEntity),
    hideContentApplied: false,
    lockEntityApplied: false,
    warnings: []
  };

  if (!Number.isFinite(moderation.targetId)) {
    moderation.warnings.push('Mã đối tượng không hợp lệ');
    return moderation;
  }

  if (hideContent) {
    const hiddenText = '[Nội dung đã bị ẩn bởi quản trị viên]';

    if (moderation.targetType === 'job') {
      const result = await dbRun(
        `UPDATE TinTuyenDung
         SET MoTa = ?,
             YeuCau = '',
             QuyenLoi = '',
             TrangThai = 'Lưu trữ'
         WHERE MaTin = ?`,
        [hiddenText, moderation.targetId]
      );
      moderation.hideContentApplied = Number(result?.changes || 0) > 0;
    } else if (moderation.targetType === 'company') {
      const result = await dbRun(
        'UPDATE CongTy SET MoTa = ? WHERE MaCongTy = ?',
        [hiddenText, moderation.targetId]
      );
      moderation.hideContentApplied = Number(result?.changes || 0) > 0;
    } else if (moderation.targetType === 'user') {
      let totalChanges = 0;
      try {
        const profileResult = await dbRun(
          'UPDATE HoSoUngVien SET GioiThieuBanThan = ? WHERE MaNguoiDung = ?',
          [hiddenText, moderation.targetId]
        );
        totalChanges += Number(profileResult?.changes || 0);
      } catch {
        // HoSoUngVien may not exist for this account type.
      }

      const userResult = await dbRun(
        'UPDATE NguoiDung SET DiaChi = NULL, NgayCapNhat = datetime("now", "localtime") WHERE MaNguoiDung = ?',
        [moderation.targetId]
      );
      totalChanges += Number(userResult?.changes || 0);

      moderation.hideContentApplied = totalChanges > 0;
    } else {
      moderation.warnings.push('Không hỗ trợ ẩn nội dung cho loại đối tượng này');
    }

    if (!moderation.hideContentApplied && moderation.targetType !== 'unknown') {
      moderation.warnings.push('Không tìm thấy đối tượng để ẩn nội dung');
    }
  }

  if (lockEntity) {
    if (moderation.targetType === 'job') {
      const result = await dbRun(
        `UPDATE TinTuyenDung
         SET TrangThai = 'Đã đóng'
         WHERE MaTin = ?`,
        [moderation.targetId]
      );
      moderation.lockEntityApplied = Number(result?.changes || 0) > 0;
    } else if (moderation.targetType === 'user') {
      await ensureNguoiDungNgayXoaColumn();
      const result = await dbRun(
        `UPDATE NguoiDung
         SET TrangThai = 0,
             NgayXoa = COALESCE(NgayXoa, datetime("now", "localtime")),
             NgayCapNhat = datetime("now", "localtime")
         WHERE MaNguoiDung = ?`,
        [moderation.targetId]
      );
      moderation.lockEntityApplied = Number(result?.changes || 0) > 0;
    } else if (moderation.targetType === 'company') {
      const company = await getCompanyWithOwner(moderation.targetId);
      if (company?.NguoiDaiDien) {
        const result = await dbRun(
          'UPDATE NguoiDung SET TrangThai = 0, NgayCapNhat = datetime("now", "localtime") WHERE MaNguoiDung = ?',
          [company.NguoiDaiDien]
        );
        moderation.lockEntityApplied = Number(result?.changes || 0) > 0;
      } else {
        moderation.warnings.push('Công ty không có người đại diện để khóa');
      }
    } else {
      moderation.warnings.push('Không hỗ trợ khóa đối tượng cho loại này');
    }

    if (!moderation.lockEntityApplied && moderation.targetType !== 'unknown') {
      moderation.warnings.push('Không tìm thấy đối tượng để khóa');
    }
  }

  return moderation;
};

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

router.get('/career-guide-posts', async (req, res) => {
  try {
    await ensureCareerGuideAdminSchema();

    const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
    const offset = Math.max(toInt(req.query.offset, 0), 0);
    const keyword = String(req.query.keyword || '').trim().toLowerCase();

    const whereParts = [];
    const params = [];

    if (keyword) {
      const like = `%${keyword}%`;
      whereParts.push(`(
        lower(IFNULL(cg.TieuDe, "")) LIKE ?
        OR lower(IFNULL(cg.NoiDung, "")) LIKE ?
        OR lower(IFNULL(cg.LoaiTacGia, "")) LIKE ?
      )`);
      params.push(like, like, like);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const orderBy = isMysql
      ? 'cg.NgayCapNhat DESC, cg.MaBaiViet DESC'
      : 'datetime(cg.NgayCapNhat) DESC, cg.MaBaiViet DESC';

    const posts = await dbAll(
      `SELECT
          cg.MaBaiViet,
          cg.TieuDe,
          cg.NoiDung,
          cg.MaTacGia,
          cg.LoaiTacGia,
          cg.NgayTao,
          cg.NgayCapNhat,
          cg.LuotXem
      FROM BaiVietHuongNghiep cg
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const totalRow = await dbGet(
      `SELECT COUNT(*) AS c
       FROM BaiVietHuongNghiep cg
       ${whereSql}`,
      params
    );

    return res.json({
      success: true,
      posts,
      pagination: {
        limit,
        offset,
        total: Number(totalRow?.c || 0)
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.delete('/career-guide-posts/:id', async (req, res) => {
  try {
    await ensureCareerGuideAdminSchema();

    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ success: false, error: 'id không hợp lệ' });
    }

    const existing = await dbGet(
      'SELECT MaBaiViet FROM BaiVietHuongNghiep WHERE MaBaiViet = ?',
      [id]
    );
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    }

    await dbRun('DELETE FROM BinhLuanBaiVietHuongNghiep WHERE MaBaiViet = ?', [id]);
    await dbRun('DELETE FROM BaiVietHuongNghiep WHERE MaBaiViet = ?', [id]);

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Xóa bài viết hướng nghiệp',
      object: 'BaiVietHuongNghiep',
      objectId: id
    });

    return res.json({ success: true });
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

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Cập nhật trạng thái báo cáo',
      object: 'BaoCao',
      objectId: id,
      note: {
        status
      }
    });

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

router.post('/reports/:id/approve', async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const report = await getReportById(id);
    if (!report) return res.status(404).json({ success: false, error: 'Không tìm thấy báo cáo' });

    const hideContent = req.body?.hideContent === true;
    const lockEntity = req.body?.lockEntity === true;

    const moderation = await applyReportModerationActions({ report, hideContent, lockEntity });

    await dbRun(
      'UPDATE BaoCao SET TrangThai = ?, ChiTiet = COALESCE(ChiTiet, ?) WHERE MaBaoCao = ?',
      ['Đã xử lý', report?.ChiTiet || '', id]
    );

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Phê duyệt báo cáo',
      object: 'BaoCao',
      objectId: id,
      note: {
        targetType: report?.LoaiDoiTuong,
        targetId: report?.MaDoiTuong,
        hideContent,
        lockEntity,
        moderation
      }
    });

    const updatedReport = await getReportById(id);
    return res.json({
      success: true,
      report: updatedReport,
      moderation
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.delete('/reports/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const existing = await dbGet('SELECT MaBaoCao FROM BaoCao WHERE MaBaoCao = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy báo cáo' });

    await dbRun('DELETE FROM BaoCao WHERE MaBaoCao = ?', [id]);

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Xóa báo cáo',
      object: 'BaoCao',
      objectId: id
    });

    return res.json({ success: true });
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
          PhongCachCV,
          TrangThai,
          NgayTao,
          NgayCapNhat
       FROM CvTemplate
       ${whereSql}
       ORDER BY MaTemplateCV DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );

    const usageByKey = await collectTemplateUsageByKey();
    const templatesWithUsage = templates.map((template) => {
      const slugKey = normalizeTemplateUsageKey(template?.Slug);
      const idKey = normalizeTemplateUsageKey(template?.MaTemplateCV);
      const usage = Math.max(
        Number(slugKey ? usageByKey.get(slugKey) : 0) || 0,
        Number(idKey ? usageByKey.get(idKey) : 0) || 0
      );

      return {
        ...template,
        LuotSuDung: usage,
        SoLuotSuDung: usage
      };
    });

    const totalRow = await dbGet(
      `SELECT COUNT(*) AS c
       FROM CvTemplate
       ${whereSql}`,
      whereParams
    );

    return res.json({ success: true, templates: templatesWithUsage, total: Number(totalRow?.c || 0) });
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
          PhongCachCV,
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
    const style = normalizeTemplateStyle(req.body?.style ?? req.body?.PhongCachCV);
    const htmlContent = normalizeTemplateDocumentHtml(String(req.body?.htmlContent || ''));
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
        TenTemplate, Slug, MoTa, ThumbnailUrl, PhongCachCV, HtmlContent, TrangThai, NguoiTao, NguoiCapNhat, NgayTao, NgayCapNhat
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now", "localtime"), datetime("now", "localtime"))`,
      [name, slug, description || null, thumbnailUrl || null, style, htmlContent, status, req.user?.id || null, req.user?.id || null]
    );

    const template = await dbGet(
      `SELECT MaTemplateCV, TenTemplate, Slug, MoTa, ThumbnailUrl, PhongCachCV, HtmlContent, TrangThai, NgayTao, NgayCapNhat
       FROM CvTemplate
       WHERE lower(Slug) = ?`,
      [slug]
    );

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Tạo template CV',
      object: 'CvTemplate',
      objectId: template?.MaTemplateCV || null,
      note: {
        name,
        slug
      }
    });

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

    if (req.body?.style != null || req.body?.PhongCachCV != null) {
      fields.push('PhongCachCV = ?');
      params.push(normalizeTemplateStyle(req.body?.style ?? req.body?.PhongCachCV));
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
      const htmlContent = normalizeTemplateDocumentHtml(String(req.body.htmlContent || ''));
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
      `SELECT MaTemplateCV, TenTemplate, Slug, MoTa, ThumbnailUrl, PhongCachCV, HtmlContent, TrangThai, NgayTao, NgayCapNhat
       FROM CvTemplate
       WHERE MaTemplateCV = ?`,
      [id]
    );

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Cập nhật template CV',
      object: 'CvTemplate',
      objectId: id,
      note: {
        updatedFields: fields.filter((field) => !field.includes('NgayCapNhat') && !field.includes('NguoiCapNhat'))
      }
    });

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

    await logAdminAction({
      adminId: req.user?.id,
      action: 'Xóa template CV',
      object: 'CvTemplate',
      objectId: id
    });

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

module.exports = router;
