import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';
import { API_BASE } from '../../config/apiBase';
import './OnlineCvBuilder.css';

const PAGE_SIZE = 12;

const CATEGORY_OPTIONS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'professional', label: 'CV chuyên nghiệp' },
  { key: 'creative', label: 'CV sáng tạo' },
  { key: 'minimal', label: 'CV tối giản' },
  { key: 'modern', label: 'CV hiện đại' }
];

const SORT_OPTIONS = [
  { key: 'popular', label: 'Phổ biến nhất' },
  { key: 'newest', label: 'Mới nhất' },
  { key: 'used', label: 'Dùng nhiều nhất' }
];

const toSearchText = (value = '') => String(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd');

const getCategoryKey = (template) => {
  const haystack = toSearchText(`${template?.TenTemplate || ''} ${template?.Slug || ''} ${template?.MoTa || ''}`);

  if (/sang tao|creative|designer|art/.test(haystack)) return 'creative';
  if (/toi gian|minimal|simple|clean/.test(haystack)) return 'minimal';
  if (/hien dai|modern|fresh|tech/.test(haystack)) return 'modern';
  return 'professional';
};

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeTemplate = (template) => {
  const id = safeNumber(template?.MaTemplateCV || template?.id || 0);
  const name = String(template?.TenTemplate || template?.name || '').trim();
  const slug = String(template?.Slug || template?.slug || '').trim();
  const description = String(template?.MoTa || template?.description || '').trim();
  const thumbnailUrl = String(template?.ThumbnailUrl || template?.thumbnailUrl || template?.thumbnail_url || '').trim();
  const htmlContent = String(template?.HtmlContent || template?.htmlContent || '');
  const updatedAt = String(template?.NgayCapNhat || template?.updatedAt || template?.NgayTao || template?.createdAt || '');
  const createdAt = String(template?.NgayTao || template?.createdAt || updatedAt || '');

  const updatedMs = new Date(updatedAt || createdAt || '').getTime();
  const normalizedUpdatedMs = Number.isNaN(updatedMs) ? 0 : updatedMs;
  const viewCount = safeNumber(template?.LuotXem || template?.ViewCount || template?.viewCount || 0);
  const useCount = safeNumber(template?.SoLuotSuDung || template?.UsageCount || template?.useCount || 0);

  const categoryKey = getCategoryKey(template);
  const isNew = normalizedUpdatedMs > 0 && Date.now() - normalizedUpdatedMs <= 1000 * 60 * 60 * 24 * 21;
  const badge = useCount >= 25 ? 'premium' : (isNew ? 'new' : '');

  return {
    id,
    name,
    slug,
    description,
    thumbnailUrl,
    htmlContent,
    createdAt,
    updatedAt,
    updatedMs: normalizedUpdatedMs,
    categoryKey,
    viewCount,
    useCount,
    badge
  };
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
};

const formatCompactNumber = (value) => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(safeNumber(value));

const getCategoryLabel = (key) => CATEGORY_OPTIONS.find((item) => item.key === key)?.label || 'CV chuyên nghiệp';

const CVTemplateCard = ({ template, onSelect }) => {
  const badgeText = template.badge === 'premium' ? 'PREMIUM' : (template.badge === 'new' ? 'MỚI' : '');

  return (
    <article className="cv-gallery-card">
      <div className="cv-gallery-thumb-shell">
        {badgeText ? (
          <span className={`cv-gallery-badge ${template.badge}`}>{badgeText}</span>
        ) : null}

        {template.thumbnailUrl ? (
          <img
            src={template.thumbnailUrl}
            alt={template.name || 'CV template thumbnail'}
            className="cv-gallery-thumb-image"
            loading="lazy"
          />
        ) : template.htmlContent ? (
          <iframe
            title={`preview-template-${template.id}`}
            className="cv-gallery-thumb"
            srcDoc={template.htmlContent}
            sandbox=""
          />
        ) : (
          <div className="cv-gallery-thumb-empty">Template chưa có nội dung HTML.</div>
        )}

        <button type="button" className="cv-gallery-use-btn" onClick={() => onSelect(template)}>
          Dùng mẫu này
        </button>
      </div>

      <div className="cv-gallery-card-body">
        <h3>{template.name}</h3>
        <p>{template.description || getCategoryLabel(template.categoryKey)}</p>
        <div className="cv-gallery-meta-row">
          <span>Phân loại: {getCategoryLabel(template.categoryKey)}</span>
          <span>Lượt xem: {formatCompactNumber(template.viewCount)}</span>
          <span>Lượt dùng: {formatCompactNumber(template.useCount)}</span>
          <span>Cập nhật: {formatDate(template.updatedAt || template.createdAt) || '-'}</span>
        </div>
      </div>
    </article>
  );
};

const CVTemplateListItem = ({ template, onSelect }) => {
  const badgeText = template.badge === 'premium' ? 'PREMIUM' : (template.badge === 'new' ? 'MỚI' : '');

  return (
    <article className="cv-gallery-list-item">
      <div className="cv-gallery-list-thumb-shell">
        {badgeText ? (
          <span className={`cv-gallery-badge ${template.badge}`}>{badgeText}</span>
        ) : null}

        {template.thumbnailUrl ? (
          <img
            src={template.thumbnailUrl}
            alt={template.name || 'CV template thumbnail'}
            className="cv-gallery-list-thumb-image"
            loading="lazy"
          />
        ) : template.htmlContent ? (
          <iframe
            title={`preview-list-template-${template.id}`}
            className="cv-gallery-list-thumb"
            srcDoc={template.htmlContent}
            sandbox=""
          />
        ) : (
          <div className="cv-gallery-thumb-empty list">Template chưa có nội dung HTML.</div>
        )}
      </div>

      <div className="cv-gallery-list-content">
        <h3>{template.name}</h3>
        <p>{template.description || getCategoryLabel(template.categoryKey)}</p>
        <div className="cv-gallery-meta-row">
          <span>Slug: {template.slug || 'no-slug'}</span>
          <span>Lượt xem: {formatCompactNumber(template.viewCount)}</span>
          <span>Lượt dùng: {formatCompactNumber(template.useCount)}</span>
          <span>Cập nhật: {formatDate(template.updatedAt || template.createdAt) || '-'}</span>
        </div>
      </div>

      <button type="button" className="cv-gallery-list-use-btn" onClick={() => onSelect(template)}>
        Dùng mẫu này
      </button>
    </article>
  );
};

const CVTemplateSkeleton = ({ mode = 'grid', count = 6 }) => {
  if (mode === 'list') {
    return (
      <section className="cv-gallery-list">
        {Array.from({ length: Math.max(3, count / 2) }).map((_, index) => (
          <article className="cv-gallery-list-item skeleton" key={`list-skeleton-${index}`}>
            <div className="cv-gallery-list-thumb-shell">
              <div className="cv-gallery-skeleton cv-gallery-list-thumb" />
            </div>
            <div className="cv-gallery-list-content">
              <div className="cv-gallery-skeleton text-lg" />
              <div className="cv-gallery-skeleton text-md" />
              <div className="cv-gallery-skeleton text-sm" />
            </div>
            <div className="cv-gallery-skeleton btn" />
          </article>
        ))}
      </section>
    );
  }

  return (
    <section className="cv-gallery-grid">
      {Array.from({ length: count }).map((_, index) => (
        <article className="cv-gallery-card skeleton" key={`grid-skeleton-${index}`}>
          <div className="cv-gallery-skeleton thumb" />
          <div className="cv-gallery-card-body">
            <div className="cv-gallery-skeleton text-lg" />
            <div className="cv-gallery-skeleton text-md" />
            <div className="cv-gallery-skeleton text-sm" />
          </div>
        </article>
      ))}
    </section>
  );
};

const OnlineCvBuilder = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [viewMode, setViewMode] = useState('grid');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;

    const loadTemplates = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await fetch(`${API_BASE}/api/cvs/templates?limit=60&offset=0`);
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || 'Không tải được danh sách template');
        }

        if (!active) return;
        const rows = Array.isArray(data?.templates) ? data.templates : [];
        setTemplates(rows.map(normalizeTemplate).filter((item) => item.id && item.name));
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Không tải được danh sách template');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadTemplates();
    return () => {
      active = false;
    };
  }, []);

  const categoryCounts = useMemo(() => {
    return templates.reduce((acc, item) => {
      const key = item.categoryKey || 'professional';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const keyword = toSearchText(searchText.trim());

    return templates.filter((item) => {
      const passCategory = categoryFilter === 'all' ? true : item.categoryKey === categoryFilter;
      if (!passCategory) return false;
      if (!keyword) return true;

      const haystack = toSearchText(`${item.name} ${item.slug} ${item.description}`);
      return haystack.includes(keyword);
    });
  }, [categoryFilter, searchText, templates]);

  const sortedTemplates = useMemo(() => {
    const rows = [...filteredTemplates];

    if (sortBy === 'newest') {
      rows.sort((a, b) => (b.updatedMs - a.updatedMs) || (b.id - a.id));
      return rows;
    }

    if (sortBy === 'used') {
      rows.sort((a, b) => (b.useCount - a.useCount) || (b.viewCount - a.viewCount) || (b.updatedMs - a.updatedMs));
      return rows;
    }

    rows.sort((a, b) => ((b.useCount * 2 + b.viewCount) - (a.useCount * 2 + a.viewCount)) || (b.updatedMs - a.updatedMs));
    return rows;
  }, [filteredTemplates, sortBy]);

  const totalTemplates = sortedTemplates.length;
  const totalPages = Math.max(1, Math.ceil(totalTemplates / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, categoryFilter, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedTemplates = useMemo(() => {
    const from = (currentPage - 1) * PAGE_SIZE;
    return sortedTemplates.slice(from, from + PAGE_SIZE);
  }, [currentPage, sortedTemplates]);

  const rangeFrom = totalTemplates === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeTo = totalTemplates === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, totalTemplates);
  const hasTemplates = totalTemplates > 0;

  const pageSubtitle = useMemo(() => {
    if (loading) return 'Đang tải template CV...';
    if (hasTemplates) return `Khám phá các mẫu CV hiện đại, tối ưu cho tuyển dụng.`;
    return 'Hiện chưa có template CV khả dụng.';
  }, [hasTemplates, loading]);

  const rangeLabel = `${rangeFrom}-${rangeTo} / ${totalTemplates}`;

  const handleSelectTemplate = (template) => {
    const templateKey = template?.slug || String(template?.id || 'live-editor');
    navigate(`/create-cv/online-editor?template=${encodeURIComponent(templateKey)}`);
    notify({
      type: 'info',
      title: 'Khởi tạo CV',
      message: `Đã chọn mẫu ${template?.name || 'CV'} để bắt đầu chỉnh sửa.`
    });
  };

  return (
    <div className="cv-gallery-page">
      <div className="cv-gallery-shell">
        <nav className="cv-gallery-breadcrumb" aria-label="breadcrumb">
          <ol>
            <li><Link to="/">Trang chủ</Link></li>
            <li aria-current="page">Mẫu CV</li>
          </ol>
        </nav>

        <div className="cv-gallery-layout">
          <aside className="cv-gallery-sidebar">
            <section className="cv-gallery-panel">
              <h3>Phong cách CV</h3>
              <div className="cv-gallery-filter-list">
                {CATEGORY_OPTIONS.map((option) => {
                  const count = option.key === 'all' ? templates.length : (categoryCounts[option.key] || 0);
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`cv-gallery-filter-pill ${categoryFilter === option.key ? 'active' : ''}`}
                      onClick={() => setCategoryFilter(option.key)}
                    >
                      <span>{option.label}</span>
                      <small>{count}</small>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="cv-gallery-panel">
              <h3>Sắp xếp</h3>
              <div className="cv-gallery-sort-select-wrap">
                <select className="cv-gallery-sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{option.label}</option>
                  ))}
                </select>
                <span className="cv-gallery-sort-caret" aria-hidden="true">
                  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 6.5L8 10.5L12 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>

              <div className="cv-gallery-view-switch side">
                <button
                  type="button"
                  className={`icon-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  aria-label="Hiển thị dạng lưới"
                  title="Hiển thị dạng lưới"
                >
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="12" y="3" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="3" y="12" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="12" y="12" width="5" height="5" rx="1.2" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={`icon-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  aria-label="Hiển thị dạng danh sách"
                  title="Hiển thị dạng danh sách"
                >
                  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="4" y1="5.5" x2="16" y2="5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    <line x1="4" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    <line x1="4" y1="14.5" x2="16" y2="14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <p className="cv-gallery-sidebar-stats">Hiển thị {rangeLabel} mẫu CV</p>
            </section>
          </aside>

          <main className="cv-gallery-main">
            <header className="cv-gallery-header">
              <div className="cv-gallery-header-top">
                <h1>Kho Mẫu CV Chuyên Nghiệp</h1>

                <div className="cv-gallery-header-actions">
                  <div className="cv-gallery-search-wrap" role="search">
                    <svg className="cv-gallery-search-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <circle cx="9" cy="9" r="5.9" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    <input
                      type="text"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Tìm kiếm mẫu CV..."
                      className="cv-gallery-search-input"
                    />
                  </div>

                  <div className="cv-gallery-range-box">
                    <button type="button" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage <= 1}>
                      ‹
                    </button>
                    <span>{rangeLabel}</span>
                    <button type="button" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}>
                      ›
                    </button>
                  </div>
                </div>
              </div>

              <p>{pageSubtitle}</p>
            </header>

            {error ? (
              <div className="cv-gallery-alert error" role="alert">{error}</div>
            ) : null}

            {loading ? <CVTemplateSkeleton mode={viewMode} count={8} /> : null}

            {!loading && !hasTemplates ? (
              <div className="cv-gallery-empty-state">
                <h4>Chưa có mẫu phù hợp</h4>
                <p>Không tìm thấy template phù hợp với bộ lọc hiện tại. Hãy thử đổi từ khóa hoặc phong cách CV.</p>
              </div>
            ) : null}

            {!loading && hasTemplates && viewMode === 'grid' ? (
              <section className="cv-gallery-grid">
                {pagedTemplates.map((template) => (
                  <CVTemplateCard key={template.id} template={template} onSelect={handleSelectTemplate} />
                ))}
              </section>
            ) : null}

            {!loading && hasTemplates && viewMode === 'list' ? (
              <section className="cv-gallery-list">
                {pagedTemplates.map((template) => (
                  <CVTemplateListItem key={template.id} template={template} onSelect={handleSelectTemplate} />
                ))}
              </section>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
};

export default OnlineCvBuilder;
