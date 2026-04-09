const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { jobs: mockJobs } = require('../data/mockJobs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const AI_PROVIDER = (process.env.AI_PROVIDER || (GEMINI_API_KEY ? 'gemini' : 'openai')).toLowerCase();

const MAX_MESSAGE_CHARS = 6000;
const MAX_MESSAGES = 20;
const MAX_STORED_CV_CHARS = 14000;
const CV_STORAGE_PATH = path.join(__dirname, '../public/cvs');
const ONLINE_META_SUFFIX = '__online.json';

const VI_STOP_WORDS = new Set([
  'anh', 'chi', 'ban', 'toi', 'la', 'va', 'hoac', 'cua', 'cho', 'voi', 'nhung', 'mot', 'nhieu',
  'duoc', 'trong', 'tren', 'tai', 'tu', 'den', 'khi', 'neu', 'de', 've', 'co', 'khong', 'da',
  'se', 'minh', 'jobfinder', 'cv', 'kinh', 'nghiem', 'viec', 'lam', 'ung', 'vien', 'ho', 'so'
]);

// In-memory upload config for quick CV parsing (max 5MB, PDF/DOCX only)
const uploadCv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Chỉ chấp nhận file PDF hoặc DOCX.'));
    }
    cb(null, true);
  }
});

const handleCvUpload = (req, res, next) =>
  uploadCv.single('cvFile')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Lỗi tải CV.' });
    }
    return next();
  });

const safeJsonParse = (text) => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
};

const getProviderErrorStatusCode = (errorText = '') => {
  const text = String(errorText || '');
  const direct = text.match(/\berror\s+(\d{3})\b/i);
  if (direct?.[1]) {
    const code = Number(direct[1]);
    if (Number.isFinite(code)) return code;
  }

  const jsonCode = text.match(/"code"\s*:\s*(\d{3})/i);
  if (jsonCode?.[1]) {
    const code = Number(jsonCode[1]);
    if (Number.isFinite(code)) return code;
  }

  return null;
};

const isProviderOverloadError = (errorText = '') => {
  const text = String(errorText || '').toLowerCase();
  const statusCode = getProviderErrorStatusCode(text);

  if ([429, 500, 502, 503, 504].includes(statusCode)) return true;

  return (
    text.includes('high demand') ||
    text.includes('overloaded') ||
    text.includes('unavailable') ||
    text.includes('temporarily') ||
    text.includes('rate limit') ||
    text.includes('quota') ||
    text.includes('timeout')
  );
};

const isMissingAiKeyError = (errorText = '') => {
  const text = String(errorText || '').toLowerCase();
  return text.includes('api_key') || text.includes('chưa được cấu hình') || text.includes('not configured');
};

const looksLikeRawProviderError = (errorText = '') => {
  const text = String(errorText || '');
  return /\b(gemini|openai)\s+error\s+\d{3}\b/i.test(text) || /"error"\s*:\s*\{/i.test(text);
};

const toFriendlyAiFailureMessage = ({ errorText = '', fallbackUsed = false } = {}) => {
  if (isMissingAiKeyError(errorText)) {
    return 'Hiện máy chủ AI chưa được cấu hình đầy đủ. Bạn vui lòng liên hệ quản trị viên để bổ sung API key và thử lại.';
  }

  if (isProviderOverloadError(errorText) || looksLikeRawProviderError(errorText)) {
    if (fallbackUsed) {
      return 'Hệ thống AI đang quá tải và kênh dự phòng cũng tạm thời bận. Bạn thử lại sau ít phút giúp mình nhé.';
    }
    return 'Hệ thống AI đang quá tải tạm thời. Bạn đợi khoảng 10-30 giây rồi gửi lại nhé.';
  }

  return 'Mình chưa thể kết nối AI ở thời điểm này. Bạn thử lại sau ít phút giúp mình nhé.';
};

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });

