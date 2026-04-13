import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import './SmartPagination.css';

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

const SmartPagination = ({
  from = 0,
  to = 0,
  currentPage = 1,
  perPage,
  pageSize = 10,
  totalItems = 0,
  onRangeChange,
  onPageChange,
  loading = false,
  loop = false,
  showPageNumbers = false,
  className = ''
}) => {
  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const safePerPage = Math.max(1, Number(perPage || pageSize) || pageSize);
  const maxPage = Math.max(1, Math.ceil((safeTotal || 1) / safePerPage));
  const safeCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), maxPage);
  const [isEditingRange, setIsEditingRange] = useState(false);
  const [tempFrom, setTempFrom] = useState('');
  const [tempTo, setTempTo] = useState('');
  const rangeEditorRef = useRef(null);

  const fallbackFrom = safeTotal > 0 ? (safeCurrentPage - 1) * safePerPage + 1 : 0;
  const fallbackTo = safeTotal > 0 ? Math.min(safeTotal, fallbackFrom + safePerPage - 1) : 0;

  const fromDisplay = safeTotal > 0 ? Math.min(Math.max(1, Number(from) || fallbackFrom), safeTotal) : 0;
  const toDisplay = safeTotal > 0
    ? Math.min(Math.max(fromDisplay, Number(to) || fallbackTo), safeTotal)
    : 0;

  useEffect(() => {
    if (isEditingRange) return;
    setTempFrom(String(fromDisplay));
    setTempTo(String(toDisplay));
  }, [fromDisplay, toDisplay, isEditingRange]);

  const pageItems = useMemo(
    () => (showPageNumbers ? buildPageItems(safeCurrentPage, maxPage) : []),
    [showPageNumbers, safeCurrentPage, maxPage]
  );

  const emitPage = (page) => {
    const nextPage = Math.min(Math.max(1, Number(page) || 1), maxPage);

    if (typeof onPageChange === 'function') {
      onPageChange(nextPage);
    }

    if (typeof onRangeChange === 'function') {
      const nextFrom = safeTotal > 0 ? (nextPage - 1) * safePerPage + 1 : 0;
      const nextTo = safeTotal > 0 ? Math.min(safeTotal, nextFrom + safePerPage - 1) : 0;
      onRangeChange(nextFrom, nextTo);
    }
  };

  const canLoop = safeTotal > 0 && maxPage > 1;
  const showNavigation = maxPage > 1;
  const canGoPrev = loop ? canLoop : safeCurrentPage > 1;
  const canGoNext = loop ? canLoop : safeCurrentPage < maxPage;

  const openRangeEditor = () => {
    if (loading || safeTotal <= 0) return;
    setTempFrom(String(fromDisplay));
    setTempTo(String(toDisplay));
    setIsEditingRange(true);
  };

  const applyEditedRange = () => {
    if (safeTotal <= 0) {
      setIsEditingRange(false);
      return;
    }

    let nextFrom = Number.parseInt(String(tempFrom || '').replace(/\D/g, ''), 10);
    let nextTo = Number.parseInt(String(tempTo || '').replace(/\D/g, ''), 10);

    if (!Number.isFinite(nextFrom) || nextFrom <= 0) {
      nextFrom = Math.max(1, fromDisplay || 1);
    }
    nextFrom = Math.min(Math.max(1, nextFrom), safeTotal);

    if (!Number.isFinite(nextTo) || nextTo <= 0) {
      nextTo = Math.min(safeTotal, nextFrom + safePerPage - 1);
    }
    nextTo = Math.min(Math.max(nextFrom, nextTo), safeTotal);

    if (typeof onRangeChange === 'function') {
      onRangeChange(nextFrom, nextTo);
    }

    if (typeof onPageChange === 'function') {
      const nextPage = Math.min(maxPage, Math.max(1, Math.ceil(nextFrom / safePerPage)));
      onPageChange(nextPage);
    }

    setIsEditingRange(false);
  };

  const closeRangeEditor = () => {
    setIsEditingRange(false);
  };

  const handleRangeEditorBlur = () => {
    setTimeout(() => {
      if (
        rangeEditorRef.current
        && !rangeEditorRef.current.contains(document.activeElement)
      ) {
        applyEditedRange();
      }
    }, 120);
  };

  const handleRangeEditorKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyEditedRange();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeRangeEditor();
    }
  };

  const handlePrev = () => {
    if (loading || !canGoPrev) return;
    if (safeCurrentPage <= 1) {
      emitPage(maxPage);
      return;
    }
    emitPage(safeCurrentPage - 1);
  };

  const handleNext = () => {
    if (loading || !canGoNext) return;
    if (safeCurrentPage >= maxPage) {
      emitPage(1);
      return;
    }
    emitPage(safeCurrentPage + 1);
  };

  return (
    <div className={`smart-pagination ${className}`.trim()}>
      <div className="smart-pagination-main">
        {showNavigation ? (
          <button
            type="button"
            className="smart-pagination-arrow"
            onClick={handlePrev}
            disabled={loading || !canGoPrev}
            aria-label="Trang trước"
          >
            <span aria-hidden="true">&lsaquo;</span>
          </button>
        ) : null}

        {!isEditingRange ? (
          <button
            type="button"
            className="smart-pagination-range smart-pagination-range-button"
            role="status"
            aria-live="polite"
            onClick={openRangeEditor}
            disabled={loading || safeTotal <= 0}
            title="Nhấn để chỉnh phạm vi"
          >
            <strong>{fromDisplay}-{toDisplay}</strong>
            <span>/ {safeTotal}</span>
          </button>
        ) : (
          <div
            className="smart-pagination-range smart-pagination-range-edit"
            ref={rangeEditorRef}
          >
            <input
              type="text"
              inputMode="numeric"
              value={tempFrom}
              className="smart-pagination-range-input"
              autoFocus
              onBlur={handleRangeEditorBlur}
              onKeyDown={handleRangeEditorKeyDown}
              onChange={(event) => setTempFrom(event.target.value.replace(/\D/g, ''))}
              aria-label="Bản ghi bắt đầu"
            />
            <span className="smart-pagination-range-separator">-</span>
            <input
              type="text"
              inputMode="numeric"
              value={tempTo}
              className="smart-pagination-range-input"
              onBlur={handleRangeEditorBlur}
              onKeyDown={handleRangeEditorKeyDown}
              onChange={(event) => setTempTo(event.target.value.replace(/\D/g, ''))}
              aria-label="Bản ghi kết thúc"
            />
            <span className="smart-pagination-range-separator">/</span>
            <span>{safeTotal}</span>
          </div>
        )}

        {showNavigation ? (
          <button
            type="button"
            className="smart-pagination-arrow"
            onClick={handleNext}
            disabled={loading || !canGoNext}
            aria-label="Trang sau"
          >
            <span aria-hidden="true">&rsaquo;</span>
          </button>
        ) : null}
      </div>

      {showPageNumbers && maxPage > 1 ? (
        <div className="smart-pagination-pages" aria-label="Danh sách trang">
          {pageItems.map((item) => {
            if (item === 'ellipsis-left' || item === 'ellipsis-right') {
              return <span key={item} className="smart-pagination-ellipsis">&hellip;</span>;
            }

            const page = Number(item);
            const active = page === safeCurrentPage;

            return (
              <button
                type="button"
                key={page}
                className={active ? 'active' : ''}
                onClick={() => emitPage(page)}
                aria-current={active ? 'page' : undefined}
                aria-label={`Trang ${page}`}
                disabled={loading}
              >
                {page}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default memo(SmartPagination);
