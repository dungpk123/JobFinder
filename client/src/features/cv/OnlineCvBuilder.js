import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';
import { API_BASE } from '../../config/apiBase';
import './OnlineCvBuilder.css';

const GRID_PAGE_SIZE = 12;
const LIST_PAGE_SIZE = 10;
const FETCH_BATCH_SIZE = 80;

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
    useCount
  };
};

const formatCompactNumber = (value) => new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(safeNumber(value));

const getCategoryLabel = (key) => CATEGORY_OPTIONS.find((item) => item.key === key)?.label || 'CV chuyên nghiệp';

const buildPageItems = (currentPage, totalPages, siblingCount = 1) => {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(Math.max(1, Number(currentPage) || 1), total);

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  const start = Math.max(2, current - siblingCount);
  const end = Math.min(total - 1, current + siblingCount);
  const items = [1];

  if (start > 2) items.push('ellipsis-left');
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < total - 1) items.push('ellipsis-right');
  items.push(total);
  return items;
};

const CompactPagination = ({ currentPage, totalPages, rangeLabel, onPageChange }) => {
  const pages = buildPageItems(currentPage, totalPages);

  return (
    <div className="cv-gallery-pagination-wrap" aria-label="Pagination">
      <span className="cv-gallery-pagination-summary">{rangeLabel}</span>

      {totalPages > 1 ? (
        <div className="cv-gallery-pagination-pages">
          <button
            type="button"
            className="nav"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Trang trước"
          >
            ‹
          </button>

          {pages.map((item) => {
            if (item === 'ellipsis-left' || item === 'ellipsis-right') {
              return <span key={item} className="ellipsis">…</span>;
            }

            const page = item;
            return (
              <button
                type="button"
                key={page}
                className={page === currentPage ? 'active' : ''}
                onClick={() => onPageChange(page)}
                aria-current={page === currentPage ? 'page' : undefined}
                aria-label={`Trang ${page}`}
              >
                {page}
              </button>
            );
          })}

          <button
            type="button"
            className="nav"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Trang sau"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
};

const CVTemplateCard = ({ template, onOpenActions }) => {
  const handleActivate = () => onOpenActions(template);
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  };

  return (
    <article
      className="cv-gallery-card compact-card"
      role="button"
      tabIndex={0}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
    >
      <div className="cv-gallery-thumb-shell">
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
      </div>

      <div className="cv-gallery-card-body compact">
        <h3>{template.name}</h3>
        <div className="cv-gallery-card-footer grid-mode">
          <p>{getCategoryLabel(template.categoryKey)}</p>
          <span className="cv-gallery-view-count">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2 10C3.7 6.8 6.5 5 10 5C13.5 5 16.3 6.8 18 10C16.3 13.2 13.5 15 10 15C6.5 15 3.7 13.2 2 10Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {formatCompactNumber(template.viewCount)}
          </span>
        </div>
      </div>
    </article>
  );
};

const CVTemplateListItem = ({ template, onSelect, onPreview }) => {
  return (
    <article className="cv-gallery-list-item">
      <div className="cv-gallery-list-thumb-shell">
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
        <div className="cv-gallery-list-meta-left">
          <p>{getCategoryLabel(template.categoryKey)}</p>
          <span className="cv-gallery-view-count">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2 10C3.7 6.8 6.5 5 10 5C13.5 5 16.3 6.8 18 10C16.3 13.2 13.5 15 10 15C6.5 15 3.7 13.2 2 10Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {formatCompactNumber(template.viewCount)}
          </span>
        </div>
      </div>

      <div className="cv-gallery-list-actions">
        <button
          type="button"
          className="cv-gallery-list-action preview"
          onClick={() => onPreview(template)}
          aria-label={`Xem CV ${template.name}`}
        >
          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M2 10C3.7 6.8 6.5 5 10 5C13.5 5 16.3 6.8 18 10C16.3 13.2 13.5 15 10 15C6.5 15 3.7 13.2 2 10Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          Xem CV
        </button>

        <button
          type="button"
          className="cv-gallery-list-action use"
          onClick={() => onSelect(template)}
          aria-label={`Sử dụng ${template.name}`}
        >
          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M10 2.5L11.8 7.1L16.6 7.4L12.8 10.5L14 15.1L10 12.2L6 15.1L7.2 10.5L3.4 7.4L8.2 7.1L10 2.5Z" fill="currentColor" />
          </svg>
          Sử dụng
        </button>
      </div>
    </article>
  );
};

const GridTemplateActionModal = ({ template, onClose, onPreview, onUse }) => {
  if (!template) return null;

  return (
    <div className="cv-grid-template-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cv-grid-template-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Xem và sử dụng mẫu CV"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="cv-grid-template-modal-close" onClick={onClose} aria-label="Đóng">
          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M5 5L15 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            <path d="M15 5L5 15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>

        <div className="cv-grid-template-modal-layout">
          <div className="cv-grid-template-modal-preview">
            {template.thumbnailUrl ? (
              <img
                src={template.thumbnailUrl}
                alt={template.name || 'CV template thumbnail'}
                className="cv-grid-template-modal-image"
              />
            ) : template.htmlContent ? (
              <iframe
                title={`modal-preview-template-${template.id}`}
                className="cv-grid-template-modal-iframe"
                srcDoc={template.htmlContent}
                sandbox=""
              />
            ) : (
              <div className="cv-gallery-thumb-empty">Template chưa có nội dung HTML.</div>
            )}
          </div>

          <div className="cv-grid-template-modal-content">
            <p className="cv-grid-template-modal-label">Mẫu CV</p>
            <h3>{template.name}</h3>
            <p className="cv-grid-template-modal-category">{getCategoryLabel(template.categoryKey)}</p>
            {template.description ? (
              <p className="cv-grid-template-modal-description">{template.description}</p>
            ) : (
              <p className="cv-grid-template-modal-description muted">Mẫu CV tối ưu để bạn bắt đầu chỉnh sửa nhanh.</p>
            )}

            <div className="cv-grid-template-modal-actions">
              <button
                type="button"
                className="cv-grid-template-modal-btn ghost"
                onClick={() => onPreview(template)}
              >
                Xem trực tiếp
              </button>

              <button
                type="button"
                className="cv-grid-template-modal-btn primary"
                onClick={() => onUse(template)}
              >
                Sử dụng mẫu
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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
            <div className="cv-gallery-list-actions">
              <div className="cv-gallery-skeleton btn" />
              <div className="cv-gallery-skeleton btn" />
            </div>
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
  const [activeGridTemplate, setActiveGridTemplate] = useState(null);

  useEffect(() => {
    let active = true;

    const loadTemplates = async () => {
      setLoading(true);
      setError('');

      try {
        let offset = 0;
        let total = Number.POSITIVE_INFINITY;
        let allRows = [];

        while (offset < total) {
          const res = await fetch(`${API_BASE}/api/cvs/templates?limit=${FETCH_BATCH_SIZE}&offset=${offset}`);
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.success) {
            throw new Error(data?.error || 'Không tải được danh sách template');
          }

          const rows = Array.isArray(data?.templates) ? data.templates : [];
          const nextTotal = Number(data?.total || rows.length);

          allRows = allRows.concat(rows);
          total = Number.isFinite(nextTotal) && nextTotal >= 0 ? nextTotal : allRows.length;

          if (!rows.length || allRows.length >= total || rows.length < FETCH_BATCH_SIZE) {
            break;
          }

          offset += rows.length;
        }

        if (!active) return;
        setTemplates(allRows.map(normalizeTemplate).filter((item) => item.id && item.name));
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

  const pageSize = viewMode === 'grid' ? GRID_PAGE_SIZE : LIST_PAGE_SIZE;
  const totalTemplates = sortedTemplates.length;
  const totalPages = Math.max(1, Math.ceil(totalTemplates / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, categoryFilter, sortBy, viewMode]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!activeGridTemplate) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveGridTemplate(null);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeGridTemplate]);

  const pagedTemplates = useMemo(() => {
    const from = (currentPage - 1) * pageSize;
    return sortedTemplates.slice(from, from + pageSize);
  }, [currentPage, pageSize, sortedTemplates]);

  const rangeFrom = totalTemplates === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeTo = totalTemplates === 0 ? 0 : Math.min(currentPage * pageSize, totalTemplates);
  const hasTemplates = totalTemplates > 0;

  const pageSubtitle = useMemo(() => {
    if (loading) return 'Đang tải template CV...';
    if (hasTemplates) return `Khám phá các mẫu CV hiện đại, tối ưu cho tuyển dụng.`;
    return 'Hiện chưa có template CV khả dụng.';
  }, [hasTemplates, loading]);

  const rangeLabel = `${rangeFrom}-${rangeTo} / ${totalTemplates}`;

  const handlePageChange = (page) => {
    const next = Math.max(1, Math.min(totalPages, Number(page) || 1));
    setCurrentPage(next);
  };

  const handlePreviewTemplate = (template) => {
    if (!template) return;

    if (template.thumbnailUrl) {
      window.open(template.thumbnailUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (template.htmlContent) {
      const blob = new Blob([template.htmlContent], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return;
    }

    notify({ type: 'warning', message: 'Mẫu này chưa có dữ liệu xem trước.' });
  };

  const handleSelectTemplate = (template) => {
    const templateKey = template?.slug || String(template?.id || 'live-editor');

    notify({
      mode: 'toast',
      type: 'success',
      title: 'Thành công',
      message: `Đã chọn mẫu ${template?.name || 'CV'} để bắt đầu chỉnh sửa.`,
      duration: 2800
    });

    navigate(`/create-cv/online-editor?template=${encodeURIComponent(templateKey)}`);
  };

  const openGridTemplateModal = (template) => {
    setActiveGridTemplate(template || null);
  };

  const closeGridTemplateModal = () => {
    setActiveGridTemplate(null);
  };

  const handleUseTemplateFromModal = (template) => {
    closeGridTemplateModal();
    handleSelectTemplate(template);
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
          </aside>

          <main className="cv-gallery-main">
            <header className="cv-gallery-header">
              <div className="cv-gallery-header-top">
                <h1>Kho Mẫu CV Chuyên Nghiệp</h1>

                <div className="cv-gallery-header-actions">
                  <div className="cv-gallery-header-actions-top">
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

                    <CompactPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      rangeLabel={rangeLabel}
                      onPageChange={handlePageChange}
                    />
                  </div>

                </div>
              </div>

              <div className="cv-gallery-header-bottom">
                <p className="cv-gallery-header-subtitle">{pageSubtitle}</p>
                <div className="cv-gallery-header-bottom-controls">
                  <div className="cv-gallery-sort-select-wrap header">
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

                  <div className="cv-gallery-view-switch header">
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
                </div>
              </div>
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
                  <CVTemplateCard key={template.id} template={template} onOpenActions={openGridTemplateModal} />
                ))}
              </section>
            ) : null}

            {!loading && hasTemplates && viewMode === 'list' ? (
              <section className="cv-gallery-list">
                {pagedTemplates.map((template) => (
                  <CVTemplateListItem
                    key={template.id}
                    template={template}
                    onSelect={handleSelectTemplate}
                    onPreview={handlePreviewTemplate}
                  />
                ))}
              </section>
            ) : null}

            <GridTemplateActionModal
              template={activeGridTemplate}
              onClose={closeGridTemplateModal}
              onPreview={handlePreviewTemplate}
              onUse={handleUseTemplateFromModal}
            />
          </main>
        </div>
      </div>
    </div>
  );
};

export default OnlineCvBuilder;