const normalizeChatMessages = (messages) => {
  const incomingMessages = Array.isArray(messages) ? messages : null;
  if (!incomingMessages || !incomingMessages.length) return [];
  return incomingMessages
    .filter((m) => m && typeof m === 'object')
    .map((m) => ({
      role: String(m.role || '').trim(),
      content: String(m.content || '')
    }))
    .filter((m) => (m.role === 'system' || m.role === 'user' || m.role === 'assistant') && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({ ...m, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
};

const normalizeForMatch = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();

const stripHtmlTags = (html = '') =>
  String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();

const flattenObjectText = (input) => {
  if (input == null) return '';
  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
    return String(input);
  }
  if (Array.isArray(input)) {
    return input.map(flattenObjectText).filter(Boolean).join(' ');
  }
  if (typeof input === 'object') {
    return Object.values(input).map(flattenObjectText).filter(Boolean).join(' ');
  }
  return '';
};

const extractTextFromStoredCv = async ({ filePath, filename }) => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Không tìm thấy file CV đã chọn.');
  }

  const ext = String(path.extname(filename || filePath) || '').toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === '.pdf') {
    const parsed = await pdfParse(buffer);
    return parsed.text || '';
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  }

  if (ext === '.html' || ext === '.htm') {
    const htmlText = stripHtmlTags(fs.readFileSync(filePath, 'utf8'));
    const metaPath = path.join(CV_STORAGE_PATH, `${path.basename(filename)}${ONLINE_META_SUFFIX}`);
    let metaText = '';

    if (fs.existsSync(metaPath)) {
      const parsedMeta = safeJsonParse(fs.readFileSync(metaPath, 'utf8'));
      if (parsedMeta.ok && parsedMeta.value && typeof parsedMeta.value === 'object') {
        const raw = parsedMeta.value;
        const pieces = [
          String(raw.title || ''),
          String(raw.summary || ''),
          flattenObjectText(raw.content)
        ].filter(Boolean);
        metaText = pieces.join(' ');
      }
    }

    return [metaText, htmlText].filter(Boolean).join(' ');
  }

  if (ext === '.doc') {
    throw new Error('CV định dạng .doc chưa được hỗ trợ để phân tích tự động. Vui lòng dùng PDF hoặc DOCX.');
  }

  return String(buffer.toString('utf8') || '');
};

const extractKeywordsFromText = (text = '', limit = 22) => {
  const freq = new Map();
  const tokens = normalizeForMatch(text)
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !VI_STOP_WORDS.has(t));

  tokens.forEach((token) => {
    freq.set(token, (freq.get(token) || 0) + 1);
  });

  return [...freq.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0].length - a[0].length;
    })
    .slice(0, Math.max(1, limit))
    .map(([token]) => token);
};

const loadPublishedJobs = async (limit = 120) => {
  const boundedLimit = Math.max(20, Math.min(250, Number(limit) || 120));
  return dbAll(
    `SELECT
        ttd.MaTin AS jobId,
        ttd.TieuDe AS title,
        ttd.MoTa AS description,
        ttd.YeuCau AS requirements,
        ttd.LinhVucCongViec AS field,
        ttd.ThanhPho AS city,
        ttd.KinhNghiem AS experience,
        ttd.CapBac AS level,
        ttd.LuongTu AS salaryFrom,
        ttd.LuongDen AS salaryTo,
        ttd.HanNopHoSo AS deadline,
        ntd.TenCongTy AS company
     FROM TinTuyenDung ttd
     JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
     WHERE ttd.TrangThai = 'Đã đăng'
     ORDER BY ttd.NgayDang DESC
     LIMIT ?`,
    [boundedLimit]
  );
};

const recommendJobsByCv = ({ jobs = [], keywords = [], preferredCity = '' }) => {
  const cityNorm = normalizeForMatch(preferredCity);
  const keywordList = (keywords || []).map((kw) => normalizeForMatch(kw)).filter(Boolean);

  const scored = (jobs || []).map((job) => {
    const title = normalizeForMatch(job?.title || '');
    const field = normalizeForMatch(job?.field || '');
    const city = normalizeForMatch(job?.city || '');
    const body = normalizeForMatch(`${job?.requirements || ''} ${job?.description || ''}`);

    let score = 0;
    if (cityNorm && city && cityNorm === city) score += 36;

    keywordList.forEach((kw, idx) => {
      if (!kw) return;
      const depthBoost = idx < 6 ? 1.2 : 1;
      if (title.includes(kw)) score += 11 * depthBoost;
      else if (field.includes(kw)) score += 8 * depthBoost;
      else if (body.includes(kw)) score += 3 * depthBoost;
    });

    if (!cityNorm && title) score += 0.5;

    return {
      ...job,
      score
    };
  });

  const ranked = scored
    .sort((a, b) => b.score - a.score)
    .filter((job) => job.score > 0)
    .slice(0, 8);

  if (ranked.length) return ranked;
  return scored.slice(0, 8);
};

