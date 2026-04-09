import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';
import './EmployerLayout.css';

const EmployerLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { requestConfirm } = useNotification();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const profileDropdownRef = useRef(null);

    const displayName = user?.name || user?.hoTen || user?.fullName || user?.email || 'Nhà tuyển dụng';
    const roleLabel = user?.role || user?.vaiTro || 'Nhà tuyển dụng';
    const avatarUrl = String(user?.avatar || user?.avatarAbsoluteUrl || user?.AnhDaiDien || user?.avatarUrl || '').trim();
    const initial = String(displayName || 'N').trim().charAt(0).toUpperCase();

    const handleLogout = async () => {
        const confirmed = await requestConfirm({
            type: 'warning',
            title: 'Xác nhận đăng xuất',
            message: 'Bạn có chắc chắn muốn đăng xuất?',
            confirmText: 'Đăng xuất',
            cancelText: 'Ở lại'
        });
        if (!confirmed) return;

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    useEffect(() => {
        setShowProfileDropdown(false);
    }, [location.pathname]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!profileDropdownRef.current) return;
            if (profileDropdownRef.current.contains(event.target)) return;
            setShowProfileDropdown(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleHeaderMenuNavigate = (to) => {
        setShowProfileDropdown(false);
        navigate(to);
    };

    const menuItems = [
        { path: '/employer', icon: 'bi-grid-1x2', label: 'Bảng tin', exact: true, subtitle: 'Tổng quan tuyển dụng' },
        { path: '/employer/cv-search', icon: 'bi-search', label: 'Tìm kiếm CV', subtitle: 'Tìm ứng viên phù hợp' },
        { path: '/employer/cv-manage', icon: 'bi-bookmark-check', label: 'Quản lý CV', subtitle: 'Danh sách CV đã lưu' },
        { path: '/employer/jobs', icon: 'bi-briefcase', label: 'Quản lý tin tuyển dụng', subtitle: 'Đăng và theo dõi tin' },
        { path: '/employer/applications', icon: 'bi-file-earmark-person', label: 'Quản lý hồ sơ ứng tuyển', subtitle: 'Duyệt hồ sơ ứng viên' },
        { path: '/employer/messages', icon: 'bi-chat-dots', label: 'Tin nhắn', subtitle: 'Trao đổi với ứng viên' },
        { path: '/employer/statistics', icon: 'bi-bar-chart', label: 'Thống kê & báo cáo', subtitle: 'Hiệu quả tuyển dụng' },
        { path: '/employer/company', icon: 'bi-building', label: 'Thông tin công ty', subtitle: 'Hồ sơ doanh nghiệp' },
        { path: '/employer/account', icon: 'bi-person', label: 'Tài khoản', subtitle: 'Cập nhật hồ sơ cá nhân' }
    ];

    const isActive = (menuPath, exact = false) => {
        if (exact) {
            return location.pathname === menuPath;
        }
        return location.pathname.startsWith(menuPath);
    };

    const currentMenu = menuItems
        .filter((item) => isActive(item.path, item.exact))
        .sort((a, b) => b.path.length - a.path.length)[0] || menuItems[0];

    const handleToggleSidebar = () => {
        if (window.matchMedia('(max-width: 991px)').matches) {
            setMobileMenuOpen((prev) => !prev);
            return;
        }
        setSidebarCollapsed((prev) => !prev);
    };

    const closeMobileMenu = () => setMobileMenuOpen(false);

    return (
        <div className="employer-layout">
            <button
                type="button"
                className={`employer-mobile-overlay ${mobileMenuOpen ? 'show' : ''}`}
                onClick={closeMobileMenu}
                aria-label="Đóng menu"
            />

            <aside className={`employer-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}>
                <div className="employer-sidebar-user">
                    <div className="employer-user-avatar">
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt={displayName}
                                className="employer-user-avatar-image"
                                onError={(event) => {
                                    event.currentTarget.onerror = null;
                                    event.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                                }}
                            />
                        ) : (
                            initial
                        )}
                    </div>
                    {!sidebarCollapsed && (
                        <div className="employer-user-info">
                            <h6>{displayName}</h6>
                            <small>{roleLabel}</small>
                        </div>
                    )}
                </div>

                <nav className="employer-menu">
                    {menuItems.map((item) => {
                        const active = isActive(item.path, item.exact);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`employer-menu-item ${active ? 'active' : ''}`}
                                title={item.label}
                                onClick={closeMobileMenu}
                            >
                                <i className={`bi ${item.icon}`}></i>
                                {!sidebarCollapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                <div className="employer-sidebar-footer">
                    <button
                        type="button"
                        className="employer-logout-btn"
                        onClick={handleLogout}
                    >
                        <i className="bi bi-box-arrow-right"></i>
                        {!sidebarCollapsed && <span>Đăng xuất</span>}
                    </button>
                </div>
            </aside>

            <div className={`employer-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <header className="employer-header">
                    <div className="employer-header-left">
                        <button
                            type="button"
                            className="employer-sidebar-toggle"
                            onClick={handleToggleSidebar}
                            aria-label="Thu gọn menu"
                        >
                            <i className="bi bi-list"></i>
                        </button>
                        <div>
                            <h1 className="employer-header-title">{currentMenu?.label || 'Nhà tuyển dụng'}</h1>
                            <p className="employer-header-subtitle">{currentMenu?.subtitle || 'Quản lý tuyển dụng'}</p>
                        </div>
                    </div>

                    <div className="employer-header-right">
                        <Link to="/" className="employer-home-btn" title="Về trang chủ">
                            <i className="bi bi-house-door"></i>
                            <span>Trang chủ</span>
                        </Link>
                        <div className="employer-header-user" ref={profileDropdownRef}>
                            <button
                                type="button"
                                className={`employer-user-pill ${showProfileDropdown ? 'is-open' : ''}`}
                                onClick={() => setShowProfileDropdown((prev) => !prev)}
                                aria-haspopup="menu"
                                aria-expanded={showProfileDropdown}
                                aria-label="Mở menu tài khoản"
                            >
                                <div className="employer-user-pill-icon">
                                    {avatarUrl ? (
                                        <img
                                            src={avatarUrl}
                                            alt={displayName}
                                            className="employer-user-pill-avatar"
                                            onError={(event) => {
                                                event.currentTarget.onerror = null;
                                                event.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                                            }}
                                        />
                                    ) : (
                                        <i className="bi bi-shield-check"></i>
                                    )}
                                </div>
                                <div className="employer-user-pill-copy">
                                    <strong>{displayName}</strong>
                                    <small>{roleLabel}</small>
                                </div>
                                <i className={`bi bi-chevron-${showProfileDropdown ? 'up' : 'down'} employer-user-pill-chevron`} aria-hidden="true"></i>
                            </button>

                            {showProfileDropdown && (
                                <div className="employer-user-menu" role="menu">
                                    <button type="button" className="employer-user-menu-item" onClick={() => handleHeaderMenuNavigate('/employer/account')}>
                                        <i className="bi bi-file-earmark-person"></i>
                                        <span>Hồ sơ của tôi</span>
                                    </button>
                                    <button type="button" className="employer-user-menu-item" onClick={() => handleHeaderMenuNavigate('/employer')}>
                                        <i className="bi bi-speedometer2"></i>
                                        <span>Dashboard</span>
                                    </button>
                                    <button type="button" className="employer-user-menu-item" onClick={() => handleHeaderMenuNavigate('/employer/jobs')}>
                                        <i className="bi bi-briefcase"></i>
                                        <span>Quản lý tin tuyển dụng</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="employer-user-menu-item danger"
                                        onClick={() => {
                                            setShowProfileDropdown(false);
                                            handleLogout();
                                        }}
                                    >
                                        <i className="bi bi-box-arrow-right"></i>
                                        <span>Đăng xuất</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="main-content">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default EmployerLayout;
