import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';

const CvUploadPage = () => {
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
  const [uploading, setUploading] = useState(false);
  const [cvs, setCvs] = useState([]);
  const fileInputRef = useRef(null);

  const fetchCvs = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cvs?userId=${encodeURIComponent(userId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Không tải được danh sách CV');
      setCvs(Array.isArray(data.cvs) ? data.cvs : []);
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không tải được danh sách CV' });
      setCvs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCvs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const onPickFile = () => fileInputRef.current?.click();

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(file.type)) {
      notify({ type: 'error', message: 'Chỉ chấp nhận file PDF, DOC, hoặc DOCX' });
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify({ type: 'error', message: 'Kích thước file không được vượt quá 5MB' });
      e.target.value = '';
      return;
    }

    if (!userId) {
      notify({ type: 'error', message: 'Vui lòng đăng nhập để tải CV.' });
      e.target.value = '';
      return;
    }

    const form = new FormData();
    form.append('cvFile', file);
    form.append('userId', userId);
    form.append('cvTitle', file.name);

    setUploading(true);
    try {
      const res = await fetch('/api/cvs', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể tải CV lên');
      notify({ type: 'success', message: 'Tải CV lên thành công.' });
      await fetchCvs();
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không thể tải CV lên' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const onDelete = async (cv) => {
    if (!cv?.id) return;
    if (!userId) return;

    const ok = window.confirm('Bạn có chắc muốn xóa CV này?');
    if (!ok) return;

    try {
      const res = await fetch(`/api/cvs/${cv.id}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Không thể xóa CV');
      setCvs((prev) => prev.filter((x) => x.id !== cv.id));
      notify({ type: 'success', message: 'Đã xóa CV.' });
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không thể xóa CV' });
    }
  };

  if (!userId) {
    return (
      <div className="container py-5">
        <div className="alert alert-warning mb-0">Bạn cần đăng nhập để quản lý CV.</div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h3 className="mb-1">Tải CV</h3>
          <div className="text-muted">Tải CV (PDF/DOC/DOCX) hoặc tạo CV Online để chỉnh sửa trực tiếp.</div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/create-cv')}>Quay lại</button>
          <button type="button" className="btn btn-success" onClick={() => navigate('/create-cv/templates')}>Tạo CV Online</button>

          <button type="button" className="btn btn-primary" onClick={onPickFile} disabled={uploading}>
            {uploading ? 'Đang tải...' : 'Tải CV lên'}
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={onUpload} />
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-muted">Đang tải danh sách CV...</div>
          ) : cvs.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-muted">Chưa có CV nào.</div>
              <div className="text-muted small mt-1">Chấp nhận: PDF, DOC, DOCX (tối đa 5MB)</div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Tên CV</th>
                    <th style={{ width: 140 }}>Dung lượng</th>
                    <th style={{ width: 160 }}>Cập nhật</th>
                    <th style={{ width: 220 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {cvs.map((cv) => (
                    <tr key={cv.id}>
                      <td className="fw-semibold">
                        {cv.name}
                        {cv?.fileUrl?.endsWith('.html') ? (
                          <span className="badge bg-info text-dark ms-2">CV Online</span>
                        ) : null}
                      </td>
                      <td>{cv.size || '-'}</td>
                      <td>{cv.uploadDate ? new Date(cv.uploadDate).toLocaleDateString('vi-VN') : '-'}</td>
                      <td>
                        <div className="d-flex gap-2 flex-wrap">
                          {cv.fileUrl ? (
                            <a className="btn btn-sm btn-outline-primary" href={cv.fileUrl} target="_blank" rel="noreferrer">Xem</a>
                          ) : null}
                          {cv?.fileUrl?.endsWith('.html') ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              onClick={() => navigate(`/create-cv/online-editor?cvId=${encodeURIComponent(cv.id)}`)}
                            >
                              Sửa Online
                            </button>
                          ) : null}
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(cv)}>
                            Xóa
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
  );
};

export default CvUploadPage;

