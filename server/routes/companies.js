const express = require('express');
const db = require('../config/sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const ensureRatingTable = async () => {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS DanhGiaCongTy (
      MaDanhGia INTEGER PRIMARY KEY AUTOINCREMENT,
      MaNhaTuyenDung INTEGER NOT NULL,
      MaUngVien INTEGER NOT NULL,
      SoSao INTEGER NOT NULL CHECK(SoSao >= 1 AND SoSao <= 5),
      NgayDanhGia TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(MaNhaTuyenDung, MaUngVien)
    )`
  );
};

const ensureCommentTable = async () => {
  await dbRun(
    `CREATE TABLE IF NOT EXISTS BinhLuanCongTy (
      MaBinhLuan INTEGER PRIMARY KEY AUTOINCREMENT,
      MaNhaTuyenDung INTEGER NOT NULL,
      MaNguoiDung INTEGER NOT NULL,
      NoiDung TEXT NOT NULL,
      NgayTao TEXT DEFAULT (datetime('now','localtime'))
    )`
  );
};

const buildAbsoluteUrl = (req, relativePath) =>
  relativePath ? `${req.protocol}://${req.get('host')}${relativePath}` : '';

const normalizeLogoField = (req, row) => {
  if (!row) return row;
  const logo = row.Logo;
  if (logo && typeof logo === 'string' && logo.startsWith('/')) {
    return { ...row, Logo: buildAbsoluteUrl(req, logo) };
  }
  return row;
};

const getRatingSummary = async (employerId, userId = null) => {
  await ensureRatingTable();

  const summary = await dbGet(
    `SELECT
        ROUND(AVG(SoSao), 1) AS avgRating,
        COUNT(*) AS ratingCount
     FROM DanhGiaCongTy
     WHERE MaNhaTuyenDung = ?`,
    [employerId]
  );

  let userRating = null;
  if (userId) {
    const row = await dbGet(
      `SELECT SoSao FROM DanhGiaCongTy WHERE MaNhaTuyenDung = ? AND MaUngVien = ?`,
      [employerId, userId]
    );
    if (row && row.SoSao != null) userRating = Number(row.SoSao);
  }

  return {
    avgRating: summary?.avgRating != null ? Number(summary.avgRating) : 0,
    ratingCount: summary?.ratingCount != null ? Number(summary.ratingCount) : 0,
    userRating
  };
};

