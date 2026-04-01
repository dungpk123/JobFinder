const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const db = require('../config/db');
const router = express.Router();

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const BASE_PATH = (() => {
    const basePath = process.env.BASE_PATH || '/';
    let normalized = basePath;
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
})();
const PUBLIC_PREFIX = BASE_PATH === '/' ? '' : BASE_PATH;
const buildAbsoluteUrl = (req, relativePath) => (relativePath ? `${req.protocol}://${req.get('host')}${relativePath}` : '');
const buildCvRelativePath = (filename) => (filename ? `${PUBLIC_PREFIX}/cvs/${filename}` : '');
const normalizeLogoField = (req, row) => {
    if (!row) return row;
    const logo = row.Logo;
    if (logo && typeof logo === 'string' && logo.startsWith('/')) {
        return { ...row, Logo: buildAbsoluteUrl(req, logo) };
    }
    // Also allow old stored paths without leading slash
    if (logo && typeof logo === 'string' && (logo.startsWith(`${PUBLIC_PREFIX}/`) || logo.startsWith('images/'))) {
        const rel = logo.startsWith('/') ? logo : `/${logo}`;
        return { ...row, Logo: buildAbsoluteUrl(req, rel) };
    }
    return row;
};

const getOrCreateEmployerId = async (userId) => {
    const existing = await dbGet(
        'SELECT MaNhaTuyenDung FROM NhaTuyenDung WHERE MaNguoiDung = ?',[userId]
    );
    if (existing?.MaNhaTuyenDung) return existing.MaNhaTuyenDung;

    const company = await dbGet(
        'SELECT TenCongTy, MaSoThue, Website, DiaChi, ThanhPho, MoTa, Logo FROM CongTy WHERE NguoiDaiDien = ? ORDER BY MaCongTy DESC LIMIT 1',
        [userId]
    );

    const fallbackUser = await dbGet('SELECT HoTen FROM NguoiDung WHERE MaNguoiDung = ?', [userId]);
    const tenCongTy = company?.TenCongTy || fallbackUser?.HoTen || 'Nhà tuyển dụng';

    const inserted = await dbRun(
        `INSERT INTO NhaTuyenDung (MaNguoiDung, TenCongTy, MaSoThue, Website, DiaChi, ThanhPho, MoTa, Logo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            userId,
            tenCongTy,
            company?.MaSoThue || null,
            company?.Website || null,
            company?.DiaChi || null,
            company?.ThanhPho || null,
            company?.MoTa || null,
            company?.Logo || null
        ]
    );
    return inserted.lastID;
};

// Candidate: check if current user already applied to a job
router.get('/status', authenticateToken, authorizeRole(['Ứng viên']), async (req, res) => {
    const jobId = parseInt(req.query?.jobId, 10);
    if (Number.isNaN(jobId)) {
        return res.status(400).json({ error: 'jobId không hợp lệ' });
    }

    try {
        const row = await dbGet(
            `SELECT MaUngTuyen, TrangThai, NgayNop
             FROM UngTuyen
             WHERE MaTin = ? AND MaUngVien = ?
             ORDER BY datetime(NgayNop) DESC
             LIMIT 1`,
            [jobId, req.user.id]
        );

        if (!row) return res.json({ applied: false });
        return res.json({
            applied: true,
            application: {
                id: row.MaUngTuyen,
                status: row.TrangThai || null,
                submittedAt: row.NgayNop || null
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Apply for a job (candidate only)
router.post('/', authenticateToken, authorizeRole(['Ứng viên']), async (req, res) => {
    const { jobId, cvId, coverLetter } = req.body;

    if (!jobId) {
        return res.status(400).json({ error: 'Thiếu mã tin tuyển dụng (jobId)' });
    }

    try {
        const tin = await dbGet(
            `SELECT MaTin, TrangThai FROM TinTuyenDung WHERE MaTin = ?`,
            [jobId]
        );
        if (!tin) {
            return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });
        }
        if (tin.TrangThai !== 'Đã đăng') {
            return res.status(400).json({ error: 'Tin tuyển dụng chưa mở ứng tuyển' });
        }

        const existing = await dbGet(
            `SELECT MaUngTuyen, TrangThai, NgayNop
             FROM UngTuyen
             WHERE MaTin = ? AND MaUngVien = ?
             ORDER BY datetime(NgayNop) DESC
             LIMIT 1`,
            [jobId, req.user.id]
        );
        if (existing?.MaUngTuyen) {
            return res.status(409).json({
                error: 'Bạn đã ứng tuyển công việc này rồi.',
                applicationId: existing.MaUngTuyen,
                applied: true
            });
        }

        const inserted = await dbRun(
            `INSERT INTO UngTuyen (MaTin, MaCV, MaUngVien, ThuGioiThieu)
             VALUES (?, ?, ?, ?)`,
            [jobId, cvId || null, req.user.id, coverLetter || null]
        );

        // Best-effort increment
        await dbRun(
            'UPDATE TinTuyenDung SET SoLuongUngTuyen = COALESCE(SoLuongUngTuyen, 0) + 1 WHERE MaTin = ?',
            [jobId]
        ).catch(() => {});

        res.status(201).json({ message: 'Nộp hồ sơ thành công', applicationId: inserted.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Candidate: list my applications (jobs applied)
router.get('/mine', authenticateToken, authorizeRole(['Ứng viên']), async (req, res) => {
    try {
        const rows = await dbAll(
            `SELECT
                ut.MaUngTuyen,
                ut.MaTin,
                ut.MaCV,
                ut.TrangThai,
                ut.NgayNop,
                ttd.TieuDe,
                ttd.ThanhPho,
                ttd.DiaDiem,
                ttd.HinhThuc,
                ttd.LuongTu,
                ttd.LuongDen,
                ttd.KieuLuong,
                ntd.TenCongTy,
                ntd.Logo
             FROM UngTuyen ut
             JOIN TinTuyenDung ttd ON ttd.MaTin = ut.MaTin
             JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
             WHERE ut.MaUngVien = ?
             ORDER BY datetime(ut.NgayNop) DESC`,
            [req.user.id]
        );

        return res.json(rows.map((r) => normalizeLogoField(req, r)));
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Get applications for employer
router.get('/', authenticateToken, authorizeRole(['Nhà tuyển dụng']), async (req, res) => {
    try {
        const employerId = await getOrCreateEmployerId(req.user.id);
        const rows = await dbAll(
            `SELECT
                ut.MaUngTuyen,
                ut.MaTin,
                ut.MaCV,
                ut.MaUngVien,
                ut.ThuGioiThieu,
                ut.TrangThai,
                ut.NgayNop,
                ttd.TieuDe,
                nd.HoTen AS TenUngVien,
                nd.Email AS EmailUngVien,
                cv.TepCV AS CvTepCV,
                cv.TieuDe AS CvTieuDe
             FROM UngTuyen ut
             JOIN TinTuyenDung ttd ON ttd.MaTin = ut.MaTin
             JOIN NguoiDung nd ON nd.MaNguoiDung = ut.MaUngVien
             LEFT JOIN HoSoCV cv ON cv.MaCV = ut.MaCV
             WHERE ttd.MaNhaTuyenDung = ?
             ORDER BY datetime(ut.NgayNop) DESC`,
            [employerId]
        );
        const mapped = rows.map((r) => {
            const rel = buildCvRelativePath(r.CvTepCV);
            return {
                ...r,
                CvFileUrl: rel,
                CvFileAbsoluteUrl: rel ? buildAbsoluteUrl(req, rel) : ''
            };
        });
        res.json(mapped);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update application status (employer)
router.patch('/:id', authenticateToken, authorizeRole(['Nhà tuyển dụng']), async (req, res) => {
    try {
        const appId = parseInt(req.params.id, 10);
        if (Number.isNaN(appId)) {
            return res.status(400).json({ error: 'ID không hợp lệ' });
        }

        const { status } = req.body;
        if (!status || typeof status !== 'string') {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
        }

        const trimmedStatus = status.trim();
        const allowedStatuses = ['Đã nộp', 'Đang xem xét', 'Phỏng vấn', 'Đề nghị', 'Từ chối', 'Rút hồ sơ', 'Đã nhận'];
        if (!allowedStatuses.includes(trimmedStatus)) {
            return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
        }

        const employerId = await getOrCreateEmployerId(req.user.id);

        // Verify employer owns this application
        const app = await dbGet(
            `SELECT ut.MaUngTuyen
             FROM UngTuyen ut
             JOIN TinTuyenDung ttd ON ttd.MaTin = ut.MaTin
             WHERE ut.MaUngTuyen = ? AND ttd.MaNhaTuyenDung = ?`,
            [appId, employerId]
        );

        if (!app) {
            return res.status(404).json({ error: 'Không tìm thấy hồ sơ hoặc bạn không có quyền' });
        }

        await dbRun('UPDATE UngTuyen SET TrangThai = ? WHERE MaUngTuyen = ?', [trimmedStatus, appId]);

        res.json({ success: true, message: 'Đã cập nhật trạng thái' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;