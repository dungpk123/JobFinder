import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE as CLIENT_API_BASE } from '../../../config/apiBase';

const EmployerOverview = () => {
    const [stats, setStats] = useState({
        jobs: 0,
        applications: 0,
        views: 0,
        savedCandidates: 0
    });
    const [activities, setActivities] = useState([]);
    const [reportLoading, setReportLoading] = useState(true);
    const [reportError, setReportError] = useState('');
    const [reportJobs, setReportJobs] = useState([]);

    useEffect(() => {
        fetchStats();
        fetchReportData();
        fetchActivities();
    }, []);

    const fetchStats = async () => {
        const API_BASE = CLIENT_API_BASE;
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const res = await fetch(`${API_BASE}/api/employer/overview`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Không tải được thống kê');

            const s = data?.stats || {};
            setStats({
                jobs: Number(s.jobs || 0),
                applications: Number(s.applications || 0),
                views: Number(s.views || 0),
                savedCandidates: Number(s.savedCandidates || 0)
            });
        } catch {
            // keep current stats
        }
    };

    const fetchReportData = async () => {
        const API_BASE = CLIENT_API_BASE;
        const token = localStorage.getItem('token');
        if (!token) {
            setReportLoading(false);
            setReportJobs([]);
            return;
        }

        setReportLoading(true);
        setReportError('');
        try {
            const res = await fetch(`${API_BASE}/api/employer/statistics`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Không tải được dữ liệu báo cáo');

            const summary = data?.summary || {};
            setStats((prev) => ({
                jobs: Number(summary.jobs || prev.jobs || 0),
                applications: Number(summary.applications || prev.applications || 0),
                views: Number(summary.views || prev.views || 0),
                savedCandidates: Number(summary.savedCandidates || prev.savedCandidates || 0)
            }));
            setReportJobs(Array.isArray(data?.jobs) ? data.jobs : []);
        } catch (error) {
            setReportError(error?.message || 'Có lỗi khi tải báo cáo.');
            setReportJobs([]);
        } finally {
            setReportLoading(false);
        }
    };

    const fetchActivities = async () => {
        // Mock data
        setActivities([]);
    };

    const maxViews = useMemo(() => {
        if (!Array.isArray(reportJobs) || reportJobs.length === 0) return 0;
        return reportJobs.reduce((maxValue, job) => Math.max(maxValue, Number(job?.views || 0)), 0);
    }, [reportJobs]);

    const handleScrollToReports = () => {
        const reportSection = document.getElementById('employer-dashboard-reports');
        if (!reportSection) return;
        reportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-1 employer-page-title">Dashboard</h2>
                    <p className="text-muted mb-0">Tổng quan dashboard và báo cáo hiệu quả tuyển dụng.</p>
                </div>
                <Link to="/employer/jobs/create" className="btn btn-primary">
                    <i className="bi bi-plus-circle me-2"></i>
                    Tạo tin mới
                </Link>
            </div>
            
            {/* Statistics Cards */}
            <div className="row g-4 mb-4">
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body text-center">
                            <div className="text-primary mb-3">
                                <i className="bi bi-briefcase fs-1"></i>
                            </div>
                            <h3 className="mb-1">{stats.jobs}</h3>
                            <p className="text-muted mb-2">Tin tuyển dụng</p>
                            <Link to="/employer/jobs" className="btn btn-sm btn-outline-primary">
                                Quản lý
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body text-center">
                            <div className="text-success mb-3">
                                <i className="bi bi-file-earmark-text fs-1"></i>
                            </div>
                            <h3 className="mb-1">{stats.applications}</h3>
                            <p className="text-muted mb-2">Hồ sơ ứng tuyển</p>
                            <Link to="/employer/applications" className="btn btn-sm btn-outline-success">
                                Xem hồ sơ
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body text-center">
                            <div className="text-info mb-3">
                                <i className="bi bi-eye fs-1"></i>
                            </div>
                            <h3 className="mb-1">{stats.views}</h3>
                            <p className="text-muted mb-2">Lượt xem tin</p>
                            <button type="button" className="btn btn-sm btn-outline-info" onClick={handleScrollToReports}>
                                Xem báo cáo
                            </button>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-body text-center">
                            <div className="text-warning mb-3">
                                <i className="bi bi-people fs-1"></i>
                            </div>
                            <h3 className="mb-1">{stats.savedCandidates}</h3>
                            <p className="text-muted mb-2">CV đã lưu</p>
                            <Link to="/employer/cv-manage" className="btn btn-sm btn-outline-warning">
                                Quản lý CV
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Reports (merged from Statistics page) */}
            <div id="employer-dashboard-reports" className="row g-4 mb-4">
                <div className="col-12">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-white border-0 py-3 d-flex align-items-center justify-content-between">
                            <h5 className="mb-0">
                                <i className="bi bi-graph-up-arrow me-2"></i>
                                Thống kê & báo cáo
                            </h5>
                            <small className="text-muted">Hiệu quả lượt xem và ứng tuyển theo từng tin</small>
                        </div>
                        <div className="card-body">
                            {reportLoading && (
                                <p className="text-muted text-center py-5 mb-0">Đang tải dữ liệu...</p>
                            )}
                            {!reportLoading && reportError && (
                                <p className="text-danger text-center py-4 mb-0">{reportError}</p>
                            )}
                            {!reportLoading && !reportError && reportJobs.length === 0 && (
                                <p className="text-muted text-center py-5 mb-0">Chưa có dữ liệu thống kê.</p>
                            )}
                            {!reportLoading && !reportError && reportJobs.length > 0 && (
                                <div className="table-responsive">
                                    <table className="table align-middle mb-0">
                                        <thead>
                                            <tr>
                                                <th>Tin tuyển dụng</th>
                                                <th style={{ width: 140 }} className="text-end">Lượt xem</th>
                                                <th style={{ width: 170 }}>Biểu đồ</th>
                                                <th style={{ width: 160 }} className="text-end">Ứng tuyển</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reportJobs.map((job) => {
                                                const views = Number(job?.views || 0);
                                                const applications = Number(job?.applications || 0);
                                                const ratio = maxViews > 0 ? Math.round((views / maxViews) * 100) : 0;

                                                return (
                                                    <tr key={job?.id || `${job?.title || 'job'}-${views}-${applications}`}>
                                                        <td>
                                                            <div className="fw-semibold">{job?.title || 'Tin tuyển dụng'}</div>
                                                            <div className="text-muted small">{job?.status || ''}</div>
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
                                                        <td className="text-end">{applications}</td>
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

            {/* Activity & Notifications */}
            <div className="row g-4">
                <div className="col-md-8">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-white border-0 py-3">
                            <h5 className="mb-0">
                                <i className="bi bi-clock-history me-2"></i>
                                Hoạt động gần đây
                            </h5>
                        </div>
                        <div className="card-body">
                            {activities.length === 0 ? (
                                <div className="text-center py-5">
                                    <i className="bi bi-inbox fs-1 text-muted"></i>
                                    <p className="text-muted mt-3">Chưa có hoạt động nào</p>
                                </div>
                            ) : (
                                <div className="list-group list-group-flush">
                                    {activities.map((activity, index) => (
                                        <div key={index} className="list-group-item">
                                            {activity.description}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-white border-0 py-3">
                            <h5 className="mb-0">
                                <i className="bi bi-bell me-2"></i>
                                Thông báo
                            </h5>
                        </div>
                        <div className="card-body">
                            <div className="text-center py-4">
                                <i className="bi bi-bell-slash fs-1 text-muted"></i>
                                <p className="text-muted mt-3 mb-0">Không có thông báo mới</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployerOverview;
