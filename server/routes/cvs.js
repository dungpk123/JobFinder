const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

const BASE_PATH = (() => {
    const basePath = process.env.BASE_PATH || '/';
    let normalized = basePath;
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
})();
const PUBLIC_PREFIX = BASE_PATH === '/' ? '' : BASE_PATH;

const cvStoragePath = path.join(__dirname, '../public/cvs');
fs.mkdirSync(cvStoragePath, { recursive: true });

const buildCvRelativePath = (filename) => `${PUBLIC_PREFIX}/cvs/${filename}`;
const buildAbsoluteUrl = (req, relativePath) => (relativePath ? `${req.protocol}://${req.get('host')}${relativePath}` : '');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, cvStoragePath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const userId = req.body.userId || 'guest';
        const timestamp = Date.now();
        cb(null, `cv_${userId}_${timestamp}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error('Chỉ chấp nhận file PDF hoặc Word.'));
        }
        cb(null, true);
    }
});

const safeJsonParse = (value) => {
    try {
        if (value == null) return null;
        if (typeof value === 'object') return value;
        return JSON.parse(String(value));
    } catch {
        return null;
    }
};

const ONLINE_META_SUFFIX = '__online.json';
const buildOnlineMetaFilename = (cvFilename) => `${cvFilename}${ONLINE_META_SUFFIX}`;

const normalizeTemplateKey = (value) => {
    const v = String(value || '').trim();
    if (!v) return 'accent-one';
    const ok = /^[a-z0-9-]{1,50}$/i.test(v);
    return ok ? v : 'accent-one';
};

const isMysql = /^mysql:\/\//i.test(process.env.DATABASE_URL || '');

const toInt = (value, fallback) => {
    const num = parseInt(String(value ?? ''), 10);
    return Number.isFinite(num) ? num : fallback;
};

const sqlGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});

const sqlAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
});

const sqlRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
    });
});

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

        await sqlRun(isMysql ? mysqlSql : sqliteSql);

        if (isMysql) {
            const row = await sqlGet(
                `SELECT COUNT(*) AS c
                 FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = 'CvTemplate'
                   AND COLUMN_NAME = 'ThumbnailUrl'`
            );

            if (Number(row?.c || 0) === 0) {
                await sqlRun('ALTER TABLE CvTemplate ADD COLUMN ThumbnailUrl TEXT NULL');
            }
            return;
        }

        const columns = await sqlAll(`PRAGMA table_info('CvTemplate')`);
        const hasThumbnailUrl = columns.some((col) => String(col?.name || '').toLowerCase() === 'thumbnailurl');
        if (!hasThumbnailUrl) {
            await sqlRun('ALTER TABLE CvTemplate ADD COLUMN ThumbnailUrl TEXT');
        }
    })();

    try {
        await ensureCvTemplateTablePromise;
    } catch (err) {
        ensureCvTemplateTablePromise = null;
        throw err;
    }
};

router.get('/templates', async (req, res) => {
    try {
        await ensureCvTemplateTable();

        const limit = Math.min(Math.max(toInt(req.query.limit, 24), 1), 80);
        const offset = Math.max(toInt(req.query.offset, 0), 0);

        const templates = await sqlAll(
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
             WHERE IFNULL(TrangThai, 1) = 1
             ORDER BY MaTemplateCV DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const totalRow = await sqlGet(
            `SELECT COUNT(*) AS c
             FROM CvTemplate
             WHERE IFNULL(TrangThai, 1) = 1`
        );

        return res.json({ success: true, templates, total: Number(totalRow?.c || 0) });
    } catch (err) {
        console.error('Lỗi lấy danh sách template công khai:', err);
        return res.status(500).json({ success: false, error: 'Không tải được danh sách template' });
    }
});

router.get('/', (req, res) => {
    const userId = parseInt(req.query.userId, 10);
    if (isNaN(userId)) {
        return res.status(400).json({ success: false, error: 'userId không hợp lệ' });
    }

    db.all(
        'SELECT * FROM HoSoCV WHERE MaNguoiDung = ? ORDER BY NgayCapNhat DESC',
        [userId],
        (err, rows) => {
            if (err) {
                console.error('Lỗi lấy CV:', err);
                return res.status(500).json({ success: false, error: 'Lỗi truy vấn CV' });
            }

            const cvs = rows.map(row => {
                const filename = row.TepCV || '';
                const relative = filename ? buildCvRelativePath(filename) : '';
                const absolute = buildAbsoluteUrl(req, relative);
                const diskPath = filename ? path.join(cvStoragePath, filename) : '';
                let sizeLabel = '0 KB';
                if (diskPath && fs.existsSync(diskPath)) {
                    const stats = fs.statSync(diskPath);
                    sizeLabel = `${(stats.size / 1024).toFixed(2)} KB`;
                }
                return {
                    id: row.MaCV,
                    name: row.TieuDe || filename || 'CV',
                    summary: row.TomTat || '',
                    fileUrl: relative,
                    fileAbsoluteUrl: absolute,
                    size: sizeLabel,
                    uploadDate: row.NgayCapNhat || row.NgayTao || '',
                    isDefault: row.MacDinh === 1
                };
            });

            return res.json({ success: true, cvs });
        }
    );
});

router.post('/', upload.single('cvFile'), (req, res) => {
    const { userId, cvTitle, summary } = req.body;
    const file = req.file;
    const numUserId = parseInt(userId, 10);

    if (!file || isNaN(numUserId)) {
        return res.status(400).json({ success: false, error: 'Thiếu userId hoặc file chi tiết' });
    }

    const filename = file.filename;
    const relative = buildCvRelativePath(filename);
    const absolute = buildAbsoluteUrl(req, relative);

    db.run(
        `INSERT INTO HoSoCV (MaNguoiDung, TieuDe, TomTat, TepCV, NgayTao, NgayCapNhat)
         VALUES (?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
        [
            numUserId,
            cvTitle || file.originalname,
            summary || '',
            filename
        ],
        function (err) {
            if (err) {
                console.error('Lỗi lưu CV:', err);
                return res.status(500).json({ success: false, error: 'Lỗi lưu CV vào cơ sở dữ liệu' });
            }

            return res.status(201).json({
                success: true,
                cv: {
                    id: this.lastID,
                    name: cvTitle || file.originalname,
                    summary: summary || '',
                    fileUrl: relative,
                    fileAbsoluteUrl: absolute,
                    size: `${(file.size / 1024).toFixed(2)} KB`,
                    uploadDate: new Date().toISOString(),
                    isDefault: 0
                }
            });
        }
    );
});