const toVndLabel = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  try {
    return `${num.toLocaleString('vi-VN')} VND`;
  } catch {
    return `${num} VND`;
  }
};

const formatJobSuggestionLine = (job, index) => {
  const salaryFrom = toVndLabel(job?.salaryFrom);
  const salaryTo = toVndLabel(job?.salaryTo);
  const salary = salaryFrom || salaryTo ? `, lương ${salaryFrom || '...'}${salaryTo ? ` - ${salaryTo}` : ''}` : '';
  const city = job?.city ? `, ${job.city}` : '';
  const company = job?.company ? ` - ${job.company}` : '';
  return `${index + 1}. ${job?.title || 'Vị trí phù hợp'}${company}${city}${salary}`;
};

const pickTop = (arr, n) => arr.slice(0, Math.max(0, n));

const normalize = (s = '') => String(s).toLowerCase().trim();

const searchMockJobs = ({ query = '' }) => {
  const q = normalize(query);
  if (!q) return pickTop(mockJobs, 5);
  const scored = mockJobs
    .map((job) => {
      const hay = normalize(`${job.title} ${job.company} ${job.location} ${(job.tags || []).join(' ')}`);
      let score = 0;
      if (hay.includes(q)) score += 5;
      q.split(/\s+/).forEach((token) => {
        if (token.length >= 2 && hay.includes(token)) score += 1;
      });
      if (job.featured) score += 0.5;
      return { job, score };
    })
    .sort((a, b) => b.score - a.score);

  return pickTop(scored.filter((x) => x.score > 0).map((x) => x.job), 5);
};

const extractTextFromCv = async (file) => {
  if (!file?.buffer) return '';
  const mime = file.mimetype;

  if (mime === 'application/pdf') {
    const parsed = await pdfParse(file.buffer);
    return parsed.text || '';
  }

  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || '';
  }

  throw new Error('Định dạng không được hỗ trợ. Chỉ nhận PDF hoặc DOCX.');
};

const getUserProfile = (userId) =>
  new Promise((resolve, reject) => {
    if (!userId) return resolve(null);
    const id = parseInt(userId, 10);
    if (Number.isNaN(id)) return resolve(null);

    db.get(
      `SELECT nd.MaNguoiDung AS userId, nd.Email, nd.HoTen, nd.SoDienThoai, nd.DiaChi,
              hsv.NgaySinh, hsv.GioiTinh, hsv.ThanhPho, hsv.AnhDaiDien, hsv.ChucDanh, hsv.LinkCaNhan
       FROM NguoiDung nd
       LEFT JOIN HoSoUngVien hsv ON hsv.MaNguoiDung = nd.MaNguoiDung
       WHERE nd.MaNguoiDung = ?`,
      [id],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(null);
        resolve({
          userId: row.userId,
          email: row.Email || '',
          fullName: row.HoTen || '',
          phone: row.SoDienThoai || '',
          address: row.DiaChi || '',
          birthday: row.NgaySinh || '',
          gender: row.GioiTinh || '',
          city: row.ThanhPho || '',
          position: row.ChucDanh || '',
          personalLink: row.LinkCaNhan || ''
        });
      }
    );
  });

const callOpenAIChat = async ({ messages, temperature = 0.4 }) => {
  if (!OPENAI_API_KEY) {
    return {
      ok: false,
      error: 'OPENAI_API_KEY chưa được cấu hình (server/.env hoặc biến môi trường).'
    };
  }

  const payload = JSON.stringify({
    model: OPENAI_MODEL,
    messages,
    temperature
  });

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
    generationConfig: {
      temperature: 0.4
    }
  };

  const systemText = systemParts.join('\n\n').trim();
  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }

  return body;
};

