const express = require('express');
const https = require('https');
const db = require('../config/sqlite');
const { jobs: mockJobs } = require('../data/mockJobs');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const AI_PROVIDER = (process.env.AI_PROVIDER || (GEMINI_API_KEY ? 'gemini' : 'openai')).toLowerCase();

const MAX_MESSAGE_CHARS = 6000;
const MAX_MESSAGES = 20;

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
  if (AI_PROVIDER === 'gemini') return callGeminiGenerateContent({ messages, temperature });
  return callOpenAIChat({ messages, temperature });
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

      // No key / error fallback
      return res.json({
        success: true,
        reply:
          ai.error ||
          (AI_PROVIDER === 'gemini'
            ? 'Hiện chưa cấu hình AI (GEMINI_API_KEY). Bạn thêm key vào server/.env rồi restart server giúp mình nhé.'
            : 'Hiện chưa cấu hình AI (OPENAI_API_KEY). Bạn thêm key vào server/.env rồi restart server giúp mình nhé.')
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

    return res.json({
      success: true,
      reply:
        ai.error ||
        (AI_PROVIDER === 'gemini'
          ? 'Chưa cấu hình GEMINI_API_KEY. Thêm key vào server/.env rồi khởi động lại server.'
          : 'Chưa cấu hình OPENAI_API_KEY. Thêm key vào server/.env rồi khởi động lại server.')
    });
  } catch (err) {
    console.error('AI cv-file error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Lỗi phân tích CV.' });
  }
});

module.exports = router;
