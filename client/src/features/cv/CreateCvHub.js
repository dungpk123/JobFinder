import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';
import './CreateCvHub.css';

const CreateCvHub = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  const userId = user?.id || user?.MaNguoiDung || user?.maNguoiDung || user?.userId || user?.userID || null;

  const [loading, setLoading] = useState(false);
  const [onlineCvs, setOnlineCvs] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  const fetchOnlineCvs = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cvs?userId=${encodeURIComponent(userId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Không tải được danh sách CV');
      const all = Array.isArray(data.cvs) ? data.cvs : [];
      const onlyOnline = all.filter((cv) => String(cv?.fileUrl || '').endsWith('.html'));
      setOnlineCvs(onlyOnline);
    } catch (err) {
      setOnlineCvs([]);
      notify({ type: 'error', message: err.message || 'Không tải được danh sách CV' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCv = async (cvId) => {
    if (!userId || !cvId) return;
    const ok = window.confirm('Bạn có chắc muốn xóa CV này không? Hành động này không thể hoàn tác.');
    if (!ok) return;

    setDeletingId(cvId);
    try {
      const res = await fetch(`/api/cvs/${encodeURIComponent(cvId)}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể xóa CV');

      setOnlineCvs((prev) => prev.filter((cv) => cv.id !== cvId));
      notify({ type: 'success', message: 'Đã xóa CV.' });
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không thể xóa CV' });
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchOnlineCvs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div className="create-cv-hub-page">
      <div className="container create-cv-hub-container">
        <div className="create-cv-hero card border-0 shadow-sm">
          <div className="card-body create-cv-hero-body">
            <div className="create-cv-hero-left">
              <h2 className="mb-2 fw-bold">
                Ứng viên được NTD chủ động tiếp cận <span className="text-white">tăng 28%</span> trong tuần vừa rồi
              </h2>
              <div className="text-white-50 fw-semibold mb-3">Cập nhật CV để không bỏ lỡ cơ hội!</div>
              <div className="d-flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-light fw-semibold"
                  onClick={() => navigate('/create-cv/templates')}
                >
                  Tạo CV online <span className="ms-1">+</span>
                </button>
              </div>
            </div>
            <div className="create-cv-hero-right" aria-hidden="true">
              <div className="create-cv-chart">
                <div className="create-cv-chart-badge">↗ 28%</div>
                <div className="create-cv-chart-grid"></div>
                <div className="create-cv-chart-line"></div>
                <div className="create-cv-chart-dot"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm mt-4">
          <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between py-3">
            <div className="fw-bold">CV đã tạo trên JobFinder</div>
            <button
              type="button"
              className="btn btn-success rounded-pill fw-semibold"
              onClick={() => navigate('/create-cv/templates')}
            >
              <i className="bi bi-plus-lg me-1"></i>Tạo CV
            </button>
          </div>
          <div className="card-body">
            {!userId ? (
              <div className="create-cv-empty">
                <div className="create-cv-empty-icon"><i className="bi bi-lock"></i></div>
                <div className="text-secondary">Vui lòng đăng nhập để xem CV đã tạo.</div>
              </div>
            ) : loading ? (
              <div className="create-cv-empty">
                <div className="create-cv-empty-icon"><i className="bi bi-hourglass-split"></i></div>
                <div className="text-secondary">Đang tải danh sách CV...</div>
              </div>
            ) : onlineCvs.length === 0 ? (
              <div className="create-cv-empty">
                <div className="create-cv-empty-icon">
                  <i className="bi bi-file-earmark-text"></i>
                </div>
                <div className="text-secondary">Chưa có CV online nào được tạo.</div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Tên CV</th>
                      <th style={{ width: 160 }}>Cập nhật</th>
                      <th style={{ width: 220 }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onlineCvs.map((cv) => (
                      <tr key={cv.id}>
                        <td className="fw-semibold">
                          {cv.name}
                          <span className="badge bg-info text-dark ms-2">CV Online</span>
                        </td>
                        <td>{cv.uploadDate ? new Date(cv.uploadDate).toLocaleDateString('vi-VN') : '-'}</td>
                        <td>
                          <div className="d-flex gap-2 flex-wrap">
                            {cv.fileUrl ? (
                              <a className="btn btn-sm btn-outline-primary" href={cv.fileUrl} target="_blank" rel="noreferrer">Xem</a>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              onClick={() => navigate(`/create-cv/online-editor?cvId=${encodeURIComponent(cv.id)}`)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={deletingId === cv.id}
                              onClick={() => handleDeleteCv(cv.id)}
                            >
                              {deletingId === cv.id ? 'Đang xóa...' : 'Xóa'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCvHub;

