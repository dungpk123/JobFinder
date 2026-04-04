import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';
import './CvManagementPage.css';

const toDateMs = (value) => {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN');
};

const normalizeCv = (cv, index) => {
  const id = cv?.id || cv?.cvId || cv?.MaCV || cv?.MaHoSo || `cv-${index}`;
  const name = String(cv?.name || cv?.TenCV || cv?.tenCV || 'CV chưa đặt tên').trim();
  const fileUrl = String(cv?.fileUrl || cv?.FileUrl || cv?.url || '').trim();
  const uploadDate = cv?.uploadDate || cv?.NgayTao || cv?.createdAt || null;
  const updatedAt = cv?.updatedAt || cv?.NgayCapNhat || uploadDate || null;

  const safeUrl = fileUrl.split('?')[0].toLowerCase();
  const isOnlineCv = safeUrl.endsWith('.html');
  const extension = safeUrl.includes('.') ? safeUrl.split('.').pop() : '';

  return {
    id,
    name,
    fileUrl,
    uploadDate,
    updatedAt,
    updatedMs: toDateMs(updatedAt),
    isOnlineCv,
    typeLabel: isOnlineCv ? 'CV Online' : (extension ? `File ${extension.toUpperCase()}` : 'CV tài liệu'),
    status: String(cv?.status || cv?.TrangThai || '').trim()
  };
};

