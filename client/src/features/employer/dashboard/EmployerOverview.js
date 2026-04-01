import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const EmployerOverview = () => {
    const [stats, setStats] = useState({
        jobs: 0,
        applications: 0,
        views: 0,
        savedCandidates: 0
    });
    const [activities, setActivities] = useState([]);

    useEffect(() => {
        fetchStats();
        fetchActivities();
    }, []);

    const fetchStats = async () => {
        const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
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

    const fetchActivities = async () => {
        // Mock data
        setActivities([]);
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Bảng tin</h2>
                <Link to="/employer/jobs/create" className="btn btn-primary">
                    <i className="bi bi-plus-circle me-2"></i>
                    Đăng tin tuyển dụng
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
                            <Link to="/employer/statistics" className="btn btn-sm btn-outline-info">
                                Thống kê
                            </Link>
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

            {/* Quick Actions */}
            <div className="row g-4 mb-4">
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <h5 className="card-title">
                                <i className="bi bi-search text-primary me-2"></i>
                                Tìm kiếm ứng viên
                            </h5>
                            <p className="card-text text-muted">
                                Tìm kiếm CV ứng viên phù hợp với yêu cầu tuyển dụng của bạn
                            </p>
                            <Link to="/employer/cv-search" className="btn btn-primary">
                                Tìm kiếm ngay
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <h5 className="card-title">
                                <i className="bi bi-megaphone text-success me-2"></i>
                                Đăng tin tuyển dụng
                            </h5>
                            <p className="card-text text-muted">
                                Đăng tin tuyển dụng mới để tiếp cận nhiều ứng viên chất lượng
                            </p>
                            <Link to="/employer/jobs/create" className="btn btn-success">
                                Đăng tin ngay
                            </Link>
                        </div>
                    </div>
                </div>
                <div className="col-md-4">
                    <div className="card border-0 shadow-sm">
                        <div className="card-body">
                            <h5 className="card-title">
                                <i className="bi bi-building text-info me-2"></i>
                                Cập nhật thông tin
                            </h5>
                            <p className="card-text text-muted">
                                Cập nhật thông tin công ty để thu hút ứng viên tiềm năng
                            </p>
                            <Link to="/employer/company" className="btn btn-info">
                                Cập nhật
                            </Link>
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