const callGeminiGenerateContent = async ({ messages, temperature = 0.4 }) => {
  if (!GEMINI_API_KEY) {
    return {
      ok: false,
      error: 'GEMINI_API_KEY chưa được cấu hình (server/.env hoặc biến môi trường).'
    };
  }

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
          const text = Array.isArray(parts)
            ? parts.map((p) => p && (p.text || '')).filter(Boolean).join('')
            : '';

          resolve({ ok: true, text: text || '' });
        });
      }
    );

    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.write(payload);
    req.end();
  });
};

const callLLMChat = async ({ messages, temperature = 0.4 }) => {
  if (AI_PROVIDER === 'gemini') {
    const primary = await callGeminiGenerateContent({ messages, temperature });
    if (primary.ok) return { ...primary, provider: 'gemini', fallbackUsed: false };

    const canFallbackToOpenAI = Boolean(OPENAI_API_KEY);
    if (canFallbackToOpenAI) {
      const fallback = await callOpenAIChat({ messages, temperature });
      if (fallback.ok) {
        return {
          ...fallback,
          provider: 'openai',
          fallbackUsed: true,
          primaryProvider: 'gemini',
          primaryError: primary.error
        };
      }

      return {
        ok: false,
        provider: 'gemini',
        fallbackUsed: true,
        primaryProvider: 'gemini',
        primaryError: primary.error,
        error: fallback.error || primary.error
      };
    }

    return { ...primary, provider: 'gemini', fallbackUsed: false, primaryProvider: 'gemini' };
  }

  const primary = await callOpenAIChat({ messages, temperature });
  if (primary.ok) return { ...primary, provider: 'openai', fallbackUsed: false };

  const canFallbackToGemini = Boolean(GEMINI_API_KEY);
  if (canFallbackToGemini) {
    const fallback = await callGeminiGenerateContent({ messages, temperature });
    if (fallback.ok) {
      return {
        ...fallback,
        provider: 'gemini',
        fallbackUsed: true,
        primaryProvider: 'openai',
        primaryError: primary.error
      };
    }

    return {
      ok: false,
      provider: 'openai',
      fallbackUsed: true,
      primaryProvider: 'openai',
      primaryError: primary.error,
      error: fallback.error || primary.error
    };
  }

  return { ...primary, provider: 'openai', fallbackUsed: false, primaryProvider: 'openai' };
};