const CvManagementPage = () => {
  const navigate = useNavigate();
  const { notify, requestConfirm } = useNotification();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const userId = user?.id || user?.MaNguoiDung || user?.maNguoiDung || user?.userId || user?.userID || null;

  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [rawCvs, setRawCvs] = useState([]);
  const [query, setQuery] = useState('');
  const [viewFilter, setViewFilter] = useState('all');
  const fileInputRef = useRef(null);

  const cvs = useMemo(() => {
    return rawCvs
      .map((item, index) => normalizeCv(item, index))
      .sort((a, b) => b.updatedMs - a.updatedMs);
  }, [rawCvs]);

  const stats = useMemo(() => {
    const total = cvs.length;
    const online = cvs.filter((cv) => cv.isOnlineCv).length;
    return {
      total,
      online,
      uploaded: Math.max(0, total - online)
    };
  }, [cvs]);

  const filteredCvs = useMemo(() => {
    const search = String(query || '').trim().toLowerCase();

    return cvs.filter((cv) => {
      if (viewFilter === 'online' && !cv.isOnlineCv) return false;
      if (viewFilter === 'uploaded' && cv.isOnlineCv) return false;

      if (!search) return true;
      return cv.name.toLowerCase().includes(search) || cv.typeLabel.toLowerCase().includes(search);
    });
  }, [cvs, query, viewFilter]);

  const loadCvs = async () => {
    if (!userId) {
      setRawCvs([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/cvs?userId=${encodeURIComponent(userId)}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không tải được danh sách CV');
      }

      setRawCvs(Array.isArray(data?.cvs) ? data.cvs : []);
    } catch (error) {
      setRawCvs([]);
      notify({ type: 'error', message: error.message || 'Không tải được danh sách CV' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (cvId) => {
    if (!userId || !cvId) return;

    const ok = await requestConfirm({
      title: 'Xóa CV',
      message: 'Bạn có chắc muốn xóa CV này không?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      type: 'warning'
    });
    if (!ok) return;

    setDeletingId(String(cvId));
    try {
      const response = await fetch(`/api/cvs/${encodeURIComponent(cvId)}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể xóa CV');
      }

      setRawCvs((prev) => prev.filter((item, index) => String(normalizeCv(item, index).id) !== String(cvId)));
      notify({ type: 'success', message: 'Đã xóa CV thành công.' });
    } catch (error) {
      notify({ type: 'error', message: error.message || 'Không thể xóa CV' });
    } finally {
      setDeletingId('');
    }
  };

  const handleOpenFilePicker = () => {
    if (!userId) {
      notify({ type: 'warning', message: 'Vui lòng đăng nhập để tải CV lên.' });
      return;
    }

    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleUploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !userId) return;

    const formData = new FormData();
    formData.append('userId', String(userId));
    formData.append('cvFile', file);
    formData.append('cvTitle', file.name.replace(/\.[^/.]+$/, '') || file.name);
    formData.append('summary', '');

    setUploading(true);
    try {
      const response = await fetch('/api/cvs', {
        method: 'POST',
        body: formData
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể tải CV lên');
      }

      notify({ type: 'success', message: 'Tải CV lên thành công.' });
      await loadCvs();
      setViewFilter('all');
    } catch (error) {
      notify({ type: 'error', message: error.message || 'Không thể tải CV lên' });
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    loadCvs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div className="cv-management-page">
      <div className="container cv-management-container">
        <section className="cv-management-hero">
          <div className="cv-management-hero-content">
            <p className="cv-management-eyebrow">Không gian ứng viên</p>
            <h1>Quản lý CV của bạn tại JobFinder</h1>
            <p>
              Theo dõi các CV đã tạo, chỉnh sửa CV online nhanh chóng và tái sử dụng cho mọi cơ hội tuyển dụng.
            </p>
          </div>

          <div className="cv-management-stats">
            <div className="cv-management-stat-card">
              <strong>{stats.total}</strong>
              <span>Tổng CV</span>
            </div>
            <div className="cv-management-stat-card">
              <strong>{stats.online}</strong>
              <span>CV Online</span>
            </div>
            <div className="cv-management-stat-card">
              <strong>{stats.uploaded}</strong>
              <span>CV tải lên</span>
            </div>
          </div>
        </section>

        <section className="cv-management-board">
          <div className="cv-management-board-head">
            <div>
              <h2>Danh sách CV đã tạo</h2>
              <p>Hiển thị CV online và tài liệu CV bạn đã lưu trên hệ thống.</p>
            </div>

            <div className="cv-management-board-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleUploadFile}
                className="cv-management-hidden-file-input"
              />

              <input
                type="text"
                placeholder="Tìm theo tên CV..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />

              <button
                type="button"
                className="cv-management-upload-btn"
                disabled={!userId || uploading}
                onClick={handleOpenFilePicker}
              >
                {uploading ? 'Đang tải...' : 'Tải CV lên'}
              </button>

              <button type="button" onClick={() => navigate('/create-cv')}>Tạo CV mới</button>
            </div>
          </div>

          <div className="cv-management-filter-row" role="group" aria-label="Lọc CV">
            <button type="button" className={viewFilter === 'all' ? 'active' : ''} onClick={() => setViewFilter('all')}>
              Tất cả
            </button>
            <button type="button" className={viewFilter === 'online' ? 'active' : ''} onClick={() => setViewFilter('online')}>
              CV Online
            </button>
            <button type="button" className={viewFilter === 'uploaded' ? 'active' : ''} onClick={() => setViewFilter('uploaded')}>
              CV tải lên
            </button>
          </div>

          {!userId ? (
            <div className="cv-management-empty">
              <div className="cv-management-empty-icon"><i className="bi bi-lock"></i></div>
              <h3>Bạn chưa đăng nhập</h3>
              <p>Đăng nhập để xem và quản lý các CV đã tạo của bạn.</p>
              <Link to="/login" className="cv-management-primary-btn">Đăng nhập ngay</Link>
            </div>
          ) : loading ? (
            <div className="cv-management-empty">
              <div className="cv-management-empty-icon"><i className="bi bi-hourglass-split"></i></div>
              <h3>Đang tải danh sách CV</h3>
              <p>Vui lòng đợi trong giây lát...</p>
            </div>
          ) : filteredCvs.length === 0 ? (
            <div className="cv-management-empty">
              <div className="cv-management-empty-icon"><i className="bi bi-file-earmark"></i></div>
              <h3>Chưa có CV phù hợp</h3>
              <p>Bạn có thể tạo CV mới từ thư viện mẫu để bắt đầu.</p>
              <button type="button" className="cv-management-primary-btn" onClick={() => navigate('/create-cv')}>
                Đi đến Mẫu CV
              </button>
            </div>
          ) : (
            <div className="cv-management-list">
              {filteredCvs.map((cv) => (
                <article key={cv.id} className="cv-management-item">
                  <div className="cv-management-item-head">
                    <div className="cv-management-item-main">
                      <h3>{cv.name}</h3>
                      <div className="cv-management-meta">
                        <span>{cv.typeLabel}</span>
                        <span>Cập nhật: {formatDate(cv.updatedAt || cv.uploadDate)}</span>
                        {cv.status ? <span>Trạng thái: {cv.status}</span> : null}
                      </div>
                    </div>

                    <div className="cv-management-item-actions icon-only">
                      {cv.fileUrl ? (
                        <a
                          href={cv.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="cv-action-icon view"
                          title="Xem CV"
                          aria-label={`Xem CV ${cv.name}`}
                        >
                          <i className="bi bi-eye"></i>
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="cv-action-icon view"
                          disabled
                          title="Chưa có tệp"
                          aria-label="Chưa có tệp"
                        >
                          <i className="bi bi-eye-slash"></i>
                        </button>
                      )}

                      <button
                        type="button"
                        className="cv-action-icon edit"
                        disabled={!cv.isOnlineCv}
                        onClick={() => navigate(`/create-cv/online-editor?cvId=${encodeURIComponent(cv.id)}`)}
                        title="Chỉnh sửa CV"
                        aria-label={`Chỉnh sửa ${cv.name}`}
                      >
                        <i className="bi bi-pencil-square"></i>
                      </button>

                      <button
                        type="button"
                        className="cv-action-icon delete"
                        disabled={deletingId === String(cv.id)}
                        onClick={() => handleDelete(cv.id)}
                        title={deletingId === String(cv.id) ? 'Đang xóa...' : 'Xóa CV'}
                        aria-label={deletingId === String(cv.id) ? 'Đang xóa' : `Xóa ${cv.name}`}
                      >
                        <i className={`bi ${deletingId === String(cv.id) ? 'bi-arrow-repeat' : 'bi-trash'}`}></i>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CvManagementPage;
