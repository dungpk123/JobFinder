const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const https = require('https');
const path = require('path');
const multer = require('multer');
const db = require('../config/db');
const { jobs: mockJobs } = require('../data/mockJobs');
const router = express.Router();

const JWT_SECRET = 'your_jwt_secret';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const AI_PROVIDER = (process.env.AI_PROVIDER || (GEMINI_API_KEY ? 'gemini' : 'openai')).toLowerCase();
const experienceOptions = ['Không yêu cầu', 'Dưới 1 năm', '1 năm', '2 năm', '3 năm', '4 năm', '5 năm', 'Trên 5 năm'];
const levelOptions = [
    'Thực tập sinh',
    'Nhân viên',
    'Trưởng nhóm',
    'Trưởng/Phó phòng',
    'Quản lý / Giám sát',
    'Trưởng chi nhánh',
    'Phó giám đốc',
    'Giám đốc'
];
const jobFieldOptions = ['CNTT', 'Marketing', 'Bán hàng', 'Hành chính', 'Kỹ thuật', 'Tài chính', 'Sản xuất', 'Dịch vụ', 'Khác'];

const BASE_PATH = (() => {
    const basePath = process.env.BASE_PATH || '/';
    let normalized = basePath;
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
})();
const PUBLIC_PREFIX = BASE_PATH === '/' ? '' : BASE_PATH;
const buildCompanyLogoRelativePath = (filename) => `${PUBLIC_PREFIX}/images/company-logos/${filename}`;
const buildAbsoluteUrl = (req, relativePath) => (relativePath ? `${req.protocol}://${req.get('host')}${relativePath}` : '');

const normalizeLogoField = (req, row) => {
    if (!row) return row;
    const logo = row.Logo;
    if (logo && typeof logo === 'string' && logo.startsWith('/')) {
        return { ...row, Logo: buildAbsoluteUrl(req, logo) };
    }
    return row;
};

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

const safeJsonParse = (text) => {
    try {
        return { ok: true, value: JSON.parse(text) };
    } catch {
        return { ok: false, value: null };
    }
};

const callOpenAIChat = async ({ messages, temperature = 0.2 }) => {
    if (!OPENAI_API_KEY) return { ok: false, error: 'OPENAI_API_KEY chưa được cấu hình.' };

    const payload = JSON.stringify({ model: OPENAI_MODEL, messages, temperature });
    return new Promise((resolve) => {
        const req = https.request(
            {
                method: 'POST',
                hostname: 'api.openai.com',
                path: '/v1/chat/completions',
                headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        return resolve({ ok: false, error: `OpenAI error ${res.statusCode}: ${data}` });
                    }
                    const parsed = safeJsonParse(data);
                    if (!parsed.ok) return resolve({ ok: false, error: 'Không parse được response từ OpenAI.' });
                    const text = parsed.value?.choices?.[0]?.message?.content || '';
                    resolve({ ok: true, text });
                });
            }
        );

        req.on('error', (err) => resolve({ ok: false, error: err.message }));
        req.write(payload);
        req.end();
    });
};

const toGeminiRequest = (messages) => {
    const systemParts = [];
    const contents = [];

    (messages || []).forEach((m) => {
        if (m.role === 'system') {
            systemParts.push(String(m.content || ''));
            return;
        }
        const role = m.role === 'assistant' ? 'model' : 'user';
        contents.push({ role, parts: [{ text: String(m.content || '') }] });
    });

    const body = {
        contents,
        generationConfig: { temperature: 0.2 }
    };

    const systemText = systemParts.join('\n\n').trim();
    if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };
    return body;
};