router.post('/chat', async (req, res) => {
  try {
    const { message, messages, mode = 'general', userId } = req.body || {};

    const modeValue = String(mode || 'general').trim();
    // Giữ lại các mode cũ nhưng mặc định chỉ cho phép general|cv; job không dùng trên UI mới
    const allowedModes = new Set(['general', 'cv']);
    if (!allowedModes.has(modeValue)) {
      return res.status(400).json({ success: false, error: 'mode không hợp lệ (general|cv).' });
    }

    const userMessage = String(message || '').trim();

    let chatMessages = [];
    const normalizedIncoming = normalizeChatMessages(messages);
    if (normalizedIncoming.length) {
      chatMessages = normalizedIncoming;
    } else if (userMessage) {
      chatMessages = [{ role: 'user', content: userMessage.slice(0, MAX_MESSAGE_CHARS) }];
    }

    if (!chatMessages.length) {
      return res.status(400).json({ success: false, error: 'Thiếu message hoặc messages.' });
    }

    const lastUserText = [...chatMessages].reverse().find((m) => m.role === 'user')?.content || '';

    if (modeValue === 'general') {
      // Free-form chat. Keep it general-purpose and helpful.
      const system =
        'Bạn là trợ lý của website JobFinder. Bạn có thể trả lời 2 nhóm câu hỏi: ' +
        '(1) hướng dẫn sử dụng website JobFinder (tính năng, điều hướng, người dùng bấm ở đâu, các trang/đường dẫn), ' +
        '(2) nội dung liên quan CV/hồ sơ/phỏng vấn/tìm việc. ' +
        'Nếu người dùng hỏi chủ đề không liên quan đến JobFinder hoặc sự nghiệp (sức khỏe, tài chính cá nhân, đời tư, code, chính trị, v.v.), hãy từ chối lịch sự và gợi ý họ hỏi về JobFinder/CV/việc làm. ' +
        'Chỉ mô tả những tính năng chắc chắn có trong JobFinder; nếu không chắc, hãy hỏi lại 1-2 câu hoặc hướng dẫn người dùng kiểm tra trên menu. ' +
        'Gợi ý điều hướng phổ biến (nếu phù hợp với câu hỏi): Trang chủ (/), Tìm việc (/jobs), Xem chi tiết việc (/jobs/:id), Tạo CV (/create-cv), Hồ sơ (/profile), Đăng nhập/Đăng ký. ' +
        'Trả lời tiếng Việt, ngắn gọn, không dùng markdown, không dùng dấu *, -, #, không dùng tiêu đề. ' +
        'Viết tối đa 6 câu; có thể xuống dòng giữa các ý. ' +
        'Nếu thiếu thông tin, hỏi tối đa 2 câu ngắn để làm rõ.'; 

      // Ensure there is one system message at the start.
      const hasSystem = chatMessages.some((m) => m.role === 'system');
      const finalMessages = hasSystem ? chatMessages : [{ role: 'system', content: system }, ...chatMessages];

      const ai = await callLLMChat({ messages: finalMessages, temperature: 0.4 });
      if (ai.ok) return res.json({ success: true, reply: ai.text });

      console.warn('AI general chat failure:', {
        provider: ai.provider || AI_PROVIDER,
        fallbackUsed: Boolean(ai.fallbackUsed),
        primaryError: ai.primaryError || null,
        error: ai.error || null
      });

      return res.json({
        success: true,
        reply: toFriendlyAiFailureMessage({
          errorText: ai.error || ai.primaryError || '',
          fallbackUsed: Boolean(ai.fallbackUsed)
        })
      });
    }

    // modeValue === 'cv' (hoặc các trường hợp general đã bị ép vào CV-only)
    const profile = await getUserProfile(userId);

    const profileForPrompt = profile || {
      userId: userId || null,
      email: '',
      fullName: '',
      phone: '',
      address: '',
      birthday: '',
      gender: '',
      city: '',
      position: '',
      personalLink: ''
    };

    const missing = [];
    if (!profileForPrompt.fullName) missing.push('Họ tên');
    if (!profileForPrompt.email) missing.push('Email');
    if (!profileForPrompt.phone) missing.push('SĐT');
    if (!profileForPrompt.position) missing.push('Chức danh');
    if (!profileForPrompt.city) missing.push('Thành phố');

    if ((AI_PROVIDER === 'gemini' && GEMINI_API_KEY) || (AI_PROVIDER !== 'gemini' && OPENAI_API_KEY)) {
      const system =
        'Bạn là trợ lý viết CV. Chỉ trả lời nội dung liên quan CV/hồ sơ/phỏng vấn/việc làm; nếu câu hỏi khác thì từ chối lịch sự và mời quay lại chủ đề CV. ' +
        'Trả lời tiếng Việt, rõ ràng, không dùng markdown, không dùng dấu *, -, #, không tiêu đề. ' +
        'Viết tối đa 6 câu; có thể xuống dòng giữa các ý. ' +
        'Nếu thiếu dữ liệu, hãy hỏi tối đa 3 câu hỏi ngắn để lấy thông tin.';

      const ai = await callLLMChat({
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              `Yêu cầu: ${lastUserText}\n\n` +
              `Hồ sơ hiện tại (JSON): ${JSON.stringify(profileForPrompt)}\n\n` +
              `Trường còn thiếu: ${missing.join(', ') || 'Không'}`
          }
        ],
        temperature: 0.4
      });

      if (ai.ok) {
        return res.json({ success: true, reply: ai.text, data: { profile: profileForPrompt, missing } });
      }
    }

    // Fallback without key
    const reply =
      `Mình có thể giúp bạn hoàn thiện CV. Hiện mình thấy bạn có thể bổ sung: ${missing.join(', ') || 'không thiếu trường cơ bản nào'}\n\n` +
      `Gợi ý mục “Tóm tắt” (copy được):\n` +
      `- ${profileForPrompt.position || 'Ứng viên'} với kinh nghiệm liên quan, tập trung vào kết quả và kỹ năng cốt lõi. Mong muốn làm việc tại ${profileForPrompt.city || '...'} và phát triển lâu dài.\n\n` +
      `Bạn cho mình biết: (1) Vị trí muốn ứng tuyển, (2) số năm kinh nghiệm, (3) 3 kỹ năng mạnh nhất?`;

    return res.json({ success: true, reply, data: { profile: profileForPrompt, missing } });
  } catch (err) {
    console.error('AI chat error:', err);
    return res.status(500).json({ success: false, error: err.message || 'AI error' });
  }
});