// ===== Online CV (editable on web) =====
// Stores a rendered HTML file in /public/cvs and a sidecar JSON file with editable content.
router.post('/online', async (req, res) => {
    try {
        const numUserId = parseInt(req.body?.userId, 10);
        if (Number.isNaN(numUserId)) return res.status(400).json({ success: false, error: 'userId không hợp lệ' });

        const title = String(req.body?.title || '').trim();
        if (!title) return res.status(400).json({ success: false, error: 'Thiếu tiêu đề CV' });

        const summary = String(req.body?.summary || '').trim();
        const content = safeJsonParse(req.body?.content) || {};
        const templateKey = normalizeTemplateKey(req.body?.templateKey);
        const html = String(req.body?.html || '').trim();
        if (!html) return res.status(400).json({ success: false, error: 'Thiếu nội dung CV' });

        const existingCvId = req.body?.cvId != null ? parseInt(req.body.cvId, 10) : null;

        // If updating: ensure the CV belongs to the user, then replace files and update DB.
        if (existingCvId && !Number.isNaN(existingCvId)) {
            db.get(
                'SELECT TepCV FROM HoSoCV WHERE MaCV = ? AND MaNguoiDung = ?',
                [existingCvId, numUserId],
                (err, row) => {
                    if (err) {
                        console.error('Lỗi kiểm tra CV online:', err);
                        return res.status(500).json({ success: false, error: 'Lỗi truy vấn CV' });
                    }
                    if (!row) return res.status(404).json({ success: false, error: 'CV không tồn tại' });

                    const oldFilename = row.TepCV || '';
                    const ext = '.html';
                    const filename = `cv_online_${numUserId}_${Date.now()}${ext}`;

                    const htmlPath = path.join(cvStoragePath, filename);
                    const metaPath = path.join(cvStoragePath, buildOnlineMetaFilename(filename));
                    fs.writeFileSync(htmlPath, html, 'utf8');
                    fs.writeFileSync(metaPath, JSON.stringify({ title, summary, templateKey, content }, null, 2), 'utf8');

                    // Clean up old files (best effort)
                    if (oldFilename) {
                        try { fs.unlinkSync(path.join(cvStoragePath, oldFilename)); } catch {}
                        try { fs.unlinkSync(path.join(cvStoragePath, buildOnlineMetaFilename(oldFilename))); } catch {}
                    }

                    db.run(
                        `UPDATE HoSoCV
                         SET TieuDe = ?, TomTat = ?, TepCV = ?, NgayCapNhat = datetime('now', 'localtime')
                         WHERE MaCV = ? AND MaNguoiDung = ?`,
                        [title, summary, filename, existingCvId, numUserId],
                        function (uErr) {
                            if (uErr) {
                                console.error('Lỗi update CV online:', uErr);
                                return res.status(500).json({ success: false, error: 'Không thể lưu CV online' });
                            }

                            const relative = buildCvRelativePath(filename);
                            const absolute = buildAbsoluteUrl(req, relative);
                            return res.json({
                                success: true,
                                cv: {
                                    id: existingCvId,
                                    name: title,
                                    summary,
                                    fileUrl: relative,
                                    fileAbsoluteUrl: absolute
                                }
                            });
                        }
                    );
                }
            );
            return;
        }

        // Create new online CV
        const filename = `cv_online_${numUserId}_${Date.now()}.html`;
        const htmlPath = path.join(cvStoragePath, filename);
        const metaPath = path.join(cvStoragePath, buildOnlineMetaFilename(filename));

        fs.writeFileSync(htmlPath, html, 'utf8');
        fs.writeFileSync(metaPath, JSON.stringify({ title, summary, templateKey, content }, null, 2), 'utf8');

        const relative = buildCvRelativePath(filename);
        const absolute = buildAbsoluteUrl(req, relative);

        db.run(
            `INSERT INTO HoSoCV (MaNguoiDung, TieuDe, TomTat, TepCV, NgayTao, NgayCapNhat)
             VALUES (?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`,
            [numUserId, title, summary, filename],
            function (err) {
                if (err) {
                    console.error('Lỗi lưu CV online:', err);
                    return res.status(500).json({ success: false, error: 'Không thể lưu CV online' });
                }

                return res.status(201).json({
                    success: true,
                    cv: {
                        id: this.lastID,
                        name: title,
                        summary,
                        fileUrl: relative,
                        fileAbsoluteUrl: absolute
                    }
                });
            }
        );
    } catch (err) {
        console.error('Lỗi POST /online:', err);
        return res.status(500).json({ success: false, error: err.message || 'Lỗi server' });
    }
});

