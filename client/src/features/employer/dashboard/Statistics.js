import React, { useEffect, useMemo, useState } from 'react';

const Statistics = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState({ jobs: 0, applications: 0, views: 0, savedCandidates: 0, reports: 0 });
    const [jobs, setJobs] = useState([]);

    const token = useMemo(() => localStorage.getItem('token') || '', []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
            if (!token) {
                setLoading(false);
                setJobs([]);
                return;
            }

            setLoading(true);
            setError('');
            try {
                const res = await fetch(`${API_BASE}/api/employer/statistics`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json().catch(() => null);
                if (!res.ok) throw new Error(data?.error || 'Không tải được dữ liệu thống kê');
                if (cancelled) return;

                const s = data?.summary || {};
                setSummary({
                    jobs: Number(s.jobs || 0),
                    applications: Number(s.applications || 0),
                    views: Number(s.views || 0),
                    savedCandidates: Number(s.savedCandidates || 0),
                    reports: Number(s.reports || 0)
                });
                setJobs(Array.isArray(data?.jobs) ? data.jobs : []);
            } catch (err) {
                if (!cancelled) {
                    setError(err?.message || 'Có lỗi xảy ra');
                    setJobs([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [token]);

    const maxViews = useMemo(() => {
        if (!Array.isArray(jobs) || jobs.length === 0) return 0;
        return jobs.reduce((m, j) => Math.max(m, Number(j?.views || 0)), 0);
    }, [jobs]);

    return (
        <div>
            <h2 className="mb-4">Thống kê</h2>

            <div className="row g-3 mb-4">
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="text-muted">Tin tuyển dụng</div>
                            <div className="fs-3 fw-semibold">{summary.jobs}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="text-muted">Hồ sơ ứng tuyển</div>
                            <div className="fs-3 fw-semibold">{summary.applications}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="text-muted">Tổng lượt xem</div>
                            <div className="fs-3 fw-semibold">{summary.views}</div>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body">
                            <div className="text-muted">CV đã lưu</div>
                            <div className="fs-3 fw-semibold">{summary.savedCandidates}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-4">
                <div className="col-md-12">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-white">
                            <h5 className="mb-0">Biểu đồ lượt xem tin tuyển dụng</h5>
                        </div>
                        <div className="card-body">
                            {loading && (
                                <p className="text-muted text-center py-5 mb-0">Đang tải dữ liệu...</p>
                            )}
                            {!loading && error && (
                                <p className="text-danger text-center py-4 mb-0">{error}</p>
                            )}
                            {!loading && !error && jobs.length === 0 && (
                                <p className="text-muted text-center py-5 mb-0">Chưa có dữ liệu thống kê.</p>
                            )}
                            {!loading && !error && jobs.length > 0 && (
                                <div className="table-responsive">
                                    <table className="table align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Tin tuyển dụng</th>
                                                <th style={{ width: 140 }} className="text-end">Lượt xem</th>
                                                <th style={{ width: 160 }}>Biểu đồ</th>
                                                <th style={{ width: 160 }} className="text-end">Ứng tuyển</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {jobs.map((j) => {
                                                const views = Number(j?.views || 0);
                                                const apps = Number(j?.applications || 0);
                                                const ratio = maxViews > 0 ? Math.round((views / maxViews) * 100) : 0;
                                                return (
                                                    <tr key={j?.id || `${j?.title}-${views}`}
                                                        title={j?.postedAt ? `Ngày đăng: ${j.postedAt}` : ''}
                                                    >
                                                        <td>
                                                            <div className="fw-semibold">{j?.title || 'Tin tuyển dụng'}</div>
                                                            <div className="text-muted small">{j?.status || ''}</div>
                                                        </td>
                                                        <td className="text-end">{views}</td>
                                                        <td>
                                                            <div className="progress" style={{ height: 10 }}>
                                                                <div
                                                                    className="progress-bar bg-info"
                                                                    role="progressbar"
                                                                    style={{ width: `${ratio}%` }}
                                                                    aria-valuenow={ratio}
                                                                    aria-valuemin="0"
                                                                    aria-valuemax="100"
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="text-end">{apps}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Statistics;
