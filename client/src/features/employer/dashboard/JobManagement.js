import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SmartPagination from '../../../components/SmartPagination';

const PAGE_SIZE = 10;

const JobManagement = () => {
    const location = useLocation();
    const token = useMemo(() => localStorage.getItem('token') || '', []);
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingJobId, setDeletingJobId] = useState(null);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const flash = location.state?.flash;

    const totalJobs = jobs.length;
    const totalPages = Math.max(1, Math.ceil(totalJobs / PAGE_SIZE));
    const safeCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);

    const pagedJobs = useMemo(() => {
        const offset = (safeCurrentPage - 1) * PAGE_SIZE;
        return jobs.slice(offset, offset + PAGE_SIZE);
    }, [jobs, safeCurrentPage]);

    const rangeFrom = totalJobs === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
    const rangeTo = totalJobs === 0 ? 0 : Math.min(safeCurrentPage * PAGE_SIZE, totalJobs);

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

    useEffect(() => {
        if (currentPage !== safeCurrentPage) {
            setCurrentPage(safeCurrentPage);
        }
    }, [currentPage, safeCurrentPage]);

    const handleDeleteJob = async (job) => {
        const jobId = Number(job?.MaTin || 0);
        if (!jobId) return;

        const confirmed = window.confirm(`Bạn có chắc muốn xóa tin "${job?.TieuDe || 'này'}"?`);
        if (!confirmed) return;

        setDeletingJobId(jobId);
        setError('');

        try {
            const res = await fetch(`/jobs/${jobId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Không thể xóa tin tuyển dụng.');
            }

            setJobs((prev) => prev.filter((item) => Number(item.MaTin) !== jobId));
        } catch (err) {
            setError(err.message || 'Không thể xóa tin tuyển dụng.');
        } finally {
            setDeletingJobId(null);
        }
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0 employer-page-title">Quản lý tin tuyển dụng</h2>
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
                                    {pagedJobs.map((j) => (
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
                                                <div className="job-manage-row-actions">
                                                    <Link
                                                        to={`/employer/jobs/${j.MaTin}`}
                                                        className="btn btn-outline-secondary btn-sm job-manage-action-icon"
                                                        title="Xem chi tiết"
                                                        aria-label="Xem chi tiết"
                                                    >
                                                        <i className="bi bi-eye"></i>
                                                    </Link>
                                                    <Link
                                                        to={`/employer/jobs/${j.MaTin}/edit`}
                                                        className="btn btn-outline-primary btn-sm job-manage-action-icon"
                                                        title="Chỉnh sửa"
                                                        aria-label="Chỉnh sửa"
                                                    >
                                                        <i className="bi bi-pencil-square"></i>
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger btn-sm job-manage-action-icon"
                                                        title="Xóa tin"
                                                        aria-label="Xóa tin"
                                                        onClick={() => handleDeleteJob(j)}
                                                        disabled={deletingJobId === Number(j.MaTin)}
                                                    >
                                                        {deletingJobId === Number(j.MaTin) ? (
                                                            <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                                                        ) : (
                                                            <i className="bi bi-trash"></i>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!loading && jobs.length > 0 && (
                        <div className="d-flex justify-content-end mt-3">
                            <SmartPagination
                                from={rangeFrom}
                                to={rangeTo}
                                totalItems={totalJobs}
                                currentPage={safeCurrentPage}
                                pageSize={PAGE_SIZE}
                                onPageChange={setCurrentPage}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JobManagement;