const callGeminiGenerateContent = async ({ messages, temperature = 0.2 }) => {
    if (!GEMINI_API_KEY) return { ok: false, error: 'GEMINI_API_KEY chưa được cấu hình.' };

    const body = toGeminiRequest(messages);
    body.generationConfig = { ...(body.generationConfig || {}), temperature };

    const payload = JSON.stringify(body);
    const path = `/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    return new Promise((resolve) => {
        const req = https.request(
            {
                method: 'POST',
                hostname: 'generativelanguage.googleapis.com',
                path,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        return resolve({ ok: false, error: `Gemini error ${res.statusCode}: ${data}` });
                    }
                    const parsed = safeJsonParse(data);
                    if (!parsed.ok) return resolve({ ok: false, error: 'Không parse được response từ Gemini.' });
                    const parts = parsed.value?.candidates?.[0]?.content?.parts || [];
                    const text = Array.isArray(parts) ? parts.map((p) => p && (p.text || '')).filter(Boolean).join('') : '';
                    resolve({ ok: true, text: text || '' });
                });
            }
        );

        req.on('error', (err) => resolve({ ok: false, error: err.message }));
        req.write(payload);
        req.end();
    });
};

const callAIText = async (messages) => {
    if (AI_PROVIDER === 'gemini') return callGeminiGenerateContent({ messages });
    return callOpenAIChat({ messages });
};

const normalize = (s = '') => String(s || '').toLowerCase().trim();
const uniq = (arr) => Array.from(new Set((arr || []).map((x) => String(x || '').trim()).filter(Boolean)));

const extractMatchingSignals = async ({ city, title, education, intro }) => {
    const rawText = [title, education, intro].filter(Boolean).join('\n');
    if (!rawText.trim()) {
        return { keywords: [], fields: [], languages: [] };
    }

    const hasAIKey = (AI_PROVIDER === 'gemini' && !!GEMINI_API_KEY) || (AI_PROVIDER !== 'gemini' && !!OPENAI_API_KEY);
    if (!hasAIKey) {
        // Fallback (no AI): extract tokens crudely
        const tokens = uniq(rawText
            .split(/[^\p{L}\p{N}]+/gu)
            .map((t) => t.trim())
            .filter((t) => t.length >= 3)
            .slice(0, 12));
        return { keywords: tokens.slice(0, 8), fields: [], languages: [] };
    }

    const system =
        'Bạn là trợ lý gợi ý việc làm. Hãy trích xuất tín hiệu nghề nghiệp từ hồ sơ ứng viên và trả về JSON hợp lệ, KHÔNG thêm chữ ngoài JSON.';

    const user =
        `Hồ sơ ứng viên:\n` +
        `- Thành phố ưu tiên: ${city || ''}\n` +
        `- Chức danh mong muốn: ${title || ''}\n` +
        `- Trình độ/Học vấn: ${education || ''}\n` +
        `- Giới thiệu bản thân: ${intro || ''}\n\n` +
        `Yêu cầu: trả về JSON dạng:\n` +
        `{\n` +
        `  "fields": ["..."],\n` +
        `  "keywords": ["..."],\n` +
        `  "languages": ["..." ]\n` +
        `}\n` +
        `Quy tắc:\n` +
        `- fields: tối đa 6, ví dụ "CNTT", "Kế toán", "Marketing", "Bán hàng", "Tiếng Anh", ...\n` +
        `- keywords: tối đa 10, là các từ khóa ngắn (1-3 từ) để tìm trong tiêu đề/yêu cầu\n` +
        `- languages: tối đa 4, ví dụ "Tiếng Anh", "Tiếng Nhật"\n` +
        `- Không bịa thông tin. Nếu không có thì mảng rỗng.`;

    const ai = await callAIText([
        { role: 'system', content: system },
        { role: 'user', content: user }
    ]);

    if (!ai.ok) {
        return { keywords: [], fields: [], languages: [] };
    }

    const text = String(ai.text || '').trim();
    const parsed = safeJsonParse(text);
    if (!parsed.ok) {
        // Try to salvage JSON inside a code block
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) return { keywords: [], fields: [], languages: [] };
        const salvage = safeJsonParse(m[0]);
        if (!salvage.ok) return { keywords: [], fields: [], languages: [] };
        return {
            fields: uniq(salvage.value.fields).slice(0, 6),
            keywords: uniq(salvage.value.keywords).slice(0, 10),
            languages: uniq(salvage.value.languages).slice(0, 4)
        };
    }

    return {
        fields: uniq(parsed.value.fields).slice(0, 6),
        keywords: uniq(parsed.value.keywords).slice(0, 10),
        languages: uniq(parsed.value.languages).slice(0, 4)
    };
};

const getOrCreateCompanyId = async (userId) => {
    const existing = await dbGet(
        'SELECT MaCongTy FROM CongTy WHERE NguoiDaiDien = ? ORDER BY MaCongTy DESC LIMIT 1',
        [userId]
    );
    if (existing?.MaCongTy) return existing.MaCongTy;

    const ntd = await dbGet(
        'SELECT TenCongTy, MaSoThue, Website, DiaChi, ThanhPho, LinhVuc, MoTa, Logo FROM NhaTuyenDung WHERE MaNguoiDung = ? ORDER BY MaNhaTuyenDung DESC LIMIT 1',
        [userId]
    );
    const user = await dbGet('SELECT HoTen, DiaChi FROM NguoiDung WHERE MaNguoiDung = ?', [userId]);
    const tenCongTy = ntd?.TenCongTy || user?.HoTen || 'Nhà tuyển dụng';

    const inserted = await dbRun(
        `INSERT INTO CongTy (TenCongTy, MaSoThue, DiaChi, ThanhPho, Website, LinhVuc, MoTa, Logo, NguoiDaiDien)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            tenCongTy,
            ntd?.MaSoThue || null,
            ntd?.DiaChi || user?.DiaChi || null,
            ntd?.ThanhPho || null,
            ntd?.Website || null,
            ntd?.LinhVuc || null,
            ntd?.MoTa || null,
            ntd?.Logo || null,
            userId
        ]
    );
    return inserted.lastID;
};

