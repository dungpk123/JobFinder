import React, { useState } from 'react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import './EmployerLayout.css';

const EmployerLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const menuItems = [
        { path: '/employer', icon: 'bi-speedometer2', label: 'Bảng tin', exact: true },
        { path: '/employer/cv-search', icon: 'bi-search', label: 'Tìm kiếm CV' },
        { path: '/employer/cv-manage', icon: 'bi-file-earmark-check', label: 'Quản lý CV' },
        { path: '/employer/jobs', icon: 'bi-briefcase', label: 'Quản lý tin tuyển dụng' },
        { path: '/employer/applications', icon: 'bi-file-earmark-text', label: 'Quản lý hồ sơ ứng tuyển' },
        { path: '/employer/statistics', icon: 'bi-bar-chart', label: 'Thống kê & báo cáo' },
        { path: '/employer/company', icon: 'bi-building', label: 'Thông tin công ty' },
        { path: '/employer/account', icon: 'bi-person', label: 'Tài khoản' }
    ];

    const isActive = (menuPath, exact = false) => {
        if (exact) {
            return location.pathname === menuPath;
        }
        return location.pathname.startsWith(menuPath);
    };

    return (
        <div className="employer-layout">
            {/* Sidebar */}
            <div className={`employer-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <img src="/images/logo.png" alt="JobFinder" className="sidebar-logo" />
                    {!sidebarCollapsed && <h5 className="mb-0">JobFinder</h5>}
                </div>

                <div className="sidebar-user">
                    <div className="user-avatar">
                        <i className="bi bi-person-circle fs-1"></i>
                    </div>
                    {!sidebarCollapsed && (
                        <div className="user-info">
                            <h6 className="mb-0">{user.name}</h6>
                            <small className="text-muted">{user.role}</small>
                        </div>
                    )}
                </div>

                <nav className="sidebar-menu">
                    {menuItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`menu-item ${isActive(item.path, item.exact) ? 'active' : ''}`}
                            title={item.label}
                        >
                            <i className={`bi ${item.icon}`}></i>
                            {!sidebarCollapsed && (
                                <>
                                    <span>{item.label}</span>
                                    {item.badge && <span className="badge bg-primary ms-auto">{item.badge}</span>}
                                </>
                            )}
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button 
                        className="btn btn-link text-decoration-none w-100" 
                        onClick={handleLogout}
                    >
                        <i className="bi bi-box-arrow-right"></i>
                        {!sidebarCollapsed && <span>Đăng xuất</span>}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="employer-main">
                <div className="main-header">
                    <button 
                        className="btn btn-link sidebar-toggle" 
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    >
                        <i className="bi bi-list fs-4"></i>
                    </button>
                    <div className="ms-auto d-flex align-items-center gap-3">
                        <Link to="/employer/applications" className="btn btn-link position-relative" title="Tin nhắn">
                            <i className="bi bi-chat-dots fs-5"></i>
                        </Link>
                        <button className="btn btn-link position-relative">
                            <i className="bi bi-bell fs-5"></i>
                            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                                3
                            </span>
                        </button>
                    </div>
                </div>

                <div className="main-content">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default EmployerLayout;