// Load online CV content (for editing)
router.get('/online/:cvId', (req, res) => {
    const cvId = parseInt(req.params.cvId, 10);
    const userId = parseInt(req.query.userId, 10);
    if (Number.isNaN(cvId) || Number.isNaN(userId)) {
        return res.status(400).json({ success: false, error: 'Id không hợp lệ' });
    }

    db.get('SELECT TieuDe, TomTat, TepCV FROM HoSoCV WHERE MaCV = ? AND MaNguoiDung = ?', [cvId, userId], (err, row) => {
        if (err) {
            console.error('Lỗi load CV online:', err);
            return res.status(500).json({ success: false, error: 'Lỗi truy vấn CV' });
        }
        if (!row) return res.status(404).json({ success: false, error: 'CV không tồn tại' });

        const filename = row.TepCV || '';
        if (!filename.endsWith('.html')) {
            return res.status(400).json({ success: false, error: 'CV này không phải CV online' });
        }

        const metaFile = path.join(cvStoragePath, buildOnlineMetaFilename(filename));
        let meta = {};
        if (fs.existsSync(metaFile)) {
            meta = safeJsonParse(fs.readFileSync(metaFile, 'utf8')) || {};
        }

        return res.json({
            success: true,
            cv: {
                id: cvId,
                title: row.TieuDe || meta.title || 'CV Online',
                summary: row.TomTat || meta.summary || '',
                templateKey: normalizeTemplateKey(meta.templateKey),
                content: meta.content || {}
            }
        });
    });
});