const listComments = async (employerId) => {
  await ensureCommentTable();
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT
          bl.MaBinhLuan AS id,
          bl.MaNguoiDung AS userId,
          nd.HoTen AS userName,
          bl.NoiDung AS content,
          bl.NgayTao AS createdAt
       FROM BinhLuanCongTy bl
       JOIN NguoiDung nd ON nd.MaNguoiDung = bl.MaNguoiDung
       WHERE bl.MaNhaTuyenDung = ?
       ORDER BY datetime(bl.NgayTao) DESC, bl.MaBinhLuan DESC
       LIMIT 50`,
      [employerId],
      (err, rows) => (err ? reject(err) : resolve(rows || []))
    );
  });
};

const insertCompanyReport = async ({ reporterId, employerId, reason, detail }) => {
  const sql = `INSERT INTO BaoCao (MaNguoiBaoCao, LoaiDoiTuong, MaDoiTuong, LyDo, ChiTiet, TrangThai, NgayBaoCao)
               VALUES (?, 'Công ty', ?, ?, ?, 'Chưa xử lý', datetime('now','localtime'))`;
  await dbRun(sql, [reporterId, employerId, reason, detail]);
};

// Public: list company comments
router.get('/:employerId/comments', async (req, res) => {
  try {
    const employerId = parseInt(req.params.employerId, 10);
    if (Number.isNaN(employerId)) {
      return res.status(400).json({ success: false, error: 'employerId không hợp lệ' });
    }

    const exists = await dbGet(
      'SELECT MaNhaTuyenDung FROM NhaTuyenDung WHERE MaNhaTuyenDung = ?',
      [employerId]
    );
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy công ty' });
    }

    const comments = await listComments(employerId);
    return res.json({ success: true, comments });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Candidate: add a comment
router.post('/:employerId/comments', authenticateToken, authorizeRole(['Ứng viên']), async (req, res) => {
  try {
    const employerId = parseInt(req.params.employerId, 10);
    if (Number.isNaN(employerId)) {
      return res.status(400).json({ success: false, error: 'employerId không hợp lệ' });
    }

    const content = String(req.body?.content || '').trim();
    if (!content) {
      return res.status(400).json({ success: false, error: 'Nội dung bình luận không được để trống' });
    }
    if (content.length > 1000) {
      return res.status(400).json({ success: false, error: 'Nội dung bình luận quá dài (tối đa 1000 ký tự)' });
    }

    const exists = await dbGet(
      'SELECT MaNhaTuyenDung FROM NhaTuyenDung WHERE MaNhaTuyenDung = ?',
      [employerId]
    );
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy công ty' });
    }

    await ensureCommentTable();
    await dbRun(
      `INSERT INTO BinhLuanCongTy (MaNhaTuyenDung, MaNguoiDung, NoiDung, NgayTao)
       VALUES (?, ?, ?, datetime('now','localtime'))`,
      [employerId, req.user.id, content]
    );

    const comments = await listComments(employerId);
    return res.json({ success: true, comments });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Candidate: report company with reason and detail
router.post('/:employerId/reports', authenticateToken, authorizeRole(['Ứng viên']), async (req, res) => {
  try {
    const employerId = parseInt(req.params.employerId, 10);
    if (Number.isNaN(employerId)) {
      return res.status(400).json({ success: false, error: 'employerId không hợp lệ' });
    }

    const reason = String(req.body?.reason || '').trim();
    const detail = String(req.body?.detail || '').trim();
    if (!reason) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn hoặc nhập lý do' });
    }
    if (reason.length > 200 || detail.length > 2000) {
      return res.status(400).json({ success: false, error: 'Nội dung báo cáo quá dài' });
    }

    const exists = await dbGet(
      'SELECT MaNhaTuyenDung FROM NhaTuyenDung WHERE MaNhaTuyenDung = ?',
      [employerId]
    );
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy công ty' });
    }

    await insertCompanyReport({
      reporterId: req.user.id,
      employerId,
      reason,
      detail
    });

    return res.json({ success: true, message: 'Đã gửi báo cáo. Chúng tôi sẽ xem xét.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Public: get company info + rating summary by employerId (MaNhaTuyenDung)
router.get('/:employerId', async (req, res) => {
  try {
    const employerId = parseInt(req.params.employerId, 10);
    if (Number.isNaN(employerId)) {
      return res.status(400).json({ success: false, error: 'employerId không hợp lệ' });
    }

    const company = await dbGet(
      `SELECT MaNhaTuyenDung, TenCongTy, Website, DiaChi, ThanhPho, MoTa, Logo
       FROM NhaTuyenDung
       WHERE MaNhaTuyenDung = ?`,
      [employerId]
    );

    if (!company) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy công ty' });
    }

    const rating = await getRatingSummary(employerId);

    return res.json({
      success: true,
      company: normalizeLogoField(req, company),
      rating
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Candidate: set/update rating (1..5)
router.post('/:employerId/ratings', authenticateToken, authorizeRole(['Ứng viên']), async (req, res) => {
  try {
    const employerId = parseInt(req.params.employerId, 10);
    if (Number.isNaN(employerId)) {
      return res.status(400).json({ success: false, error: 'employerId không hợp lệ' });
    }

    const stars = parseInt(req.body?.stars, 10);
    if (Number.isNaN(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ success: false, error: 'Số sao không hợp lệ (1-5)' });
    }

    await ensureRatingTable();

    // Ensure employer exists
    const exists = await dbGet(
      'SELECT MaNhaTuyenDung FROM NhaTuyenDung WHERE MaNhaTuyenDung = ?',
      [employerId]
    );
    if (!exists) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy công ty' });
    }

    await dbRun(
      `INSERT INTO DanhGiaCongTy (MaNhaTuyenDung, MaUngVien, SoSao, NgayDanhGia)
       VALUES (?, ?, ?, datetime('now','localtime'))
       ON CONFLICT(MaNhaTuyenDung, MaUngVien)
       DO UPDATE SET SoSao = excluded.SoSao, NgayDanhGia = datetime('now','localtime')`,
      [employerId, req.user.id, stars]
    );

    const rating = await getRatingSummary(employerId, req.user.id);
    return res.json({ success: true, rating });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

module.exports = router;