router.post('/chat/cv-file', handleCvUpload, async (req, res) => {
  try {
    const file = req.file;
    const { userId, question } = req.body || {};

    if (!file) {
      return res.status(400).json({ success: false, error: 'Thiếu file CV (PDF hoặc DOCX).' });
    }

    const fileInfo = {
      name: file.originalname,
      mime: file.mimetype,
      size: file.size
    };

    const rawText = await extractTextFromCv(file);
    const trimmed = String(rawText || '').trim().slice(0, 12000);

    if (!trimmed) {
      console.warn('CV upload has no readable text', fileInfo);
      return res.status(400).json({
        success: false,
        error:
          'Không đọc được nội dung CV (có thể là PDF scan/ảnh hoặc file bị khóa). ' +
          'Vui lòng thử lại với file PDF xuất từ Word/Google Docs hoặc file DOCX.'
      });
    }

    const system =
      'Bạn là trợ lý CV của JobFinder. Phân tích CV và đưa nhận xét ngắn gọn, cụ thể. ' +
      'Trả lời tiếng Việt, không markdown, không bullet (*, -, #). Viết tối đa 8 câu, có thể xuống dòng. ' +
      'Nhấn mạnh 1) tóm tắt nhanh, 2) điểm mạnh, 3) thiếu thông tin, 4) gợi ý chỉnh sửa.';

    const userContent =
      (question ? `Yêu cầu của người dùng: ${question}\n\n` : '') +
      `Nội dung CV (đã rút gọn tối đa 12000 ký tự):\n${trimmed}`;

    const ai = await callLLMChat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent }
      ],
      temperature: 0.35
    });

    if (ai.ok) {
      return res.json({ success: true, reply: ai.text });
    }

    console.warn('AI cv-file chat failure:', {
      provider: ai.provider || AI_PROVIDER,
      fallbackUsed: Boolean(ai.fallbackUsed),
      primaryError: ai.primaryError || null,
      error: ai.error || null
    });

    return res.json({
      success: true,
      reply: toFriendlyAiFailureMessage({
        errorText: ai.error || ai.primaryError || '',
        fallbackUsed: Boolean(ai.fallbackUsed)
      })
    });
  } catch (err) {
    console.error('AI cv-file error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Lỗi phân tích CV.' });
  }
});