router.delete('/:cvId', (req, res) => {
    const cvId = parseInt(req.params.cvId, 10);
    const userId = parseInt(req.query.userId, 10);

    if (isNaN(cvId) || isNaN(userId)) {
        return res.status(400).json({ success: false, error: 'Id không hợp lệ' });
    }

    db.get('SELECT TepCV FROM HoSoCV WHERE MaCV = ? AND MaNguoiDung = ?', [cvId, userId], (err, row) => {
        if (err) {
            console.error('Lỗi kiểm tra CV:', err);
            return res.status(500).json({ success: false, error: 'Lỗi truy vấn CV' });
        }
        if (!row) {
            return res.status(404).json({ success: false, error: 'CV không tồn tại' });
        }

        const filename = row.TepCV;
        db.run('DELETE FROM HoSoCV WHERE MaCV = ?', [cvId], function (deleteErr) {
            if (deleteErr) {
                console.error('Lỗi xóa CV:', deleteErr);
                return res.status(500).json({ success: false, error: 'Không thể xóa CV' });
            }

            if (filename) {
                const safeName = path.basename(String(filename));
                const filePath = path.join(cvStoragePath, safeName);
                fs.unlink(filePath, (unlinkErr) => {
                    if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                        console.warn('Không thể xóa file CV:', unlinkErr);
                    }
                });

                // If it's an online CV, also delete its meta file (best effort)
                const metaPath = path.join(cvStoragePath, buildOnlineMetaFilename(safeName));
                fs.unlink(metaPath, (unlinkErr) => {
                    if (unlinkErr && unlinkErr.code !== 'ENOENT') {
                        // ignore
                    }
                });
            }

            return res.json({ success: true });
        });
    });
});

// Search CVs (for employers)
router.get('/search', (req, res) => {
    const { keyword = '', city = '', experience = '' } = req.query;

    let sql = `
        SELECT 
            cv.MaCV,
            cv.TieuDe,
            cv.TomTat,
            cv.NgayCapNhat,
            nd.MaNguoiDung,
            nd.HoTen,
            nd.Email,
            nd.SoDienThoai,
            hsv.ThanhPho,
            hsv.SoNamKinhNghiem,
            hsv.TrinhDoHocVan,
            hsv.ChucDanh
        FROM HoSoCV cv
        JOIN NguoiDung nd ON nd.MaNguoiDung = cv.MaNguoiDung
        LEFT JOIN HoSoUngVien hsv ON hsv.MaNguoiDung = nd.MaNguoiDung
        WHERE nd.VaiTro = 'Ứng viên'
    `;
    
    const params = [];

    if (keyword) {
        sql += ` AND (cv.TieuDe LIKE ? OR cv.TomTat LIKE ? OR hsv.ChucDanh LIKE ? OR nd.HoTen LIKE ?)`;
        const kw = `%${keyword}%`;
        params.push(kw, kw, kw, kw);
    }

    if (city) {
        sql += ` AND hsv.ThanhPho = ?`;
        params.push(city);
    }

    if (experience) {
        if (experience === '0-1') sql += ` AND COALESCE(hsv.SoNamKinhNghiem, 0) <= 1`;
        else if (experience === '1-3') sql += ` AND COALESCE(hsv.SoNamKinhNghiem, 0) BETWEEN 1 AND 3`;
        else if (experience === '3-5') sql += ` AND COALESCE(hsv.SoNamKinhNghiem, 0) BETWEEN 3 AND 5`;
        else if (experience === '5+') sql += ` AND COALESCE(hsv.SoNamKinhNghiem, 0) >= 5`;
    }

    sql += ` GROUP BY cv.MaCV ORDER BY cv.NgayCapNhat DESC LIMIT 50`;

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Lỗi search CV:', err);
            return res.status(500).json({ success: false, error: 'Lỗi truy vấn' });
        }

        const results = rows.map(row => ({
            cvId: row.MaCV,
            title: row.TieuDe || 'CV ứng viên',
            summary: row.TomTat || '',
            candidateName: row.HoTen || 'N/A',
            candidateEmail: row.Email || '',
            candidatePhone: row.SoDienThoai || '',
            city: row.ThanhPho || '',
            experience: row.SoNamKinhNghiem != null ? `${row.SoNamKinhNghiem} năm` : '',
            level: row.TrinhDoHocVan || '',
            industry: row.ChucDanh || '',
            updatedAt: row.NgayCapNhat || ''
        }));

        return res.json({ success: true, results, count: results.length });
    });
});

// ===== Saved CVs (for employers) =====
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
    });
});

const getEmployerId = async (userId) => {
    const row = await dbGet('SELECT MaNhaTuyenDung FROM NhaTuyenDung WHERE MaNguoiDung = ?', [userId]).catch(() => null);
    return row?.MaNhaTuyenDung ? Number(row.MaNhaTuyenDung) : null;
};

