import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';

const fmtVnd = new Intl.NumberFormat('vi-VN');

const formatSalary = (job) => {
  const type = job.KieuLuong || 'Thỏa thuận';
  const from = job.LuongTu == null ? null : Number(job.LuongTu);
  const to = job.LuongDen == null ? null : Number(job.LuongDen);

  if (type === 'Thỏa thuận' || (from == null && to == null)) return 'Thỏa thuận';
  const unit = String(type).toLowerCase();

  if (Number.isFinite(from) && Number.isFinite(to)) return `${fmtVnd.format(from)} - ${fmtVnd.format(to)} VND/${unit}`;
  if (Number.isFinite(from)) return `Từ ${fmtVnd.format(from)} VND/${unit}`;
  if (Number.isFinite(to)) return `Đến ${fmtVnd.format(to)} VND/${unit}`;
  return 'Thỏa thuận';
};

const SavedJobsPage = () => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';

  const token = useMemo(() => localStorage.getItem('token') || '', []);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');

      if (!token) {
        setLoading(false);
        setItems([]);
        setError('Bạn cần đăng nhập để xem việc làm đã lưu.');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/jobs/saved`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error((data && data.error) || 'Không tải được danh sách việc làm đã lưu');

        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không tải được danh sách việc làm đã lưu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [API_BASE, token]);

  const removeSaved = async (jobId) => {
    if (!token) {
      notify({ type: 'error', message: 'Bạn cần đăng nhập.' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/jobs/saved/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || 'Không thể bỏ lưu');

      setItems((prev) => prev.filter((x) => String(x.MaTin) !== String(jobId)));
      notify({ type: 'success', message: 'Đã bỏ lưu công việc.' });
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không thể bỏ lưu' });
    }
  };

  return (
    <div className="container" style={{ paddingTop: 92, paddingBottom: 32 }}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <div>
          <h3 className="fw-bold mb-1">Việc làm đã lưu</h3>
          <div className="text-muted">Danh sách công việc bạn đã lưu.</div>
        </div>
        <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
          Quay lại
        </button>
      </div>

      {loading && <div className="text-muted">Đang tải...</div>}
      {error && !loading && <div className="alert alert-danger">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-4">
            <div className="text-muted">Bạn chưa lưu công việc nào.</div>
            <div className="mt-3">
              <Link to="/jobs" className="btn btn-success">
                Tìm việc ngay
              </Link>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="row g-3">
          {items.map((j) => (
            <div key={j.MaTin} className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-body d-flex gap-3 align-items-center flex-wrap">
                  <div className="flex-shrink-0" style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,0,0,.08)' }}>
                    <img
                      src={j.Logo || '/images/logo.png'}
                      alt={j.TenCongTy || 'Logo'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/images/logo.png';
                      }}
                    />
                  </div>

                  <div className="flex-grow-1" style={{ minWidth: 260 }}>
                    <div className="fw-bold" style={{ fontSize: 18 }}>
                      <Link to={`/jobs/${j.MaTin}`} className="text-decoration-none">
                        {j.TieuDe}
                      </Link>
                    </div>
                    <div className="text-muted fw-semibold">{j.TenCongTy || 'Nhà tuyển dụng'}</div>
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      <span className="badge text-bg-light border">
                        <i className="bi bi-geo-alt me-1"></i>{j.ThanhPho || '---'}
                      </span>
                      <span className="badge text-bg-light border">
                        <i className="bi bi-briefcase me-1"></i>{j.HinhThuc || '---'}
                      </span>
                      <span className="badge text-bg-light border">
                        <i className="bi bi-cash-coin me-1"></i>{formatSalary(j)}
                      </span>
                    </div>
                  </div>

                  <div className="d-flex gap-2 ms-auto">
                    <Link to={`/jobs/${j.MaTin}`} className="btn btn-success">
                      Xem chi tiết
                    </Link>
                    <button type="button" className="btn btn-outline-danger" onClick={() => removeSaved(j.MaTin)} aria-label="Bỏ lưu">
                      <i className="bi bi-bookmark-x"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SavedJobsPage;

