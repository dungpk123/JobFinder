import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const JobManagement = () => {
    const location = useLocation();
    const token = useMemo(() => localStorage.getItem('token') || '', []);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const flash = location.state?.flash;

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetch('/jobs/mine', {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const data = await res.json().catch(() => ([]));
                if (!res.ok) {
                    throw new Error(data.error || 'Không thể tải danh sách tin tuyển dụng.');
                }
                if (!cancelled) setJobs(Array.isArray(data) ? data : []);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Có lỗi xảy ra.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => { cancelled = true; };
    }, [token]);

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Quản lý tin tuyển dụng</h2>
                <Link to="/employer/jobs/create" className="btn btn-primary">
                    <i className="bi bi-plus-circle me-2"></i>
                    Đăng tin mới
                </Link>
            </div>

            {flash && (
                <div className="alert alert-success" role="alert">
                    {flash}
                </div>
            )}

            {error && (
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            )}

            <div className="card border-0 shadow-sm">
                <div className="card-body">
                    {loading ? (
                        <p className="text-muted text-center py-5 mb-0">Đang tải...</p>
                    ) : jobs.length === 0 ? (
                        <p className="text-muted text-center py-5 mb-0">
                            Bạn chưa có tin tuyển dụng nào. <br />
                            Hãy đăng tin đầu tiên để tìm kiếm ứng viên!
                        </p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Tiêu đề</th>
                                        <th>Địa điểm</th>
                                        <th>Trạng thái</th>
                                        <th>Ngày đăng</th>
                                        <th className="text-end">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.map((j) => (
                                        <tr key={j.MaTin}>
                                            <td className="fw-semibold">{j.TieuDe}</td>
                                            <td>{[j.DiaDiem, j.ThanhPho].filter(Boolean).join(', ') || '-'}</td>
                                            <td>
                                                <span className={`badge ${j.TrangThai === 'Đã đăng' ? 'bg-success' : 'bg-secondary'}`}>
                                                    {j.TrangThai}
                                                </span>
                                            </td>
                                            <td>{j.NgayDang ? String(j.NgayDang) : '-'}</td>
                                            <td className="text-end">
                                                <div className="d-flex justify-content-end gap-2">
                                                    <Link to={`/employer/jobs/${j.MaTin}`} className="btn btn-outline-secondary btn-sm">
                                                        Xem
                                                    </Link>
                                                    <Link to={`/employer/jobs/${j.MaTin}/edit`} className="btn btn-outline-primary btn-sm">
                                                        Chỉnh sửa
                                                    </Link>
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

export default JobManagement;