router.get('/saved', authenticateToken, authorizeRole(['Nhà tuyển dụng']), async (req, res) => {
    try {
        const employerId = await getEmployerId(req.user.id);
        if (!employerId) return res.json({ success: true, saved: [] });

        const status = (req.query.status || '').trim();
        let where = 'WHERE lc.MaNhaTuyenDung = ?';
        const params = [employerId];
        if (status) {
            where += ' AND lc.TrangThai = ?';
            params.push(status);
        }

        const rows = await dbAll(
            `SELECT
                lc.MaLuuCV,
                lc.MaCV,
                lc.TrangThai,
                lc.NgayLuu,
                cv.TieuDe,
                cv.TomTat,
                cv.NgayCapNhat,
                nd.HoTen,
                nd.Email,
                nd.SoDienThoai,
                hsv.ThanhPho,
                hsv.SoNamKinhNghiem,
                hsv.TrinhDoHocVan,
                hsv.ChucDanh
             FROM LuuCV lc
             JOIN HoSoCV cv ON cv.MaCV = lc.MaCV
             JOIN NguoiDung nd ON nd.MaNguoiDung = cv.MaNguoiDung
             LEFT JOIN HoSoUngVien hsv ON hsv.MaNguoiDung = nd.MaNguoiDung
             ${where}
             ORDER BY datetime(lc.NgayLuu) DESC`,
            params
        );

        const saved = rows.map(r => ({
            savedId: r.MaLuuCV,
            cvId: r.MaCV,
            status: r.TrangThai || 'Đã lưu',
            savedAt: r.NgayLuu || '',
            title: r.TieuDe || 'CV ứng viên',
            summary: r.TomTat || '',
            updatedAt: r.NgayCapNhat || '',
            candidateName: r.HoTen || 'N/A',
            candidateEmail: r.Email || '',
            candidatePhone: r.SoDienThoai || '',
            city: r.ThanhPho || '',
            experience: r.SoNamKinhNghiem != null ? `${r.SoNamKinhNghiem} năm` : '',
            level: r.TrinhDoHocVan || '',
            industry: r.ChucDanh || ''
        }));

        return res.json({ success: true, saved });
    } catch (err) {
        console.error('Lỗi lấy saved CV:', err);
        return res.status(500).json({ success: false, error: 'Lỗi truy vấn' });
    }
});

router.post('/saved', authenticateToken, authorizeRole(['Nhà tuyển dụng']), async (req, res) => {
    try {
        const employerId = await getEmployerId(req.user.id);
        if (!employerId) return res.status(400).json({ success: false, error: 'Tài khoản chưa có nhà tuyển dụng' });

        const cvId = parseInt(req.body?.cvId, 10);
        if (Number.isNaN(cvId)) return res.status(400).json({ success: false, error: 'cvId không hợp lệ' });

        await dbRun('INSERT OR IGNORE INTO LuuCV (MaNhaTuyenDung, MaCV) VALUES (?, ?)', [employerId, cvId]);
        return res.json({ success: true });
    } catch (err) {
        console.error('Lỗi lưu CV:', err);
        return res.status(500).json({ success: false, error: 'Lỗi truy vấn' });
    }
});

router.patch('/saved/:cvId', authenticateToken, authorizeRole(['Nhà tuyển dụng']), async (req, res) => {
    try {
        const employerId = await getEmployerId(req.user.id);
        if (!employerId) return res.status(400).json({ success: false, error: 'Tài khoản chưa có nhà tuyển dụng' });

        const cvId = parseInt(req.params.cvId, 10);
        if (Number.isNaN(cvId)) return res.status(400).json({ success: false, error: 'cvId không hợp lệ' });

        const status = (req.body?.status || '').trim();
        const allowed = ['Đã lưu', 'Đã xem', 'Phù hợp', 'Đã liên hệ'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ success: false, error: 'Trạng thái không hợp lệ' });
        }

        const exists = await dbGet('SELECT 1 AS ok FROM LuuCV WHERE MaNhaTuyenDung = ? AND MaCV = ? LIMIT 1', [employerId, cvId]);
        if (!exists) return res.status(404).json({ success: false, error: 'CV chưa được lưu' });

        await dbRun('UPDATE LuuCV SET TrangThai = ?, NgayLuu = datetime("now", "localtime") WHERE MaNhaTuyenDung = ? AND MaCV = ?', [status, employerId, cvId]);
        return res.json({ success: true });
    } catch (err) {
        console.error('Lỗi update saved CV:', err);
        return res.status(500).json({ success: false, error: 'Lỗi truy vấn' });
    }
});

// Multer / upload error handler (ensure JSON response for the client)
router.use((err, req, res, next) => {
    if (!err) return next();
    // Multer errors or custom fileFilter errors
    const message = err.message || 'Lỗi tải CV.';
    return res.status(400).json({ success: false, error: message });
});

module.exports = router;