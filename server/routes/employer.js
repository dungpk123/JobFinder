const express = require('express');
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const getEmployerId = async (userId) => {
  const existing = await dbGet('SELECT MaNhaTuyenDung FROM NhaTuyenDung WHERE MaNguoiDung = ?', [userId]).catch(() => null);
  if (existing?.MaNhaTuyenDung) return Number(existing.MaNhaTuyenDung);
  return null;
};

router.get('/overview', authenticateToken, authorizeRole(['Nhà tuyển dụng']), async (req, res) => {
  try {
    const employerId = await getEmployerId(req.user.id);
    if (!employerId) {
      return res.json({
        success: true,
        stats: { jobs: 0, applications: 0, views: 0, savedCandidates: 0 }
      });
    }

    const jobsRow = await dbGet('SELECT COUNT(*) AS c FROM TinTuyenDung WHERE MaNhaTuyenDung = ?', [employerId]);
    const appsRow = await dbGet(
      `SELECT COUNT(*) AS c
       FROM UngTuyen ut
       JOIN TinTuyenDung ttd ON ttd.MaTin = ut.MaTin
       WHERE ttd.MaNhaTuyenDung = ?`,
      [employerId]
    );
    const viewsRow = await dbGet(
      'SELECT COALESCE(SUM(COALESCE(LuotXem, 0)), 0) AS s FROM TinTuyenDung WHERE MaNhaTuyenDung = ?',
      [employerId]
    );

    const savedRow = await dbGet(
      'SELECT COUNT(*) AS c FROM LuuCV WHERE MaNhaTuyenDung = ?',
      [employerId]
    ).catch(() => ({ c: 0 }));

    return res.json({
      success: true,
      stats: {
        jobs: jobsRow?.c != null ? Number(jobsRow.c) : 0,
        applications: appsRow?.c != null ? Number(appsRow.c) : 0,
        views: viewsRow?.s != null ? Number(viewsRow.s) : 0,
        savedCandidates: savedRow?.c != null ? Number(savedRow.c) : 0
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.get('/statistics', authenticateToken, authorizeRole(['Nhà tuyển dụng']), async (req, res) => {
  try {
    const employerId = await getEmployerId(req.user.id);
    if (!employerId) {
      return res.json({
        success: true,
        summary: { jobs: 0, applications: 0, views: 0, savedCandidates: 0, reports: 0 },
        jobs: []
      });
    }

    const jobs = await dbAll(
      `SELECT
          MaTin AS id,
          TieuDe AS title,
          COALESCE(LuotXem, 0) AS views,
          COALESCE(SoLuongUngTuyen, 0) AS applications,
          NgayDang AS postedAt,
          TrangThai AS status
       FROM TinTuyenDung
       WHERE MaNhaTuyenDung = ?
       ORDER BY COALESCE(LuotXem, 0) DESC, MaTin DESC`,
      [employerId]
    ).catch(() => []);

    const jobsRow = await dbGet('SELECT COUNT(*) AS c FROM TinTuyenDung WHERE MaNhaTuyenDung = ?', [employerId]);
    const appsRow = await dbGet(
      `SELECT COUNT(*) AS c
       FROM UngTuyen ut
       JOIN TinTuyenDung ttd ON ttd.MaTin = ut.MaTin
       WHERE ttd.MaNhaTuyenDung = ?`,
      [employerId]
    );
    const viewsRow = await dbGet(
      'SELECT COALESCE(SUM(COALESCE(LuotXem, 0)), 0) AS s FROM TinTuyenDung WHERE MaNhaTuyenDung = ?',
      [employerId]
    );
    const savedRow = await dbGet('SELECT COUNT(*) AS c FROM LuuCV WHERE MaNhaTuyenDung = ?', [employerId]).catch(() => ({ c: 0 }));
    const reportsRow = await dbGet(
      `SELECT COUNT(*) AS c
       FROM BaoCao
       WHERE LoaiDoiTuong = 'Công ty' AND MaDoiTuong = ?`,
      [employerId]
    ).catch(() => ({ c: 0 }));

    return res.json({
      success: true,
      summary: {
        jobs: jobsRow?.c != null ? Number(jobsRow.c) : 0,
        applications: appsRow?.c != null ? Number(appsRow.c) : 0,
        views: viewsRow?.s != null ? Number(viewsRow.s) : 0,
        savedCandidates: savedRow?.c != null ? Number(savedRow.c) : 0,
        reports: reportsRow?.c != null ? Number(reportsRow.c) : 0
      },
      jobs: Array.isArray(jobs) ? jobs.map((j) => ({
        id: j.id,
        title: j.title || 'Tin tuyển dụng',
        views: j.views != null ? Number(j.views) : 0,
        applications: j.applications != null ? Number(j.applications) : 0,
        postedAt: j.postedAt || '',
        status: j.status || ''
      })) : []
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

module.exports = router;
