import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { sanitizeCareerHtml } from '../../career-guide/richTextUtils';

const formatCurrencyVnd = (value) => {
    if (value === null || value === undefined) return '';
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    return new Intl.NumberFormat('vi-VN').format(num);
};

const JobDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = useMemo(() => localStorage.getItem('token') || '', []);
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`/jobs/${id}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Không tải được tin tuyển dụng');
                if (!cancelled) setJob(data);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Có lỗi xảy ra.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [id, token]);

    const renderRich = (html) => (
        <div
            className="border rounded p-3 bg-light"
            style={{ minHeight: 80 }}
            dangerouslySetInnerHTML={{ __html: sanitizeCareerHtml(html || '') || '<em>Chưa cập nhật</em>' }}
        />
    );

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <button className="btn btn-link p-0 me-3" onClick={() => navigate(-1)}>
                        ← Quay lại
                    </button>
                    <h2 className="mb-0 employer-page-title">Chi tiết tin tuyển dụng</h2>
                </div>
                <div className="d-flex gap-2">
                    <Link to={`/employer/jobs/${id}/edit`} className="btn btn-primary">
                        Chỉnh sửa
                    </Link>
                    <Link to="/employer/jobs" className="btn btn-outline-secondary">
                        Danh sách tin
                    </Link>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {loading && <p className="text-muted">Đang tải...</p>}
            {!loading && job && (
                <div className="card border-0 shadow-sm">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                            <div>
                                <h4 className="mb-1">{job.TieuDe}</h4>
                                <div className="text-muted">
                                    {[job.DiaDiem, job.ThanhPho].filter(Boolean).join(', ') || 'Chưa cập nhật'}
                                </div>
                            </div>
                            <span className={`badge ${job.TrangThai === 'Đã đăng' ? 'bg-success' : 'bg-secondary'}`}>
                                {job.TrangThai}
                            </span>
                        </div>

                        <div className="row g-3 mb-3">
                            <div className="col-md-6">
                                <strong>Kiểu lương:</strong> {job.KieuLuong || 'Chưa cập nhật'}
                            </div>
                            <div className="col-md-6">
                                <strong>Hình thức:</strong> {job.HinhThuc || 'Chưa cập nhật'}
                            </div>
                            <div className="col-md-6">
                                <strong>Lương từ:</strong> {formatCurrencyVnd(job.LuongTu)}
                            </div>
                            <div className="col-md-6">
                                <strong>Lương đến:</strong> {formatCurrencyVnd(job.LuongDen)}
                            </div>
                            <div className="col-md-6">
                                <strong>Ngày đăng:</strong> {job.NgayDang || 'Chưa cập nhật'}
                            </div>
                            <div className="col-md-6">
                                <strong>Hạn nộp:</strong> {job.HanNopHoSo || 'Chưa cập nhật'}
                            </div>
                        </div>

                        <div className="mb-3">
                            <h6 className="fw-semibold">Mô tả</h6>
                            {renderRich(job.MoTa)}
                        </div>
                        <div className="mb-3">
                            <h6 className="fw-semibold">Yêu cầu</h6>
                            {renderRich(job.YeuCau)}
                        </div>
                        <div>
                            <h6 className="fw-semibold">Quyền lợi</h6>
                            {renderRich(job.QuyenLoi)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobDetail;
