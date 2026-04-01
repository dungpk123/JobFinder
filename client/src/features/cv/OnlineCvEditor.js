import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';
import './OnlineCvEditor.css';

const useQuery = () => {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
};

const escapeHtml = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\"/g, '&quot;')
  .replace(/'/g, '&#039;');

const TEMPLATE_OPTIONS = [
  { key: 'accent-one', label: 'Mẫu 1 (Xanh ngọc)' },
  { key: 'accent-two', label: 'Mẫu 2 (Xanh dương)' },
  { key: 'accent-three', label: 'Mẫu 3 (Xanh lá)' },
  { key: 'accent-four', label: 'Mẫu 4 (Tím)' }
];

const normalizeTemplateKey = (value) => {
  const v = String(value || '').trim();
  if (!v) return 'accent-one';
  const ok = /^[a-z0-9-]{1,50}$/i.test(v);
  return ok ? v : 'accent-one';
};

// Sample data for preview
const SAMPLE_DATA = {
  title: 'CV Ứng Viên Chuyên Nghiệp',
  summary: 'Tôi là người có tinh thần trách nhiệm, ham học hỏi và chủ động trong công việc. Có khả năng làm việc nhóm tốt, thích nghi nhanh với môi trường mới và luôn sẵn sàng tiếp thu kiến thức để phát triển bản thân.',
  skills: `• Quản lý dự án và làm việc nhóm
• Giao tiếp và thuyết trình
• Tin học văn phòng: Word, Excel, PowerPoint
• Kỹ năng giải quyết vấn đề
• Tư duy sáng tạo và phân tích`,
  experience: `Nhân viên Marketing - Công ty ABC
01/2022 - Hiện tại
• Xây dựng và triển khai chiến dịch marketing trên mạng xã hội
• Phân tích dữ liệu khách hàng và đề xuất giải pháp tối ưu
• Phối hợp với đội ngũ thiết kế để tạo nội dung hấp dẫn
• Đạt mức tăng trưởng 35% về lượng khách hàng tiềm năng

Thực tập sinh Marketing - Công ty XYZ
06/2021 - 12/2021
• Hỗ trợ team marketing trong các hoạt động quảng bá sản phẩm
• Nghiên cứu thị trường và đối thủ cạnh tranh
• Tham gia tổ chức các sự kiện offline và online`,
  education: `Đại học Kinh tế TP.HCM
09/2018 - 06/2022
Chuyên ngành: Quản trị Marketing
GPA: 3.5/4.0

Các chứng chỉ:
• Google Analytics Certification (2022)
• Facebook Blueprint Certification (2021)
• IELTS 7.0 (2020)`,
  languages: `• Tiếng Việt: Bản ngữ
• Tiếng Anh: Thành thạo (IELTS 7.0)
• Tiếng Trung: Cơ bản`,
  projects: `Chiến dịch "Mùa hè sôi động" - Công ty ABC (2023)
• Lên kế hoạch và triển khai chiến dịch marketing tích hợp
• Quản lý ngân sách 200 triệu đồng
• Đạt 150% chỉ tiêu doanh số đề ra
• Thu hút 50,000+ khách hàng tương tác

Website Thương mại điện tử (Dự án cá nhân, 2022)
• Thiết kế và phát triển website bán hàng online
• Tích hợp thanh toán và quản lý đơn hàng
• Đạt 1000+ lượt truy cập/tháng trong 3 tháng đầu`
};

const OnlineCvEditor = () => {
  const navigate = useNavigate();
  const query = useQuery();
  const { notify } = useNotification();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const userId = user?.id || user?.MaNguoiDung || user?.maNguoiDung || user?.userId || user?.userID || null;
  // Be tolerant to different query param keys.
  const cvId = query.get('cvId') || query.get('cvid') || query.get('id');
  const templateFromUrl = normalizeTemplateKey(query.get('template'));

  // Avoid showing scary errors right after a successful save, when the subsequent reload
  // request may transiently fail (e.g., proxy/backend warming up -> 504).
  const suppressLoadErrorsUntilRef = useRef(0);

  const readErrorMessage = async (res, fallback) => {
    try {
      const data = await res.json();
      return data?.error || fallback;
    } catch {
      try {
        const txt = await res.text();
        const snippet = String(txt || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        return snippet ? `${fallback} (HTTP ${res.status}): ${snippet}` : `${fallback} (HTTP ${res.status})`;
      } catch {
        return `${fallback} (HTTP ${res.status})`;
      }
    }
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isTransientHttp = (status) => status === 502 || status === 503 || status === 504;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Use sample data initially if creating new CV (no cvId)
  const isNewCv = !cvId;
  const [title, setTitle] = useState(isNewCv ? SAMPLE_DATA.title : 'CV Online');
  const [summary, setSummary] = useState(isNewCv ? SAMPLE_DATA.summary : '');
  const [skills, setSkills] = useState(isNewCv ? SAMPLE_DATA.skills : '');
  const [experience, setExperience] = useState(isNewCv ? SAMPLE_DATA.experience : '');
  const [education, setEducation] = useState(isNewCv ? SAMPLE_DATA.education : '');
  const [languages, setLanguages] = useState(isNewCv ? SAMPLE_DATA.languages : '');
  const [projects, setProjects] = useState(isNewCv ? SAMPLE_DATA.projects : '');

  const [templateKey, setTemplateKey] = useState(templateFromUrl);

  const [profile, setProfile] = useState(null);

  const fetchProfile = async () => {
    if (!userId) return;
    const stripHtml = (html = '') => html.replace(/<br\s*\/>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const formatRange = (start, end) => {
      const s = String(start || '').trim();
      const e = String(end || '').trim();
      if (s && e) return `${s} - ${e}`;
      if (s) return s;
      if (e) return e;
      return '';
    };
    const fillFromLists = (p) => {
      if (!experience && Array.isArray(p.workList) && p.workList.length) {
        const lines = p.workList.map(w => {
          const main = [w.position, w.company].filter(Boolean).join(' - ');
          const time = formatRange(w.start || `${w.startMonth || ''}/${w.startYear || ''}`, w.isCurrentlyWorking ? 'HIỆN TẠI' : (w.end || `${w.endMonth || ''}/${w.endYear || ''}`));
          const desc = stripHtml(w.descriptionHtml || w.description || '');
          return [main, time, desc].filter(Boolean).join(' | ');
        }).filter(Boolean).join('\n');
        if (lines) setExperience(lines);
      }

      if (!education && Array.isArray(p.educationList) && p.educationList.length) {
        const lines = p.educationList.map(ed => {
          const main = [ed.university, ed.level].filter(Boolean).join(' - ');
          const major = ed.major ? `Ngành: ${ed.major}` : '';
          const time = formatRange(ed.start || `${ed.startMonth || ''}/${ed.startYear || ''}`, ed.isCurrentlyStudying ? 'HIỆN TẠI' : (ed.end || `${ed.endMonth || ''}/${ed.endYear || ''}`));
          const desc = ed.description ? stripHtml(ed.description) : '';
          return [main, major, time, desc].filter(Boolean).join(' | ');
        }).filter(Boolean).join('\n');
        if (lines) setEducation(lines);
      }

      if (!languages && Array.isArray(p.languageList) && p.languageList.length) {
        const lines = p.languageList.map(l => [l.language, l.level && `(${l.level})`].filter(Boolean).join(' ')).filter(Boolean).join('\n');
        if (lines) setLanguages(lines);
      }
    };

    try {
      const res = await fetch(`/users/profile/${encodeURIComponent(userId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) return;
      setProfile(data.profile || null);

      const p = data.profile || {};
      if (!summary && p.introHtml) setSummary(stripHtml(p.introHtml));
      fillFromLists(p);
    } catch {
      setProfile(null);
    } finally {
      if (!summary || !experience || !education || !languages) {
        try {
          const draft = JSON.parse(localStorage.getItem('profileDraft') || '{}');
          fillFromLists(draft);
          if (!summary && draft.introHtml) setSummary(stripHtml(draft.introHtml));
        } catch {}
      }
    }
  };

  const fetchExistingOnlineCv = async () => {
    if (!userId || !cvId) return;
    setLoading(true);
    try {
      const url = `/api/cvs/online/${encodeURIComponent(cvId)}?userId=${encodeURIComponent(userId)}`;

      // Retry a couple times for transient network/proxy issues.
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const res = await fetch(url);
          if (!res.ok) {
            const msg = await readErrorMessage(res, 'Không tải được CV online');
            const err = new Error(msg);
            err.__status = res.status;
            throw err;
          }
          const data = await res.json().catch(() => ({}));
          if (!data.success) throw new Error(data.error || 'Không tải được CV online');

          setTitle(data.cv?.title || 'CV Online');
          setSummary(data.cv?.summary || '');
          setSkills(data.cv?.content?.skills || '');
          setExperience(data.cv?.content?.experience || '');
          setEducation(data.cv?.content?.education || '');
          setLanguages(data.cv?.content?.languages || '');
          setProjects(data.cv?.content?.projects || '');
          if (data.cv?.templateKey) setTemplateKey(normalizeTemplateKey(data.cv.templateKey));
          return;
        } catch (e) {
          lastError = e;
          const status = e?.__status;
          const transient = status ? isTransientHttp(status) : true;
          if (!transient || attempt === 2) break;
          await sleep(500 * (attempt + 1));
        }
      }

      throw lastError || new Error('Không tải được CV online');
    } catch (err) {
      // If we just saved successfully, suppress load error noise for a short time.
      const now = Date.now();
      if (now >= suppressLoadErrorsUntilRef.current) {
        notify({ type: 'error', message: err.message || 'Không tải được CV online' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!cvId) setTemplateKey(templateFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateFromUrl, cvId]);

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    fetchExistingOnlineCv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvId, userId]);

  const buildHtml = () => {
    const p = profile || {};
    const pick = (...vals) => vals.find(v => String(v || '').trim()) || '';

    // Use sample data for preview if fields are empty and it's a new CV
    const useSample = isNewCv && !cvId;
    
    const name = escapeHtml(pick(p.fullName, p.HoTen, p.hoTen, user?.name, user?.HoTen, user?.hoTen, useSample ? 'Nguyễn Văn A' : 'Ứng viên'));
    const position = escapeHtml(pick(p.position, p.viTriMongMuon, p.ViTriMongMuon, useSample ? 'Chuyên viên Marketing' : ''));
    const email = escapeHtml(pick(p.email, p.Email, user?.email, user?.Email, useSample ? 'ungvien@example.com' : ''));
    const phone = escapeHtml(pick(p.phone, p.SoDienThoai, p.soDienThoai, useSample ? '0987654321' : ''));
    const birthday = escapeHtml(pick(p.birthday, p.NgaySinh, p.ngaySinh, useSample ? '15/03/1998' : ''));
    const address = escapeHtml(pick(p.address, p.DiaChi, p.diaChi, useSample ? '123 Đường ABC, Quận 1' : ''));
    const city = escapeHtml(pick(p.city, p.ThanhPho, p.thanhPho, useSample ? 'Hồ Chí Minh' : ''));
    const link = escapeHtml(pick(p.personalLink, p.LinkCaNhan, p.linkCaNhan, useSample ? 'linkedin.com/in/nguyenvana' : ''));
    const avatarUrl = pick(p.avatarUrl, p.AnhDaiDien, p.anhDaiDien, p.avatar, '');

    const section = (label, body) => {
      const t = String(body || '').trim();
      if (!t) return '';
      const safe = escapeHtml(t).replace(/\n/g, '<br/>');
      return `
        <section style="margin-top: 14px;">
          <h3 style="margin: 0 0 6px; font-size: 14px; letter-spacing: 0.2px; text-transform: uppercase;">${label}</h3>
          <div style="color:#111827; font-size: 13.5px; line-height: 1.55;">${safe}</div>
        </section>
      `;
    };

    const safeSummary = String(summary || '').trim();
    const tKey = normalizeTemplateKey(templateKey);

    // Template styles mapping
    const theme = (() => {
      switch (tKey) {
        case 'accent-two':
          return { accent: '#1d4ed8', sidebar: '#1e3a8a', bg: '#f6f7f9' };
        case 'accent-three':
          return { accent: '#15803d', sidebar: '#14532d', bg: '#f6f7f9' };
        case 'accent-four':
          return { accent: '#6d28d9', sidebar: '#4c1d95', bg: '#f6f7f9' };
        case 'accent-five':
          return { accent: '#dc2626', sidebar: '#991b1b', bg: '#fef2f2' };
        case 'accent-six':
          return { accent: '#ea580c', sidebar: '#c2410c', bg: '#fff7ed' };
        case 'accent-seven':
          return { accent: '#0891b2', sidebar: '#0e7490', bg: '#ecfeff' };
        case 'accent-eight':
          return { accent: '#4f46e5', sidebar: '#3730a3', bg: '#eef2ff' };
        case 'accent-nine':
          return { accent: '#059669', sidebar: '#047857', bg: '#f0fdf4' };
        case 'accent-ten':
          return { accent: '#db2777', sidebar: '#9f1239', bg: '#fdf2f8' };
        case 'accent-eleven':
          return { accent: '#7c3aed', sidebar: '#5b21b6', bg: '#f5f3ff' };
        case 'accent-twelve':
          return { accent: '#0d9488', sidebar: '#115e59', bg: '#f0fdfa' };
        case 'accent-one':
        default:
          return { accent: '#2f6f7a', sidebar: '#2f6f7a', bg: '#f6f7f9' };
      }
    })();

    // Return different layouts based on template
    if (tKey === 'accent-seven' || tKey === 'accent-eight') {
      // Modern creative layout - single column with header
      return buildModernTemplate(theme, { name, position, email, phone, birthday, address, city, link, avatarUrl, safeSummary, section });
    } else if (tKey === 'accent-nine' || tKey === 'accent-ten') {
      // Professional two-column layout (reversed)
      return buildProfessionalTemplate(theme, { name, position, email, phone, birthday, address, city, link, avatarUrl, safeSummary, section });
    } else if (tKey === 'accent-eleven' || tKey === 'accent-twelve') {
      // Minimalist layout
      return buildMinimalistTemplate(theme, { name, position, email, phone, birthday, address, city, link, avatarUrl, safeSummary, section });
    } else {
      // Classic sidebar layout (default)
      return buildClassicTemplate(theme, { name, position, email, phone, birthday, address, city, link, avatarUrl, safeSummary, section });
    }
  };

  // Classic sidebar template
  const buildClassicTemplate = (theme, data) => {
    const { name, position, email, phone, birthday, address, city, link, avatarUrl, safeSummary, section } = data;

    const contactRow = (label, value) => {
      const v = String(value || '').trim();
      if (!v) return '';
      return `
        <div class="c-row">
          <div class="c-label">${label}</div>
          <div class="c-value">${escapeHtml(v)}</div>
        </div>
      `;
    };

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title || 'CV Online')}</title>
<style>
  :root{--accent:${theme.accent}; --sidebar:${theme.sidebar}; --bg:${theme.bg};}
  *{box-sizing:border-box;}
  body{font-family: Arial, Helvetica, sans-serif; background:var(--bg); margin:0; padding:24px; color:#0f172a;}
  .page{max-width: 980px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;}
  .layout{display:flex; min-height: 980px;}
  .sidebar{width: 300px; background:var(--sidebar); color:#fff; padding:22px;}
  .main{flex:1; padding:26px 28px;}
  .avatarWrap{width: 170px; height: 170px; border-radius:10px; background: rgba(255,255,255,0.18); overflow:hidden; display:flex; align-items:center; justify-content:center; margin-bottom:16px;}
  .avatarWrap img{width:100%; height:100%; object-fit:cover; display:block;}
  .avatarPh{font-size:12px; opacity:0.85;}
  .sidebarTitle{font-weight:700; letter-spacing:0.2px; margin: 14px 0 10px;}
  .c-row{margin-bottom:10px;}
  .c-label{font-size:12px; opacity:0.9; font-weight:700;}
  .c-value{font-size:12.5px; opacity:0.95; margin-top:2px; word-break:break-word;}

  h1{margin:0; font-size:34px; letter-spacing:0.2px; color: var(--accent);}
  .cvTitle{margin-top:6px; font-size:13px; letter-spacing:2px; color:#64748b; text-transform:uppercase;}
  .position{margin-top:10px; font-size:14px; color:#334155;}

  .section{margin-top:18px;}
  .section h3{margin:0 0 8px; font-size:13px; letter-spacing:0.8px; text-transform:uppercase; color:#0f172a;}
  .section .body{font-size:13.5px; line-height:1.62; color:#111827;}
  .divider{height:1px; background:#e5e7eb; margin: 14px 0;}
  .tagline{color:#64748b; font-size:12.5px;}
  @media print{
    body{background:#fff; padding:0;}
    .page{border:none; border-radius:0;}
  }
</style>
</head>
<body>
  <div class="page">
    <div class="layout">
      <aside class="sidebar">
        <div class="avatarWrap">
          ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="avatar" />` : `<div class="avatarPh">Ảnh hồ sơ</div>`}
        </div>
        <div class="sidebarTitle">Liên hệ</div>
        ${contactRow('Số điện thoại', phone)}
        ${contactRow('Email', email)}
        ${contactRow('Ngày sinh', birthday)}
        ${contactRow('Địa chỉ', address || city)}
        ${link ? `<div class="divider"></div>${contactRow('Liên kết', link)}` : ''}
      </aside>

      <main class="main">
        <h1>${name}</h1>
        <div class="cvTitle">${escapeHtml(title || 'TIÊU ĐỀ HỒ SƠ')}</div>
        ${position ? `<div class="position">${position}</div>` : `<div class="tagline">CV Online</div>`}

        ${safeSummary ? `<div class="section">${section('Mục tiêu nghề nghiệp', safeSummary)}</div>` : ''}
        ${skills ? `<div class="section">${section('Kỹ năng', skills)}</div>` : ''}
        ${experience ? `<div class="section">${section('Kinh nghiệm', experience)}</div>` : ''}
        ${education ? `<div class="section">${section('Học vấn', education)}</div>` : ''}
        ${languages ? `<div class="section">${section('Ngoại ngữ', languages)}</div>` : ''}
        ${projects ? `<div class="section">${section('Dự án đã làm', projects)}</div>` : ''}
      </main>
    </div>
  </div>
</body>
</html>`;
  };

  // Modern creative template - single column with top header
  const buildModernTemplate = (theme, data) => {
    const { name, position, email, phone, birthday, address, city, link, avatarUrl, safeSummary, section } = data;
    
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title || 'CV Online')}</title>
<style>
  :root{--accent:${theme.accent}; --sidebar:${theme.sidebar}; --bg:${theme.bg};}
  *{box-sizing:border-box;}
  body{font-family: Arial, Helvetica, sans-serif; background:var(--bg); margin:0; padding:24px; color:#0f172a;}
  .page{max-width: 980px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;}
  .header{background:var(--accent); color:#fff; padding:32px 40px; text-align:center;}
  .avatar{width:120px; height:120px; border-radius:50%; background:rgba(255,255,255,0.2); margin:0 auto 16px; overflow:hidden; display:flex; align-items:center; justify-content:center;}
  .avatar img{width:100%; height:100%; object-fit:cover;}
  .avatarPh{font-size:11px; opacity:0.8;}
  h1{margin:0; font-size:36px; letter-spacing:0.5px; color:#fff;}
  .position{margin-top:8px; font-size:15px; opacity:0.92;}
  .contacts{display:flex; justify-content:center; gap:20px; margin-top:14px; flex-wrap:wrap; font-size:13px; opacity:0.9;}
  .main{padding:32px 40px;}
  .section{margin-bottom:24px;}
  .section h3{margin:0 0 10px; font-size:14px; letter-spacing:1px; text-transform:uppercase; color:var(--accent); border-bottom:2px solid var(--accent); padding-bottom:4px;}
  .section .body{font-size:13.5px; line-height:1.62; color:#111827;}
  @media print{
    body{background:#fff; padding:0;}
    .page{border:none; border-radius:0;}
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="avatar">
        ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="avatar" />` : `<div class="avatarPh">Ảnh</div>`}
      </div>
      <h1>${name}</h1>
      ${position ? `<div class="position">${position}</div>` : ''}
      <div class="contacts">
        ${email ? `<span>📧 ${escapeHtml(email)}</span>` : ''}
        ${phone ? `<span>📱 ${escapeHtml(phone)}</span>` : ''}
        ${(address || city) ? `<span>📍 ${escapeHtml(address || city)}</span>` : ''}
      </div>
    </div>
    <div class="main">
      ${safeSummary ? `<div class="section">${section('Mục tiêu nghề nghiệp', safeSummary)}</div>` : ''}
      ${skills ? `<div class="section">${section('Kỹ năng', skills)}</div>` : ''}
      ${experience ? `<div class="section">${section('Kinh nghiệm làm việc', experience)}</div>` : ''}
      ${education ? `<div class="section">${section('Học vấn', education)}</div>` : ''}
      ${projects ? `<div class="section">${section('Dự án', projects)}</div>` : ''}
      ${languages ? `<div class="section">${section('Ngôn ngữ', languages)}</div>` : ''}
    </div>
  </div>
</body>
</html>`;
  };

  // Professional two-column template (main left, sidebar right)
  const buildProfessionalTemplate = (theme, data) => {
    const { name, position, email, phone, birthday, address, city, link, avatarUrl, safeSummary, section } = data;
    
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title || 'CV Online')}</title>
<style>
  :root{--accent:${theme.accent}; --sidebar:${theme.sidebar}; --bg:${theme.bg};}
  *{box-sizing:border-box;}
  body{font-family: Arial, Helvetica, sans-serif; background:var(--bg); margin:0; padding:24px; color:#0f172a;}
  .page{max-width: 980px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:12px; overflow:hidden;}
  .layout{display:flex; min-height:980px;}
  .main{flex:1; padding:32px; background:#fff;}
  .sidebar{width:280px; background:var(--sidebar); color:#fff; padding:28px 20px;}
  .avatar{width:100px; height:100px; border-radius:50%; background:rgba(255,255,255,0.15); margin:0 auto 16px; overflow:hidden; display:flex; align-items:center; justify-content:center;}
  .avatar img{width:100%; height:100%; object-fit:cover;}
  .avatarPh{font-size:11px; opacity:0.8;}
  h1{margin:0 0 6px; font-size:32px; color:var(--accent); letter-spacing:0.3px;}
  .position{font-size:15px; color:#64748b; margin-bottom:18px;}
  .section{margin-bottom:24px;}
  .section h3{margin:0 0 10px; font-size:13px; letter-spacing:0.8px; text-transform:uppercase; color:var(--accent); font-weight:700;}
  .section .body{font-size:13.5px; line-height:1.62; color:#111827;}
  .sidebarSection{margin-bottom:20px;}
  .sidebarSection h4{margin:0 0 10px; font-size:12px; letter-spacing:1px; text-transform:uppercase; font-weight:700; opacity:0.95;}
  .sidebarRow{margin-bottom:8px; font-size:12.5px; opacity:0.9; line-height:1.5;}
  @media print{
    body{background:#fff; padding:0;}
    .page{border:none; border-radius:0;}
  }
</style>
</head>
<body>
  <div class="page">
    <div class="layout">
      <div class="main">
        <h1>${name}</h1>
        ${position ? `<div class="position">${position}</div>` : ''}
        ${safeSummary ? `<div class="section">${section('Giới thiệu', safeSummary)}</div>` : ''}
        ${experience ? `<div class="section">${section('Kinh nghiệm', experience)}</div>` : ''}
        ${projects ? `<div class="section">${section('Dự án', projects)}</div>` : ''}
        ${education ? `<div class="section">${section('Học vấn', education)}</div>` : ''}
      </div>
      <aside class="sidebar">
        <div class="avatar">
          ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="avatar" />` : `<div class="avatarPh">Ảnh</div>`}
        </div>
        <div class="sidebarSection">
          <h4>Liên hệ</h4>
          ${phone ? `<div class="sidebarRow">📱 ${escapeHtml(phone)}</div>` : ''}
          ${email ? `<div class="sidebarRow">📧 ${escapeHtml(email)}</div>` : ''}
          ${(address || city) ? `<div class="sidebarRow">📍 ${escapeHtml(address || city)}</div>` : ''}
          ${link ? `<div class="sidebarRow">🔗 ${escapeHtml(link)}</div>` : ''}
        </div>
        ${skills ? `<div class="sidebarSection"><h4>Kỹ năng</h4><div class="sidebarRow">${escapeHtml(String(skills || '')).replace(/\n/g, '<br/>')}</div></div>` : ''}
        ${languages ? `<div class="sidebarSection"><h4>Ngôn ngữ</h4><div class="sidebarRow">${escapeHtml(String(languages || '')).replace(/\n/g, '<br/>')}</div></div>` : ''}
      </aside>
    </div>
  </div>
</body>
</html>`;
  };

  // Minimalist template - clean and simple
  const buildMinimalistTemplate = (theme, data) => {
    const { name, position, email, phone, birthday, address, city, link, avatarUrl, safeSummary, section } = data;
    
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title || 'CV Online')}</title>
<style>
  :root{--accent:${theme.accent}; --bg:${theme.bg};}
  *{box-sizing:border-box;}
  body{font-family: 'Georgia', serif; background:var(--bg); margin:0; padding:24px; color:#1f2937;}
  .page{max-width: 850px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:48px 56px;}
  .header{text-align:center; border-bottom:3px solid var(--accent); padding-bottom:20px; margin-bottom:32px;}
  h1{margin:0; font-size:38px; color:#111827; letter-spacing:1px; font-weight:400;}
  .position{margin-top:8px; font-size:16px; color:#64748b; font-style:italic;}
  .contacts{margin-top:12px; font-size:13px; color:#6b7280; display:flex; justify-content:center; gap:16px; flex-wrap:wrap;}
  .section{margin-bottom:28px;}
  .section h3{margin:0 0 12px; font-size:15px; letter-spacing:2px; text-transform:uppercase; color:var(--accent); font-weight:600; border-bottom:1px solid #e5e7eb; padding-bottom:6px;}
  .section .body{font-size:14px; line-height:1.7; color:#374151;}
  @media print{
    body{background:#fff; padding:0;}
    .page{border:none; border-radius:0;}
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>${name}</h1>
      ${position ? `<div class="position">${position}</div>` : ''}
      <div class="contacts">
        ${email ? `<span>${escapeHtml(email)}</span>` : ''}
        ${phone ? `<span>${escapeHtml(phone)}</span>` : ''}
        ${(address || city) ? `<span>${escapeHtml(address || city)}</span>` : ''}
        ${link ? `<span>${escapeHtml(link)}</span>` : ''}
      </div>
    </div>
    ${safeSummary ? `<div class="section">${section('Giới thiệu', safeSummary)}</div>` : ''}
    ${experience ? `<div class="section">${section('Kinh nghiệm', experience)}</div>` : ''}
    ${education ? `<div class="section">${section('Học vấn', education)}</div>` : ''}
    ${skills ? `<div class="section">${section('Kỹ năng', skills)}</div>` : ''}
    ${languages ? `<div class="section">${section('Ngôn ngữ', languages)}</div>` : ''}
    ${projects ? `<div class="section">${section('Dự án', projects)}</div>` : ''}
  </div>
</body>
</html>`;
  };

  const onSave = async () => {
    if (!userId) {
      notify({ type: 'error', message: 'Bạn cần đăng nhập để tạo CV online.' });
      return;
    }

    const t = String(title || '').trim();
    if (!t) {
      notify({ type: 'error', message: 'Vui lòng nhập tiêu đề CV.' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        userId,
        title: t,
        summary: String(summary || ''),
        templateKey: normalizeTemplateKey(templateKey),
        content: {
          skills: String(skills || ''),
          experience: String(experience || ''),
          projects: String(projects || ''),
          education: String(education || ''),
          languages: String(languages || '')
        },
        html: buildHtml(),
        cvId: cvId || null
      };

      const res = await fetch('/api/cvs/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const msg = await readErrorMessage(res, 'Không thể lưu CV online');
        throw new Error(msg);
      }
      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.error || 'Không thể lưu CV online');

      notify({ type: 'success', message: 'Đã lưu CV online.' });
      suppressLoadErrorsUntilRef.current = Date.now() + 8000;
      const newId = data.cv?.id;
      if (newId && !cvId) {
        navigate(`/create-cv/online-editor?cvId=${encodeURIComponent(newId)}&template=${encodeURIComponent(normalizeTemplateKey(templateKey))}`, { replace: true });
      }
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không thể lưu CV online' });
    } finally {
      setSaving(false);
    }
  };

  const onPrint = () => {
    const html = buildHtml();
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  if (!userId) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning mb-0">Bạn cần đăng nhập để tạo CV online.</div>
      </div>
    );
  }

  return (
    <div className="container py-4 online-cv-editor-page">
      <div className="cv-editor-header">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h3><i className="bi bi-file-earmark-text me-2"></i>CV Online</h3>
            <div className="text-muted">Chỉnh sửa trực tiếp trên web. Bạn có thể in ra PDF bằng chức năng In.</div>
          </div>
          <div className="cv-editor-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/create-cv')}>
              <i className="bi bi-arrow-left-circle me-2"></i>Về Tạo CV
            </button>
            <button type="button" className="btn btn-outline-primary" onClick={onPrint}>
              <i className="bi bi-download me-2"></i>Tải PDF (In)
            </button>
            <button type="button" className="btn btn-success" onClick={onSave} disabled={saving || loading}>
              <i className="bi bi-check-circle me-2"></i>{saving ? 'Đang lưu...' : 'Lưu CV Online'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="cv-editor-loading">
          <i className="bi bi-hourglass-split d-block"></i>
          Đang tải CV...
        </div>
      ) : null}

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="cv-editor-form-card">
            <div className="card-body">
              <div className="cv-editor-form-group">
                <label className="cv-editor-label">
                  <i className="bi bi-palette"></i>Mẫu CV
                </label>
                <select className="form-select cv-editor-select cv-editor-template-select" value={templateKey} onChange={(e) => setTemplateKey(normalizeTemplateKey(e.target.value))}>
                  {TEMPLATE_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="cv-editor-form-group">
                <label className="cv-editor-label">
                  <i className="bi bi-type"></i>Tiêu đề CV
                </label>
                <input className="form-control cv-editor-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Lập trình viên Frontend" />
              </div>
              <div className="cv-editor-form-group">
                <label className="cv-editor-label">
                  <i className="bi bi-person-badge"></i>Tóm tắt / Mục tiêu nghề nghiệp
                </label>
                <textarea className="form-control cv-editor-textarea" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Giới thiệu ngắn gọn về bản thân và mục tiêu nghề nghiệp..." />
              </div>
              <div className="cv-editor-form-group">
                <label className="cv-editor-label">
                  <i className="bi bi-star"></i>Kỹ năng
                </label>
                <textarea className="form-control cv-editor-textarea" rows={4} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Ví dụ: React, Node.js, SQL..." />
              </div>
              <div className="cv-editor-form-group">
                <label className="cv-editor-label">
                  <i className="bi bi-briefcase"></i>Kinh nghiệm làm việc
                </label>
                <textarea className="form-control cv-editor-textarea" rows={5} value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Vị trí | Công ty | Thời gian | Mô tả công việc" />
              </div>
              <div className="cv-editor-form-group">
                <label className="cv-editor-label">
                  <i className="bi bi-kanban"></i>Dự án đã làm
                </label>
                <textarea
                  className="form-control cv-editor-textarea"
                  rows={5}
                  value={projects}
                  onChange={(e) => setProjects(e.target.value)}
                  placeholder="Tên dự án | Vai trò | Công nghệ | Kết quả"
                />
              </div>
              <div className="cv-editor-form-group">
                <label className="cv-editor-label">
                  <i className="bi bi-mortarboard"></i>Học vấn
                </label>
                <textarea className="form-control cv-editor-textarea" rows={4} value={education} onChange={(e) => setEducation(e.target.value)} placeholder="Trường | Bằng cấp | Thời gian" />
              </div>
              <div className="cv-editor-form-group">
                <label className="cv-editor-label">
                  <i className="bi bi-translate"></i>Ngoại ngữ
                </label>
                <textarea className="form-control cv-editor-textarea" rows={3} value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="Ví dụ: Tiếng Anh (IELTS 7.0)" />
              </div>
              <div className="cv-editor-hint">
                <i className="bi bi-info-circle"></i>
                <span>Thông tin tên, email, số điện thoại, thành phố sẽ lấy từ Hồ sơ của bạn (trang Profile).</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="cv-editor-preview-card">
            <div className="cv-editor-preview-header">
              <i className="bi bi-eye"></i>
              <div className="fw-semibold">Xem trước CV</div>
            </div>
            <div className="cv-editor-preview-body">
              <iframe
                title="CV Preview"
                className="cv-editor-preview-iframe"
                srcDoc={buildHtml()}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnlineCvEditor;

