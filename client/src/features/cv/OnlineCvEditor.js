import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';
import { API_BASE } from '../../config/apiBase';
import './OnlineCvEditor.css';

const useQuery = () => {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
};

const escapeHtml = (s = '') => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const stripScriptsFromHtml = (html = '') => String(html).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

const injectPreviewEditorScript = (html) => {
  if (!html || typeof html !== 'string') return html;
  if (html.includes('__cv_live_editor_hook__')) return html;

  const script = `
<script id="__cv_live_editor_hook__">
(function () {
  if (window.__cvLiveEditorHooked) return;
  window.__cvLiveEditorHooked = true;

  function post(type, payload) {
    window.parent.postMessage(Object.assign({ __cv_editor: true, type: type }, payload || {}), '*');
  }

  var style = document.createElement('style');
  style.id = '__cv_live_editor_style__';
  style.textContent =
    'body{padding-left:16px!important;padding-right:16px!important;box-sizing:border-box;}' +
    '@media print{body{padding-left:0!important;padding-right:0!important;}}' +
    '.toolbar,.toolbar.no-print,#resetBtn{display:none!important;}' +
    '.shell{padding-top:0!important;padding-bottom:0!important;}' +
    '.stage{max-width:none!important;display:flex!important;justify-content:center!important;overflow:auto!important;padding:0!important;}' +
    '.cv-page{margin-left:auto!important;margin-right:auto!important;}' +
    '.note,.note-badge{display:none!important;}' +
    '.contact-strip{grid-template-columns:repeat(2,minmax(0,1fr))!important;}' +
    '.contact-chip{min-width:0!important;}' +
    '.contact-value{overflow-wrap:anywhere;word-break:break-word;}' +
    '[data-cv-field],[data-editable="true"]{outline:2px dashed transparent;outline-offset:2px;cursor:text;transition:outline .15s ease, background .15s ease;}' +
    '[data-cv-field]:hover,[data-editable="true"]:hover{outline-color:#0f766e!important;background:rgba(15,118,110,.08)!important;}' +
    '[data-cv-field].cv-editing,[data-editable="true"].cv-editing{outline-color:#115e59!important;background:rgba(15,118,110,.14)!important;}' +
    '[data-cv-field][data-cv-empty="1"]:not(.cv-editing)::before,[data-editable="true"][data-cv-empty="1"]:not(.cv-editing)::before{content:attr(data-cv-placeholder);color:#94a3b8;font-style:italic;}' +
    '.cv-live-add-slot{display:flex;justify-content:center;align-items:center;margin:10px 0 16px;}' +
    '.cv-live-add-section-btn{width:34px;height:34px;border:2px solid #fdba74;border-radius:999px;background:#fff7ed;color:#f97316;font-size:28px;line-height:1;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;}' +
    '.cv-live-add-section-btn:hover{background:#fff1e5;transform:translateY(-1px);}' +
    '.cv-live-custom-section{position:relative;}' +
    '.cv-live-remove-section-btn{margin-top:10px;border:1px solid #f2c2cc;background:#fff3f6;color:#9f1d35;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer;}';
  document.head.appendChild(style);

  var active = null;
  var customSectionCount = 0;

  function asElement(target) {
    if (!target) return null;
    if (target.nodeType === 1) return target;
    return target.parentElement || null;
  }

  function getFieldKey(node) {
    if (!node) return '';
    return node.getAttribute('data-cv-field') || node.getAttribute('data-field') || '';
  }

  function isSingleLine(node) {
    if (!node) return false;
    if (node.getAttribute('data-single-line') === 'true') return true;
    if (node.getAttribute('data-cv-single-line') === '1') return true;
    return node.getAttribute('data-cv-multiline') !== '1';
  }

  function getFieldNode(target) {
    var el = asElement(target);
    if (!el || !el.closest) return null;
    return el.closest('[data-cv-field], [data-editable="true"]');
  }

  function normalizeValue(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n');
  }

  function setEmptyState(node) {
    if (!node) return;
    var raw = normalizeValue(node.innerText || '');
    node.setAttribute('data-cv-empty', raw.trim() ? '0' : '1');
    if (!node.getAttribute('data-cv-placeholder')) {
      var fallbackPlaceholder = node.getAttribute('data-placeholder') || 'Nhập nội dung';
      node.setAttribute('data-cv-placeholder', fallbackPlaceholder);
    }
  }

  function markEditable(node, field, placeholder, singleLine) {
    if (!node) return;
    node.setAttribute('contenteditable', 'true');
    node.setAttribute('data-editable', 'true');
    node.setAttribute('spellcheck', 'false');

    if (field && !node.getAttribute('data-field') && !node.getAttribute('data-cv-field')) {
      node.setAttribute('data-field', field);
    }

    if (placeholder && !node.getAttribute('data-placeholder')) {
      node.setAttribute('data-placeholder', placeholder);
    }

    if (singleLine && !node.getAttribute('data-single-line')) {
      node.setAttribute('data-single-line', 'true');
    }

    setEmptyState(node);
  }

  function normalizeForMatch(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\\s+/g, ' ')
      .trim();
  }

  function findContactValueByLabel(tokens) {
    var chips = Array.prototype.slice.call(document.querySelectorAll('.contact-chip,.contact-item,.contact-card,.contact-row'));

    for (var i = 0; i < chips.length; i += 1) {
      var chip = chips[i];
      var labelNode = chip.querySelector('.contact-label,[data-contact-label],label,strong,.label') || chip.firstElementChild;
      var labelText = normalizeForMatch(labelNode ? labelNode.textContent : chip.textContent);

      var matched = tokens.some(function (token) {
        return labelText.indexOf(token) >= 0;
      });

      if (!matched) continue;

      var valueNode = chip.querySelector('.contact-value,[data-field],[data-cv-field],a,span,p,div:last-child');
      if (valueNode && valueNode !== labelNode) return valueNode;
    }

    return null;
  }

  function ensureContactEditable() {
    var defs = [
      {
        selector: '.contact-value,[data-field="phone"],[data-cv-field="phone"]',
        field: 'phone',
        placeholder: 'Nhập số điện thoại',
        labelTokens: ['so dien thoai', 'dien thoai', 'phone']
      },
      {
        selector: '[data-field="email"],[data-cv-field="email"]',
        field: 'email',
        placeholder: 'Nhập email',
        labelTokens: ['email', 'e-mail', 'mail']
      },
      {
        selector: '[data-field="address"],[data-cv-field="address"]',
        field: 'address',
        placeholder: 'Nhập địa chỉ',
        labelTokens: ['dia chi', 'address', 'noi o']
      },
      {
        selector: '[data-field="linkedin"],[data-cv-field="linkedin"]',
        field: 'linkedin',
        placeholder: 'LinkedIn (nếu có)',
        labelTokens: ['linkedin', 'linked in']
      }
    ];

    defs.forEach(function (def) {
      document.querySelectorAll(def.selector).forEach(function (node) {
        markEditable(node, def.field, def.placeholder, true);
      });

      var fallbackNode = findContactValueByLabel(def.labelTokens || []);
      if (fallbackNode) {
        markEditable(fallbackNode, def.field, def.placeholder, true);
      }
    });

    document.querySelectorAll('a[data-field],a[data-cv-field],.contact-chip a').forEach(function (anchor) {
      anchor.addEventListener('click', function (event) {
        event.preventDefault();
      });
    });
  }

  function centerCvLayout() {
    var root = document.querySelector('#cvPage')
      || document.querySelector('.cv-page')
      || document.querySelector('.resume-page')
      || document.querySelector('.shell')
      || document.querySelector('.stage');

    if (!root) {
      var candidates = Array.prototype.slice.call(document.body.children || []);
      root = candidates.find(function (node) {
        var tag = String(node.tagName || '').toLowerCase();
        return tag && tag !== 'script' && tag !== 'style' && !node.classList.contains('cv-live-add-section-btn') && !node.classList.contains('cv-live-add-slot');
      }) || null;
    }

    if (!root) return;
    root.style.marginLeft = 'auto';
    root.style.marginRight = 'auto';
  }

  function emitFieldUpdate(node) {
    var field = getFieldKey(node);
    if (!field) return;
    post('CV_FIELD_UPDATE', {
      field: field,
      value: normalizeValue(node.innerText || '')
    });
  }

  function findInsertContainer() {
    return document.querySelector('.main-column')
      || document.querySelector('.cv-body main')
      || document.querySelector('main')
      || document.querySelector('.cv-body')
      || document.querySelector('.cv-content')
      || document.body;
  }

  function createCustomSection() {
    var container = findInsertContainer();
    if (!container) return;

    customSectionCount += 1;

    var section = document.createElement('section');
    section.className = 'section-card cv-live-custom-section';
    section.setAttribute('data-cv-custom', '1');

    var head = document.createElement('div');
    head.className = 'section-head';

    var title = document.createElement('h2');
    title.className = 'section-title';
    title.textContent = 'Thông tin bổ sung';
    markEditable(title, 'custom_title_' + customSectionCount, 'Tiêu đề nội dung', true);
    head.appendChild(title);

    var content = document.createElement('div');
    content.className = 'job-desc';
    content.textContent = 'Nhập nội dung bạn muốn thêm tại đây...';
    markEditable(content, 'custom_content_' + customSectionCount, 'Nhập nội dung thêm', false);

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'cv-live-remove-section-btn no-print';
    removeBtn.textContent = 'Xóa mục này';
    removeBtn.addEventListener('click', function (event) {
      event.preventDefault();
      section.remove();
    });

    section.appendChild(head);
    section.appendChild(content);
    section.appendChild(removeBtn);

    if (container.firstElementChild) {
      container.insertBefore(section, container.firstElementChild);
    } else {
      container.appendChild(section);
    }

    emitFieldUpdate(title);
    emitFieldUpdate(content);
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(function () {
      title.focus();
    }, 0);
  }

  function ensureAddButton() {
    if (document.querySelector('.cv-live-add-section-btn')) return;

    var slot = document.querySelector('.cv-live-add-slot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'cv-live-add-slot no-print';
      slot.setAttribute('data-cv-runtime', '1');

      var anchor = document.querySelector('.cv-body');
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(slot, anchor);
      } else {
        document.body.appendChild(slot);
      }
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cv-live-add-section-btn no-print';
    btn.setAttribute('aria-label', 'Thêm nội dung mới');
    btn.setAttribute('data-cv-runtime', '1');
    btn.textContent = '+';
    btn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      createCustomSection();
    });
    slot.appendChild(btn);
  }

  function placeCaretAtEnd(node) {
    if (!node) return;
    try {
      var range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (_) {}
  }

  function deactivate(node, shouldEmit) {
    if (!node) return;
    node.classList.remove('cv-editing');
    setEmptyState(node);

    if (shouldEmit) {
      emitFieldUpdate(node);
    }
  }

  function activate(node) {
    if (!node) return;
    if (active && active !== node) deactivate(active, true);
    active = node;
    node.setAttribute('contenteditable', 'true');
    if (!node.getAttribute('data-editable')) {
      node.setAttribute('data-editable', 'true');
    }
    node.classList.add('cv-editing');
    node.focus();
    placeCaretAtEnd(node);
  }

  ensureContactEditable();
  centerCvLayout();
  ensureAddButton();

  document.querySelectorAll('.note, .note-badge').forEach(function (node) {
    node.remove();
  });

  document.querySelectorAll('[data-cv-field], [data-editable="true"]').forEach(function (node) {
    setEmptyState(node);
    if (!node.getAttribute('contenteditable')) {
      node.setAttribute('contenteditable', 'true');
    }
  });

  document.addEventListener('click', function (event) {
    var node = getFieldNode(event.target);

    if (!node) {
      if (active) {
        deactivate(active, true);
        active = null;
      }
      return;
    }

    if (active !== node) {
      activate(node);
    }

    post('CV_FIELD_FOCUS', { field: getFieldKey(node) });
  }, true);

  document.addEventListener('dblclick', function (event) {
    var node = getFieldNode(event.target);
    if (!node) return;
    activate(node);
  }, true);

  document.addEventListener('focusout', function (event) {
    var node = getFieldNode(event.target);
    if (!node || node !== active) return;

    setTimeout(function () {
      var stillInside = node.contains(document.activeElement);
      if (!stillInside) {
        deactivate(node, true);
        active = null;
      }
    }, 0);
  }, true);

  document.addEventListener('keydown', function (event) {
    if (!active) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      deactivate(active, false);
      active = null;
      return;
    }

    if (isSingleLine(active) && event.key === 'Enter') {
      event.preventDefault();
      deactivate(active, true);
      active = null;
    }
  }, true);

  document.addEventListener('input', function (event) {
    var node = getFieldNode(event.target);
    if (!node) return;
    setEmptyState(node);
  }, true);
})();
</script>`;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${script}</body>`);
  }
  return `${html}${script}`;
};

const SAMPLE_DATA = {
  title: 'CV Ứng Viên Chuyên Nghiệp',
  summary: 'Tôi là người có tinh thần trách nhiệm, ham học hỏi và chủ động trong công việc. Có khả năng làm việc nhóm tốt, thích nghi nhanh với môi trường mới và luôn sẵn sàng tiếp thu kiến thức để phát triển bản thân.',
  skills: `• Quản lý dự án và làm việc nhóm\n• Giao tiếp và thuyết trình\n• Tin học văn phòng: Word, Excel, PowerPoint\n• Kỹ năng giải quyết vấn đề\n• Tư duy sáng tạo và phân tích`,
  experience: `Nhân viên Marketing - Công ty ABC\n01/2022 - Hiện tại\n• Xây dựng và triển khai chiến dịch marketing trên mạng xã hội\n• Phân tích dữ liệu khách hàng và đề xuất giải pháp tối ưu`,
  education: `Đại học Kinh tế TP.HCM\n09/2018 - 06/2022\nChuyên ngành: Quản trị Marketing`,
  languages: `• Tiếng Việt: Bản ngữ\n• Tiếng Anh: Thành thạo (IELTS 7.0)`,
  projects: `Chiến dịch "Mùa hè sôi động" - Công ty ABC\n• Lên kế hoạch và triển khai chiến dịch marketing tích hợp`,
};

const normalizeTemplateKey = (value, fallback = '') => {
  const v = String(value || '').trim();
  if (!v) return fallback;
  return /^[a-z0-9-]{1,120}$/i.test(v) ? v : fallback;
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
  const cvId = query.get('cvId') || query.get('cvid') || query.get('id');
  const requestedTemplateKey = normalizeTemplateKey(query.get('template') || '', '');
  const isNewCv = !cvId;

  const suppressLoadErrorsUntilRef = useRef(0);
  const previewFrameRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(true);

  const [title, setTitle] = useState(isNewCv ? SAMPLE_DATA.title : 'CV Online');
  const [summary, setSummary] = useState(isNewCv ? SAMPLE_DATA.summary : '');
  const [skills, setSkills] = useState(isNewCv ? SAMPLE_DATA.skills : '');
  const [experience, setExperience] = useState(isNewCv ? SAMPLE_DATA.experience : '');
  const [education, setEducation] = useState(isNewCv ? SAMPLE_DATA.education : '');
  const [languages, setLanguages] = useState(isNewCv ? SAMPLE_DATA.languages : '');
  const [projects, setProjects] = useState(isNewCv ? SAMPLE_DATA.projects : '');
  const [templateKey, setTemplateKey] = useState(requestedTemplateKey || '');
  const [templateOptions, setTemplateOptions] = useState([]);
  const [selectedTemplateHtml, setSelectedTemplateHtml] = useState('');
  const [persistedEditedHtml, setPersistedEditedHtml] = useState('');

  const [profile, setProfile] = useState(null);

  const updateFieldValue = useCallback((field, rawValue) => {
    const value = String(rawValue || '').replace(/\r/g, '');
    switch (field) {
      case 'title': setTitle((prev) => (prev === value ? prev : value)); break;
      case 'summary': setSummary((prev) => (prev === value ? prev : value)); break;
      case 'skills': setSkills((prev) => (prev === value ? prev : value)); break;
      case 'experience': setExperience((prev) => (prev === value ? prev : value)); break;
      case 'education': setEducation((prev) => (prev === value ? prev : value)); break;
      case 'languages': setLanguages((prev) => (prev === value ? prev : value)); break;
      case 'projects': setProjects((prev) => (prev === value ? prev : value)); break;
      default: break;
    }
  }, []);

  useEffect(() => {
    const handlePreviewBridge = (event) => {
      const data = event?.data;
      if (!data || data.__cv_editor !== true) return;

      if (data.type === 'CV_FIELD_UPDATE') {
        const field = String(data.field || '').trim();
        if (!field) return;
        updateFieldValue(field, data.value);
      }
    };

    window.addEventListener('message', handlePreviewBridge);
    return () => window.removeEventListener('message', handlePreviewBridge);
  }, [updateFieldValue]);

  useEffect(() => {
    let active = true;

    const loadTemplateOptions = async () => {
      setTemplateLoading(true);

      try {
        const res = await fetch(`${API_BASE}/api/cvs/templates?limit=120&offset=0`);
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Không tải được danh sách template');
        }

        if (!active) return;

        const rows = Array.isArray(data?.templates) ? data.templates : [];
        const mapped = rows
          .map((row) => ({
            key: normalizeTemplateKey(row?.Slug || row?.MaTemplateCV, ''),
            label: String(row?.TenTemplate || `Template #${row?.MaTemplateCV || ''}`).trim(),
            htmlContent: String(row?.HtmlContent || '')
          }))
          .filter((item) => item.key);

        const options = mapped;

        const requested = requestedTemplateKey && options.some((item) => item.key === requestedTemplateKey)
          ? requestedTemplateKey
          : null;

        const fallbackKey = options[0]?.key || '';
        const resolvedKey = requested || fallbackKey;
        const selected = options.find((item) => item.key === resolvedKey) || null;

        setTemplateOptions(options);
        setTemplateKey(resolvedKey);
        setSelectedTemplateHtml(selected?.htmlContent || '');
      } catch (err) {
        if (!active) return;
        setTemplateOptions([]);
        setTemplateKey('');
        setSelectedTemplateHtml('');
      } finally {
        if (active) setTemplateLoading(false);
      }
    };

    loadTemplateOptions();
    return () => {
      active = false;
    };
  }, [requestedTemplateKey]);

  useEffect(() => {
    if (!templateOptions.length) return;
    const selected = templateOptions.find((item) => item.key === templateKey) || templateOptions[0];
    setSelectedTemplateHtml(selected?.htmlContent || '');
  }, [templateOptions, templateKey]);

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

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;

      const stripHtml = (html = '') => html
        .replace(/<br\s*\/?\s*>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

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
          const lines = p.workList.map((w) => {
            const main = [w.position, w.company].filter(Boolean).join(' - ');
            const time = formatRange(w.start || `${w.startMonth || ''}/${w.startYear || ''}`, w.isCurrentlyWorking ? 'HIỆN TẠI' : (w.end || `${w.endMonth || ''}/${w.endYear || ''}`));
            const desc = stripHtml(w.descriptionHtml || w.description || '');
            return [main, time, desc].filter(Boolean).join(' | ');
          }).filter(Boolean).join('\n');
          if (lines) setExperience(lines);
        }

        if (!education && Array.isArray(p.educationList) && p.educationList.length) {
          const lines = p.educationList.map((ed) => {
            const main = [ed.university, ed.level].filter(Boolean).join(' - ');
            const major = ed.major ? `Ngành: ${ed.major}` : '';
            const time = formatRange(ed.start || `${ed.startMonth || ''}/${ed.startYear || ''}`, ed.isCurrentlyStudying ? 'HIỆN TẠI' : (ed.end || `${ed.endMonth || ''}/${ed.endYear || ''}`));
            const desc = ed.description ? stripHtml(ed.description) : '';
            return [main, major, time, desc].filter(Boolean).join(' | ');
          }).filter(Boolean).join('\n');
          if (lines) setEducation(lines);
        }

        if (!languages && Array.isArray(p.languageList) && p.languageList.length) {
          const lines = p.languageList.map((l) => [l.language, l.level && `(${l.level})`].filter(Boolean).join(' ')).filter(Boolean).join('\n');
          if (lines) setLanguages(lines);
        }
      };

      try {
        const res = await fetch(`/users/profile/${encodeURIComponent(userId)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) return;

        const p = data.profile || {};
        setProfile(p);
        if (!summary && p.introHtml) setSummary(stripHtml(p.introHtml));
        fillFromLists(p);
      } catch {
        setProfile(null);
      }
    };

    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const fetchExistingOnlineCv = async () => {
      if (!userId || !cvId) return;
      setLoading(true);

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const isTransientHttp = (status) => status === 502 || status === 503 || status === 504;

      try {
        const url = `/api/cvs/online/${encodeURIComponent(cvId)}?userId=${encodeURIComponent(userId)}`;
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

            const savedHtml = String(data.cv?.html || '').trim();
            if (savedHtml) {
              setPersistedEditedHtml(savedHtml);
            }

            const savedTemplateKey = normalizeTemplateKey(data.cv?.templateKey || '', '');
            if (savedTemplateKey) {
              setTemplateKey(savedTemplateKey);
            }
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
        const now = Date.now();
        if (now >= suppressLoadErrorsUntilRef.current) {
          notify({ type: 'error', message: err.message || 'Không tải được CV online' });
        }
      } finally {
        setLoading(false);
      }
    };

    fetchExistingOnlineCv();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvId, userId]);

  const buildHtml = () => {
    const p = profile || {};
    const pick = (...vals) => vals.find((v) => String(v || '').trim()) || '';

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

    const managedTemplateHtml = stripScriptsFromHtml(String(persistedEditedHtml || selectedTemplateHtml || '').trim());
    if (managedTemplateHtml) {
      const tokenMap = {
        title,
        summary,
        skills,
        experience,
        education,
        languages,
        projects,
        name,
        position,
        email,
        phone,
        birthday,
        address,
        city,
        link,
        avatarUrl
      };

      let rendered = managedTemplateHtml;
      Object.entries(tokenMap).forEach(([key, rawValue]) => {
        const safe = escapeHtml(String(rawValue || '')).replace(/\n/g, '<br/>');
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
        rendered = rendered.replace(regex, safe);
      });

      return rendered;
    }

    if (templateLoading) {
      return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:Segoe UI,Tahoma,sans-serif;color:#334155}
    .loading{padding:24px 30px;border:1px solid #dbeafe;border-radius:16px;background:#ffffff;box-shadow:0 16px 35px rgba(15,23,42,.08);font-weight:600}
  </style>
</head>
<body>
  <div class="loading">Đang tải mẫu CV...</div>
</body>
</html>`;
    }

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:Segoe UI,Tahoma,sans-serif;color:#334155;padding:24px}
    .empty{max-width:560px;padding:24px;border:1px dashed #cbd5e1;border-radius:16px;background:#ffffff;text-align:center;box-shadow:0 12px 30px rgba(15,23,42,.06)}
    h2{margin:0 0 8px;font-size:20px;color:#0f172a}
    p{margin:0;font-size:14px;line-height:1.6}
  </style>
</head>
<body>
  <div class="empty">
    <h2>Chưa có nội dung mẫu CV</h2>
    <p>Template được chọn chưa có HTML hoặc đã bị xóa. Vui lòng quay lại trang mẫu CV để chọn mẫu khác.</p>
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

    if (!String(persistedEditedHtml || selectedTemplateHtml || '').trim()) {
      notify({ type: 'error', message: 'Template hiện tại không có nội dung HTML. Vui lòng chọn mẫu khác.' });
      return;
    }

    const liveHtml = serializeLivePreviewHtml({ stripToolbar: true });
    const htmlToSave = liveHtml || buildHtml();

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
          languages: String(languages || ''),
        },
        html: htmlToSave,
        cvId: cvId || null,
      };

      const res = await fetch('/api/cvs/online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await readErrorMessage(res, 'Không thể lưu CV online');
        throw new Error(msg);
      }

      const data = await res.json().catch(() => ({}));
      if (!data.success) throw new Error(data.error || 'Không thể lưu CV online');

      notify({ type: 'success', message: 'Đã lưu CV online.' });
      setPersistedEditedHtml(htmlToSave);
      suppressLoadErrorsUntilRef.current = Date.now() + 8000;

      const newId = data.cv?.id;
      if (newId && !cvId) {
        navigate(`/create-cv/online-editor?cvId=${encodeURIComponent(newId)}&template=${encodeURIComponent(templateKey)}`, { replace: true });
      }
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không thể lưu CV online' });
    } finally {
      setSaving(false);
    }
  };

  const onPrint = () => {
    const liveHtml = serializeLivePreviewHtml({ stripToolbar: true });
    const html = liveHtml || buildHtml();

    if (!html) {
      notify({ type: 'warning', message: 'Không thể tải nội dung CV để in.' });
      return;
    }

    const w = window.open('', '_blank');
    if (!w) {
      notify({ type: 'warning', message: 'Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép pop-up và thử lại.' });
      return;
    }

    w.document.open();
    w.document.write(html);
    w.document.close();

    const triggerPrint = () => {
      try {
        w.focus();
        w.print();
      } catch (_) {
        notify({ type: 'error', message: 'Không thể mở hộp thoại in PDF. Vui lòng thử lại.' });
      }
    };

    if (w.document.readyState === 'complete') {
      setTimeout(triggerPrint, 180);
      return;
    }

    w.addEventListener('load', () => setTimeout(triggerPrint, 180), { once: true });
  };

  const serializeLivePreviewHtml = useCallback(({ stripToolbar = false } = {}) => {
    const iframeDoc = previewFrameRef.current?.contentDocument;
    const root = iframeDoc?.documentElement;
    if (!root) return '';

    const clone = root.cloneNode(true);
    clone.querySelector('#__cv_live_editor_style__')?.remove();
    clone.querySelector('#__cv_live_editor_hook__')?.remove();
    clone.querySelectorAll('script').forEach((node) => node.remove());
    clone.querySelectorAll('.cv-live-add-slot, .cv-live-add-section-btn, .cv-live-remove-section-btn, [data-cv-runtime="1"]').forEach((node) => node.remove());
    clone.querySelectorAll('.note, .note-badge').forEach((node) => node.remove());

    if (stripToolbar) {
      clone.querySelectorAll('.toolbar, #resetBtn').forEach((node) => node.remove());
    }

    return `<!doctype html>\n${clone.outerHTML}`;
  }, []);

  const previewHtml = injectPreviewEditorScript(buildHtml());

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
            <div className="text-muted">Bạn có thể chỉnh trực tiếp mọi nội dung hiển thị trong CV.</div>
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
        <div className="col-12">
          <div className="cv-editor-preview-card is-full">
            <div className="cv-editor-preview-header">
              <i className="bi bi-eye"></i>
              <div className="fw-semibold">Xem trước CV</div>
            </div>

            <div className="cv-editor-preview-body">
              <iframe
                ref={previewFrameRef}
                title="CV Preview"
                className="cv-editor-preview-iframe"
                srcDoc={previewHtml}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnlineCvEditor;