router.post('/chat/cv-stored', authenticateToken, async (req, res) => {
  try {
    const cvId = parseInt(req.body?.cvId, 10);
    const userId = parseInt(req.user?.id, 10);
    const question = String(req.body?.question || '').trim();
    const incomingMessages = normalizeChatMessages(req.body?.messages);

    if (Number.isNaN(userId)) {
      return res.status(401).json({ success: false, error: 'Phiên đăng nhập không hợp lệ.' });
    }

    if (Number.isNaN(cvId)) {
      return res.status(400).json({ success: false, error: 'cvId không hợp lệ.' });
    }

    const cvRow = await dbGet(
      `SELECT MaCV AS cvId, MaNguoiDung AS userId, TieuDe AS title, TomTat AS summary, TepCV AS filename
       FROM HoSoCV
       WHERE MaCV = ? AND MaNguoiDung = ?
       LIMIT 1`,
      [cvId, userId]
    );

    if (!cvRow) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy CV đã chọn.' });
    }

    const safeFilename = path.basename(String(cvRow.filename || ''));
    if (!safeFilename) {
      return res.status(400).json({ success: false, error: 'CV chưa có file hợp lệ để phân tích.' });
    }

    const absolutePath = path.join(CV_STORAGE_PATH, safeFilename);
    const cvTextRaw = await extractTextFromStoredCv({ filePath: absolutePath, filename: safeFilename });
    const cvText = String(cvTextRaw || '').replace(/\s+/g, ' ').trim().slice(0, MAX_STORED_CV_CHARS);

    if (!cvText) {
      return res.status(400).json({
        success: false,
        error:
          'Không đọc được nội dung CV đã chọn. Với file PDF scan hoặc DOC cũ, vui lòng chuyển sang PDF văn bản hoặc DOCX.'
      });
    }

    const lastUserText =
      question || [...incomingMessages].reverse().find((m) => m.role === 'user')?.content || 'Đánh giá CV và gợi ý việc làm phù hợp.';

    const profile = await getUserProfile(userId).catch(() => null);
    const keywords = extractKeywordsFromText(`${cvText}\n${lastUserText}`, 24);
    const publishedJobs = await loadPublishedJobs(120);
    const rankedJobs = recommendJobsByCv({
      jobs: publishedJobs,
      keywords,
      preferredCity: profile?.city || ''
    });

    const jobBrief = rankedJobs.slice(0, 6).map((job) => ({
      jobId: job.jobId,
      title: job.title,
      company: job.company,
      city: job.city,
      field: job.field,
      experience: job.experience,
      level: job.level,
      salaryFrom: job.salaryFrom,
      salaryTo: job.salaryTo
    }));

    const hasAIKey = (AI_PROVIDER === 'gemini' && !!GEMINI_API_KEY) || (AI_PROVIDER !== 'gemini' && !!OPENAI_API_KEY);

    if (hasAIKey) {
      const system =
        'Bạn là trợ lý nghề nghiệp của JobFinder. Nhiệm vụ: đọc nội dung CV, đánh giá nhanh, và gợi ý việc làm phù hợp từ danh sách job được cung cấp. ' +
        'Chỉ trả lời tiếng Việt, không markdown, không dùng *, -, #. ' +
        'Tối đa 10 câu, có thể xuống dòng. ' +
        'Bắt buộc nêu: 1) nhận xét CV, 2) điểm cần cải thiện, 3) 3-5 việc làm phù hợp nhất kèm lý do ngắn.';

      const ai = await callLLMChat({
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              `Câu hỏi người dùng: ${lastUserText}\n\n` +
              `Thông tin người dùng: ${JSON.stringify({ userId, city: profile?.city || '', position: profile?.position || '' })}\n\n` +
              `CV (${cvRow.title || 'CV đã chọn'}):\n${cvText}\n\n` +
              `Danh sách công việc đang tuyển (chỉ chọn trong danh sách này):\n${JSON.stringify(jobBrief)}`
          }
        ],
        temperature: 0.35
      });

      if (ai.ok) {
        return res.json({
          success: true,
          reply: ai.text,
          matchedJobs: jobBrief.slice(0, 5)
        });
      }
    }

    const lines = [
      `Mình đã đọc CV: ${cvRow.title || 'CV của bạn'}.`,
      `CV hiện đã có dữ liệu để đánh giá, nhưng bạn nên bổ sung rõ hơn thành tích theo số liệu và công nghệ/kỹ năng cốt lõi.`,
      `Các công việc phù hợp trên JobFinder:`
    ];

    jobBrief.slice(0, 5).forEach((job, index) => {
      lines.push(formatJobSuggestionLine(job, index));
    });

    lines.push('Nếu bạn muốn, mình sẽ viết luôn phiên bản tóm tắt CV tối ưu cho 1 vị trí trong danh sách trên.');

    return res.json({
      success: true,
      reply: lines.join('\n'),
      matchedJobs: jobBrief.slice(0, 5)
    });
  } catch (err) {
    console.error('AI cv-stored error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Lỗi phân tích CV đã lưu.' });
  }
});

module.exports = router;