// Multer config for company logo
const companyLogoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/images/company-logos'));
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const userId = req.user?.id || 'unknown';
        cb(null, `logo_${userId}_${Date.now()}${ext}`);
    }
});
const uploadCompanyLogo = multer({
    storage: companyLogoStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) return cb(new Error('Chỉ chấp nhận file ảnh.'));
        cb(null, true);
    }
});

// Employer: get company profile
router.get('/company', authenticateToken, authorizeRole(['Nhà tuyển dụng']), async (req, res) => {
    try {
        const userId = req.user.id;
        await getOrCreateEmployerId(userId);
        await getOrCreateCompanyId(userId);

        const company = await dbGet(
            `SELECT TenCongTy, MaSoThue, DiaChi, ThanhPho, LinhVuc, Website, MoTa, Logo
             FROM CongTy
             WHERE NguoiDaiDien = ?
             ORDER BY MaCongTy DESC LIMIT 1`,
            [userId]
        );

        const logoUrl = company?.Logo || '';
        return res.json({
            success: true,
            company: {
                name: company?.TenCongTy || '',
                taxCode: company?.MaSoThue || '',
                address: company?.DiaChi || '',
                city: company?.ThanhPho || '',
                industry: company?.LinhVuc || '',
                website: company?.Website || '',
                description: company?.MoTa || '',
                logoUrl,
                logoAbsoluteUrl: buildAbsoluteUrl(req, logoUrl)
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Employer: update company profile
router.post('/company', authenticateToken, authorizeRole(['Nhà tuyển dụng']), async (req, res) => {
    const { name, taxCode, address, city, industry, website, description } = req.body || {};
    try {
        const userId = req.user.id;
        const companyId = await getOrCreateCompanyId(userId);
        await getOrCreateEmployerId(userId);

        await dbRun(
            `UPDATE CongTy
             SET TenCongTy = ?, MaSoThue = ?, DiaChi = ?, ThanhPho = ?, Website = ?, LinhVuc = ?, MoTa = ?,
                 NgayCapNhat = datetime('now', 'localtime')
             WHERE MaCongTy = ?`,
            [name || '', taxCode || '', address || '', city || '', website || '', industry || '', description || '', companyId]
        );

        // Keep employer table in sync for job listings
        await dbRun(
            `UPDATE NhaTuyenDung
             SET TenCongTy = ?, MaSoThue = ?, DiaChi = ?, ThanhPho = ?, Website = ?, MoTa = ?,
                 NgayCapNhat = datetime('now', 'localtime')
             WHERE MaNguoiDung = ?`,
            [name || '', taxCode || '', address || '', city || '', website || '', description || '', userId]
        );

        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// Employer: upload company logo
router.post('/company/logo', authenticateToken, authorizeRole(['Nhà tuyển dụng']), uploadCompanyLogo.single('logo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: 'Thiếu file logo.' });
    try {
        const userId = req.user.id;
        const logoUrl = buildCompanyLogoRelativePath(req.file.filename);

        const companyId = await getOrCreateCompanyId(userId);
        await getOrCreateEmployerId(userId);

        await dbRun(
            `UPDATE CongTy SET Logo = ?, NgayCapNhat = datetime('now', 'localtime') WHERE MaCongTy = ?`,
            [logoUrl, companyId]
        );

        await dbRun(
            `UPDATE NhaTuyenDung SET Logo = ?, NgayCapNhat = datetime('now', 'localtime') WHERE MaNguoiDung = ?`,
            [logoUrl, userId]
        );

        return res.json({ success: true, logoUrl, logoAbsoluteUrl: buildAbsoluteUrl(req, logoUrl) });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

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

// Get all posted jobs (public)
router.get('/', async (req, res) => {
    try {
        const rows = await dbAll(
            `SELECT 
                ttd.MaTin,
                ttd.TieuDe,
                ttd.MoTa,
                ttd.YeuCau,
                ttd.QuyenLoi,
                ttd.KinhNghiem,
                ttd.CapBac,
                ttd.LinhVucCongViec,
                ttd.LuongTu,
                ttd.LuongDen,
                ttd.KieuLuong,
                ttd.DiaDiem,
                ttd.ThanhPho,
                ttd.HinhThuc,
                ttd.TrangThai,
                ttd.NgayDang,
                ttd.HanNopHoSo,
                ntd.TenCongTy,
                ntd.Logo,
                ct.LinhVuc AS LinhVucCongTy
             FROM TinTuyenDung ttd
             JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
             LEFT JOIN CongTy ct ON ct.NguoiDaiDien = ntd.MaNguoiDung
             WHERE ttd.TrangThai = 'Đã đăng'
             ORDER BY datetime(ttd.NgayDang) DESC`
        );

        // Fallback: if DB chưa có tin nào, trả về mock data để trang không rỗng
        if (rows.length === 0 && Array.isArray(mockJobs) && mockJobs.length > 0) {
            const mapped = mockJobs.map((j) => {
                const salary = Number.isFinite(Number(j.salaryValue)) ? Number(j.salaryValue) * 1_000_000 : null;
                const employmentType = (() => {
                    if (j.type === 'fulltime') return 'Toàn thời gian';
                    if (j.type === 'parttime') return 'Bán thời gian';
                    if (j.type === 'intern') return 'Thực tập';
                    return 'Khác';
                })();

                return normalizeLogoField(req, {
                    MaTin: j.id,
                    TieuDe: j.title,
                    MoTa: null,
                    YeuCau: null,
                    QuyenLoi: null,
                    KinhNghiem: j.experience || null,
                    CapBac: null,
                    LinhVucCongViec: j.career || null,
                    LuongTu: salary,
                    LuongDen: salary,
                    KieuLuong: salary ? 'Tháng' : 'Thỏa thuận',
                    DiaDiem: j.location || null,
                    ThanhPho: j.province || null,
                    HinhThuc: employmentType,
                    TrangThai: 'Đã đăng',
                    NgayDang: null,
                    HanNopHoSo: null,
                    TenCongTy: j.company,
                    Logo: j.logo || '/images/logo.png'
                });
            });
            return res.json(mapped);
        }

        res.json(rows.map((r) => normalizeLogoField(req, r)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get employer's own jobs
router.get('/mine', authenticateToken, authorizeRole(['Nhà tuyển dụng']), async (req, res) => {
    try {
        const employerId = await getOrCreateEmployerId(req.user.id);
        const rows = await dbAll(
            `SELECT 
                     MaTin, TieuDe, MoTa, YeuCau, QuyenLoi, KinhNghiem, CapBac, LinhVucCongViec, LuongTu, LuongDen, KieuLuong,
                     DiaDiem, ThanhPho, HinhThuc, TrangThai, NgayDang, HanNopHoSo, LuotXem, SoLuongUngTuyen
             FROM TinTuyenDung
             WHERE MaNhaTuyenDung = ?
             ORDER BY datetime(NgayDang) DESC`,
            [employerId]
        );
        res.json(rows.map((r) => normalizeLogoField(req, r)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== Saved jobs (LuuTin) =====
// NOTE: Must be declared before '/:id' route.
router.get('/saved', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const rows = await dbAll(
            `SELECT
                ttd.MaTin,
                ttd.TieuDe,
                ttd.MoTa,
                ttd.YeuCau,
                ttd.QuyenLoi,
                ttd.KinhNghiem,
                ttd.CapBac,
                ttd.LinhVucCongViec,
                ttd.LuongTu,
                ttd.LuongDen,
                ttd.KieuLuong,
                ttd.DiaDiem,
                ttd.ThanhPho,
                ttd.HinhThuc,
                ttd.TrangThai,
                ttd.NgayDang,
                ttd.HanNopHoSo,
                ntd.TenCongTy,
                ntd.Logo
             FROM LuuTin lt
             JOIN TinTuyenDung ttd ON ttd.MaTin = lt.MaTin
             JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
             WHERE lt.MaNguoiDung = ?
             ORDER BY datetime(lt.NgayLuu) DESC`,
            [userId]
        );

        return res.json(rows.map((r) => normalizeLogoField(req, r)));
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.get('/saved/status/:jobId', authenticateToken, async (req, res) => {
    const { jobId } = req.params;
    try {
        const userId = req.user.id;
        const row = await dbGet(
            'SELECT 1 AS ok FROM LuuTin WHERE MaNguoiDung = ? AND MaTin = ? LIMIT 1',
            [userId, jobId]
        );
        return res.json({ saved: !!row });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/saved/:jobId', authenticateToken, async (req, res) => {
    const { jobId } = req.params;
    try {
        const userId = req.user.id;
        const exists = await dbGet('SELECT 1 AS ok FROM TinTuyenDung WHERE MaTin = ? LIMIT 1', [jobId]);
        if (!exists) return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });

        await dbRun(
            `INSERT OR IGNORE INTO LuuTin (MaNguoiDung, MaTin) VALUES (?, ?)` ,
            [userId, jobId]
        );

        return res.json({ saved: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.delete('/saved/:jobId', authenticateToken, async (req, res) => {
    const { jobId } = req.params;
    try {
        const userId = req.user.id;
        await dbRun('DELETE FROM LuuTin WHERE MaNguoiDung = ? AND MaTin = ?', [userId, jobId]);
        return res.json({ saved: false });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Candidate: matching jobs (simple heuristic)
router.get('/matching', authenticateToken, authorizeRole(['Ứng viên']), async (req, res) => {
    try {
        const profile = await dbGet(
            'SELECT ThanhPho, ChucDanh, TrinhDoHocVan, GioiThieuBanThan FROM HoSoUngVien WHERE MaNguoiDung = ? LIMIT 1',
            [req.user.id]
        );

        const city = (profile?.ThanhPho || '').trim();
        const title = (profile?.ChucDanh || '').trim();
        const education = (profile?.TrinhDoHocVan || '').trim();
        const intro = (profile?.GioiThieuBanThan || '').trim();

        const signals = await extractMatchingSignals({ city, title, education, intro });

        // Load a reasonable candidate set (recent jobs). We'll score in JS.
        const rows = await dbAll(
            `SELECT 
                ttd.MaTin,
                ttd.TieuDe,
                ttd.MoTa,
                ttd.YeuCau,
                ttd.QuyenLoi,
                ttd.KinhNghiem,
                ttd.CapBac,
                ttd.LinhVucCongViec,
                ttd.LuongTu,
                ttd.LuongDen,
                ttd.KieuLuong,
                ttd.DiaDiem,
                ttd.ThanhPho,
                ttd.HinhThuc,
                ttd.TrangThai,
                ttd.NgayDang,
                ttd.HanNopHoSo,
                ntd.TenCongTy,
                ntd.Logo,
                ct.LinhVuc AS LinhVucCongTy
             FROM TinTuyenDung ttd
             JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
             LEFT JOIN CongTy ct ON ct.NguoiDaiDien = ntd.MaNguoiDung
             WHERE ttd.TrangThai = 'Đã đăng'
             ORDER BY datetime(ttd.NgayDang) DESC
             LIMIT 250`
        );

        const keywords = uniq([...(signals.keywords || []), ...(signals.languages || [])]).slice(0, 12);
        const fields = uniq(signals.fields || []).slice(0, 8);

        const cityNorm = normalize(city);
        const kwNorm = keywords.map((k) => normalize(k)).filter(Boolean);
        const fieldNorm = fields.map((f) => normalize(f)).filter(Boolean);

        const scored = rows.map((r) => {
            const titleText = normalize(r.TieuDe);
            const fieldText = normalize(`${r.LinhVucCongViec || ''} ${r.LinhVucCongTy || ''}`);
            const bodyText = normalize(`${r.YeuCau || ''} ${r.MoTa || ''}`);
            const jobCity = normalize(r.ThanhPho);

            let score = 0;
            const sameCity = cityNorm && jobCity && jobCity === cityNorm;
            if (sameCity) score += 100; // hard priority

            // Fields first
            fieldNorm.forEach((f) => {
                if (f && (fieldText.includes(f) || titleText.includes(f))) score += 18;
            });

            // Keywords/languages
            kwNorm.forEach((k) => {
                if (!k) return;
                if (titleText.includes(k)) score += 12;
                else if (fieldText.includes(k)) score += 9;
                else if (bodyText.includes(k)) score += 3;
            });

            // Small bonus for having city when user has city
            if (cityNorm && !sameCity && jobCity) score += 1;

            return { r, score };
        });

        const best = scored
            .sort((a, b) => b.score - a.score)
            .filter((x) => x.score > 0 || (!cityNorm))
            .slice(0, 30)
            .map((x) => normalizeLogoField(req, x.r));

        // If we couldn't score anything, fallback to city-only filter (previous behavior)
        if (best.length === 0) {
            const fallback = rows
                .filter((r) => !cityNorm || normalize(r.ThanhPho) === cityNorm)
                .slice(0, 30)
                .map((r) => normalizeLogoField(req, r));
            return res.json(fallback);
        }

        return res.json(best);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Get a single job by id (employer-owned or public view)
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const row = await dbGet(
            `SELECT 
                ttd.MaTin,
                ttd.TieuDe,
                ttd.MoTa,
                ttd.YeuCau,
                ttd.QuyenLoi,
                ttd.KinhNghiem,
                ttd.CapBac,
                ttd.LinhVucCongViec,
                ttd.LuongTu,
                ttd.LuongDen,
                ttd.KieuLuong,
                ttd.DiaDiem,
                ttd.ThanhPho,
                ttd.HinhThuc,
                ttd.TrangThai,
                ttd.NgayDang,
                ttd.HanNopHoSo,
                ttd.LuotXem,
                ntd.TenCongTy,
                ntd.Logo,
                ttd.MaNhaTuyenDung
             FROM TinTuyenDung ttd
             JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
             WHERE ttd.MaTin = ?`,
            [id]
        );

        if (!row) return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });

        // Public can only view posted jobs. Allow owner employer to view non-posted when authenticated.
        if (row.TrangThai !== 'Đã đăng') {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });

            let user;
            try {
                user = jwt.verify(token, JWT_SECRET);
            } catch {
                return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });
            }

            if (!user || user.role !== 'Nhà tuyển dụng') {
                return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });
            }

            const employerId = await getOrCreateEmployerId(user.id);
            if (row.MaNhaTuyenDung !== employerId) {
                return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });
            }
        }

        // Increase view count for posted jobs when viewed by non-owner
        if (row.TrangThai === 'Đã đăng') {
            let isOwnerEmployer = false;
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (token) {
                try {
                    const user = jwt.verify(token, JWT_SECRET);
                    if (user && user.role === 'Nhà tuyển dụng') {
                        const employerId = await getOrCreateEmployerId(user.id);
                        if (row.MaNhaTuyenDung === employerId) isOwnerEmployer = true;
                    }
                } catch {
                    // ignore invalid token for view tracking
                }
            }

            if (!isOwnerEmployer) {
                await dbRun(
                    'UPDATE TinTuyenDung SET LuotXem = COALESCE(LuotXem, 0) + 1 WHERE MaTin = ?',
                    [id]
                ).catch(() => null);
                row.LuotXem = (Number(row.LuotXem) || 0) + 1;
            }
        }

        res.json(normalizeLogoField(req, row));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Post a job (employer only)
router.post('/', authenticateToken, authorizeRole(['Nhà tuyển dụng']), async (req, res) => {
    const {
        title,
        description,
        requirements,
        benefits,
        salaryFrom,
        salaryTo,
        salaryType,
        location,
        city,
        experience,
        level,
        jobField,
        employmentType,
        deadline,
        status
    } = req.body;

    if (!title || String(title).trim().length === 0) {
        return res.status(400).json({ error: 'Vui lòng nhập tiêu đề tin tuyển dụng' });
    }

    try {
        const employerId = await getOrCreateEmployerId(req.user.id);
        const safeStatus = status && ['Nháp', 'Đã đăng', 'Đã đóng', 'Lưu trữ'].includes(status) ? status : 'Đã đăng';
        const safeSalaryType = salaryType && ['Tháng', 'Năm', 'Thỏa thuận', 'Khoảng', 'Không xác định'].includes(salaryType) ? salaryType : 'Thỏa thuận';
        const safeEmploymentType = employmentType && ['Toàn thời gian', 'Bán thời gian', 'Thực tập', 'Từ xa', 'Hợp đồng'].includes(employmentType)
            ? employmentType
            : 'Toàn thời gian';
        const safeExperience = experienceOptions.includes(experience) ? experience : null;
        const safeLevel = levelOptions.includes(level) ? level : null;
        const safeJobField = jobFieldOptions.includes(jobField) ? jobField : null;

        const inserted = await dbRun(
            `INSERT INTO TinTuyenDung (
                MaNhaTuyenDung, TieuDe, MoTa, YeuCau, QuyenLoi, KinhNghiem, CapBac, LinhVucCongViec,
                LuongTu, LuongDen, KieuLuong, DiaDiem, ThanhPho,
                HinhThuc, TrangThai, HanNopHoSo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                employerId,
                String(title).trim(),
                description || null,
                requirements || null,
                benefits || null,
                safeExperience,
                safeLevel,
                safeJobField,
                Number.isFinite(Number(salaryFrom)) ? Number(salaryFrom) : null,
                Number.isFinite(Number(salaryTo)) ? Number(salaryTo) : null,
                safeSalaryType,
                location || null,
                city || null,
                safeEmploymentType,
                safeStatus,
                deadline || null
            ]
        );

        res.status(201).json({ message: 'Đăng tin thành công', jobId: inserted.lastID });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a job (employer only)
router.put('/:id', authenticateToken, authorizeRole(['Nhà tuyển dụng']), async (req, res) => {
    const { id } = req.params;
    const {
        title,
        description,
        requirements,
        benefits,
        salaryFrom,
        salaryTo,
        salaryType,
        location,
        city,
        experience,
        level,
        jobField,
        employmentType,
        deadline,
        status
    } = req.body;

    if (!title || String(title).trim().length === 0) {
        return res.status(400).json({ error: 'Vui lòng nhập tiêu đề tin tuyển dụng' });
    }

    try {
        const job = await dbGet('SELECT MaTin, MaNhaTuyenDung FROM TinTuyenDung WHERE MaTin = ?', [id]);
        if (!job) return res.status(404).json({ error: 'Không tìm thấy tin tuyển dụng' });

        const employerId = await getOrCreateEmployerId(req.user.id);
        if (job.MaNhaTuyenDung !== employerId) {
            return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa tin này' });
        }

        const safeStatus = status && ['Nháp', 'Đã đăng', 'Đã đóng', 'Lưu trữ'].includes(status) ? status : 'Đã đăng';
        const safeSalaryType = salaryType && ['Tháng', 'Năm', 'Thỏa thuận', 'Khoảng', 'Không xác định'].includes(salaryType) ? salaryType : 'Thỏa thuận';
        const safeEmploymentType = employmentType && ['Toàn thời gian', 'Bán thời gian', 'Thực tập', 'Từ xa', 'Hợp đồng'].includes(employmentType)
            ? employmentType
            : 'Toàn thời gian';
        const safeExperience = experienceOptions.includes(experience) ? experience : null;
        const safeLevel = levelOptions.includes(level) ? level : null;
        const safeJobField = jobFieldOptions.includes(jobField) ? jobField : null;

        await dbRun(
            `UPDATE TinTuyenDung
             SET TieuDe = ?, MoTa = ?, YeuCau = ?, QuyenLoi = ?, KinhNghiem = ?, CapBac = ?, LinhVucCongViec = ?,
                 LuongTu = ?, LuongDen = ?, KieuLuong = ?, DiaDiem = ?, ThanhPho = ?,
                 HinhThuc = ?, TrangThai = ?, HanNopHoSo = ?
             WHERE MaTin = ?`,
            [
                String(title).trim(),
                description || null,
                requirements || null,
                benefits || null,
                safeExperience,
                safeLevel,
                safeJobField,
                Number.isFinite(Number(salaryFrom)) ? Number(salaryFrom) : null,
                Number.isFinite(Number(salaryTo)) ? Number(salaryTo) : null,
                safeSalaryType,
                location || null,
                city || null,
                safeEmploymentType,
                safeStatus,
                deadline || null,
                id
            ]
        );

        res.json({ message: 'Cập nhật tin thành công' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;