import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Header = () => {
    const location = useLocation();
    const [showJobManagement, setShowJobManagement] = useState(false);
    const [showMobileJobsMenu, setShowMobileJobsMenu] = useState(false);

    const collapseMobileNavbar = () => {
        const collapseElement = document.getElementById('mainNavbar');
        if (!collapseElement?.classList.contains('show')) return;

        const bootstrap = window.bootstrap;
        if (bootstrap?.Collapse) {
            const instance = bootstrap.Collapse.getInstance(collapseElement)
                || new bootstrap.Collapse(collapseElement, { toggle: false });
            instance.hide();
            return;
        }

        collapseElement.classList.remove('show');
        const toggler = document.querySelector('[data-bs-target="#mainNavbar"]');
        if (toggler) {
            toggler.setAttribute('aria-expanded', 'false');
            toggler.classList.add('collapsed');
        }
    };

    useEffect(() => {
        setShowMobileJobsMenu(false);
        setShowJobManagement(false);
        collapseMobileNavbar();
    }, [location.pathname]);

    const normalize = (value) => String(value || '').trim().toLowerCase();

    const resolveRoleLabel = (rawRole, isSuperAdmin) => {
        const role = normalize(rawRole);
        if (isSuperAdmin || role.includes('siêu') || role.includes('sieu')) return 'Siêu quản trị viên';
        if (role.includes('quản trị') || role.includes('quan tri')) return 'Quản trị';
        if (role.includes('nhà tuyển dụng') || role.includes('nha tuyen dung')) return 'Nhà tuyển dụng';
        return 'Ứng viên';
    };
    
    // Kiểm tra trạng thái đăng nhập
    const user = (() => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch {
            return null;
        }
    })();

    const userRole = String(user?.role || user?.vaiTro || user?.VaiTro || '').trim();
    const isSuperAdmin = (
        user?.isSuperAdmin === true
        || user?.isSuperAdmin === 1
        || user?.isSuperAdmin === '1'
        || user?.IsSuperAdmin === true
        || user?.IsSuperAdmin === 1
        || user?.IsSuperAdmin === '1'
    );
    const roleLabel = resolveRoleLabel(userRole, isSuperAdmin);
    const isEmployer = roleLabel === 'Nhà tuyển dụng';
    const isAdmin = (
        roleLabel === 'Quản trị'
        || roleLabel === 'Siêu quản trị viên'
        || isSuperAdmin
    );
    const profileTitle = String(user?.HoTen || user?.name || user?.fullName || user?.username || user?.email || '').trim() || 'Tài khoản của tôi';
    const avatarUrl = String(user?.avatar || user?.avatarAbsoluteUrl || user?.AnhDaiDien || user?.avatarUrl || '').trim();
    const profileIcon = isAdmin
        ? 'bi-shield-check'
        : (isEmployer ? 'bi-building-check' : 'bi-person-check');
    const profileLink = isEmployer ? '/employer/account' : (isAdmin ? '/admin/profile' : '/profile');
    const dashboardLink = isEmployer ? '/employer' : (isAdmin ? '/admin' : '');
    const messagingLink = isEmployer ? '/employer/messages' : (!isAdmin ? '/messages' : '');

    return (
        <nav className="navbar navbar-expand-lg bg-white border-bottom shadow-sm jf-main-navbar">
            <div className="container-fluid px-3 px-lg-4 jf-main-navbar__container">
                <Link className="navbar-brand d-flex align-items-center gap-3 text-decoration-none jf-main-navbar__brand" to="/">
                    <img src="/images/logo.png" alt="JobFinder Logo" className="jf-main-navbar__logo" />
                </Link>
                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar" aria-controls="mainNavbar" aria-expanded="false" aria-label="Toggle navigation">
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse justify-content-between" id="mainNavbar">
                    <ul className="navbar-nav align-items-lg-center gap-lg-4 mb-3 mb-lg-0">
                        <li className="nav-item">
                            <Link className="nav-link fw-semibold fs-6" to="/" onClick={collapseMobileNavbar}>Trang chủ</Link>
                        </li>
                        <li className="nav-item dropdown jf-nav-dropdown">
                            <button
                                type="button"
                                className="nav-link d-flex align-items-center gap-1 fw-semibold fs-6 jf-nav-dropdown-toggle"
                                onClick={() => setShowMobileJobsMenu((prev) => !prev)}
                                aria-expanded={showMobileJobsMenu}
                                aria-label="Mở menu việc làm"
                            >
                                Việc làm <i className="bi bi-chevron-down small jf-nav-chevron"></i>
                            </button>
                            <ul className={`dropdown-menu jf-nav-dropdown-menu p-0 ${showMobileJobsMenu ? 'is-open' : ''}`} style={{ minWidth: 280, borderRadius: 12 }}>
                                <li className="px-3 pt-3 pb-2 text-uppercase text-secondary" style={{ fontSize: 12, letterSpacing: 1 }}>
                                    Việc làm
                                </li>
                                <li className="px-2 pb-2">
                                    <Link className="dropdown-item d-flex align-items-center gap-3 rounded p-2" to="/jobs" onClick={collapseMobileNavbar}>
                                        <i className="bi bi-search fs-5 text-primary"></i>
                                        <span className="fw-semibold">Tìm việc làm</span>
                                    </Link>
                                </li>
                                <li className="px-2 pb-2">
                                    <Link className="dropdown-item d-flex align-items-center gap-3 rounded p-2" to="/jobs/saved" onClick={collapseMobileNavbar}>
                                        <i className="bi bi-bookmark fs-5 text-primary"></i>
                                        <span className="fw-semibold">Việc làm đã lưu</span>
                                    </Link>
                                </li>
                                <li className="px-2 pb-2">
                                    <Link className="dropdown-item d-flex align-items-center gap-3 rounded p-2" to="/jobs/applied" onClick={collapseMobileNavbar}>
                                        <i className="bi bi-file-earmark-check fs-5 text-primary"></i>
                                        <span className="fw-semibold">Việc làm đã ứng tuyển</span>
                                    </Link>
                                </li>
                                <li className="px-2 pb-3">
                                    <Link className="dropdown-item d-flex align-items-center gap-3 rounded p-2" to="/jobs/matching" onClick={collapseMobileNavbar}>
                                        <i className="bi bi-hand-thumbs-up fs-5 text-primary"></i>
                                        <span className="fw-semibold">Việc làm phù hợp</span>
                                    </Link>
                                </li>
                            </ul>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link fw-semibold fs-6" to="/career-guide" onClick={collapseMobileNavbar}>
                                Cẩm nang nghề nghiệp
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link fw-semibold fs-6" to="/create-cv/templates" onClick={collapseMobileNavbar}>
                                Mẫu CV
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link fw-semibold fs-6" to="/cv-management" onClick={collapseMobileNavbar}>
                                Quản lý CV
                            </Link>
                        </li>
                    </ul>
                    <div className="d-flex align-items-center gap-3 ms-lg-auto me-lg-2">
                        {!user ? (
                            <>
                                <Link className="btn btn-outline-primary fw-semibold fs-6 px-4 py-1" to="/login" onClick={collapseMobileNavbar}>
                                    Đăng nhập
                                </Link>
                                <Link className="btn btn-primary fw-semibold fs-6 px-4 py-1" to="/register" onClick={collapseMobileNavbar}>
                                    Đăng ký
                                </Link>
                            </>
                        ) : (
                            <div className="dropdown">
                                <button
                                    className="jf-user-chip"
                                    type="button"
                                    id="dropdownUser"
                                    data-bs-toggle="dropdown"
                                    aria-expanded="false"
                                >
                                    <span className={`jf-user-chip-icon ${avatarUrl ? 'has-avatar' : ''}`} aria-hidden="true">
                                        {avatarUrl ? (
                                            <img
                                                src={avatarUrl}
                                                alt={profileTitle}
                                                className="jf-user-chip-avatar"
                                                onError={(event) => {
                                                    event.currentTarget.onerror = null;
                                                    event.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
                                                }}
                                            />
                                        ) : (
                                            <i className={`bi ${profileIcon}`}></i>
                                        )}
                                    </span>
                                    <span className="jf-user-chip-info">
                                        <strong>{profileTitle}</strong>
                                        <small>{roleLabel}</small>
                                    </span>
                                    <i className="bi bi-chevron-down jf-user-chip-chevron" aria-hidden="true"></i>
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end jf-user-dropdown-menu" aria-labelledby="dropdownUser">
                                    {/* Menu items */}
                                    <li className="jf-user-dropdown-row">
                                        <Link className="dropdown-item jf-user-dropdown-item" to={profileLink} onClick={collapseMobileNavbar}>
                                            <i className="bi bi-file-earmark-person text-primary"></i>
                                            <span>Hồ sơ của tôi</span>
                                        </Link>
                                    </li>
                                    {dashboardLink && (
                                        <li className="jf-user-dropdown-row">
                                            <Link className="dropdown-item jf-user-dropdown-item" to={dashboardLink} onClick={collapseMobileNavbar}>
                                                <i className="bi bi-speedometer2 text-primary"></i>
                                                <span>Dashboard</span>
                                            </Link>
                                        </li>
                                    )}
                                    {messagingLink && (
                                        <li className="jf-user-dropdown-row">
                                            <Link className="dropdown-item jf-user-dropdown-item" to={messagingLink} onClick={collapseMobileNavbar}>
                                                <i className="bi bi-chat-dots text-primary"></i>
                                                <span>Tin nhắn</span>
                                            </Link>
                                        </li>
                                    )}
                                    {!isAdmin && (isEmployer ? (
                                        <li className="jf-user-dropdown-row">
                                            <Link className="dropdown-item jf-user-dropdown-item" to="/employer/jobs" onClick={collapseMobileNavbar}>
                                                <i className="bi bi-briefcase text-primary"></i>
                                                <span>Quản lý tin tuyển dụng</span>
                                            </Link>
                                        </li>
                                    ) : (
                                        <li className="jf-user-dropdown-row">
                                            <div className="dropdown-item jf-user-dropdown-item jf-user-dropdown-toggle"
                                                onClick={e => { e.stopPropagation(); setShowJobManagement(!showJobManagement); }}>
                                                <div className="d-flex align-items-center gap-2">
                                                    <i className="bi bi-briefcase text-primary"></i>
                                                    <span>Quản lý việc làm</span>
                                                </div>
                                                <i className={`bi bi-chevron-${showJobManagement ? 'up' : 'down'}`}></i>
                                            </div>
                                            {showJobManagement && (
                                                <ul className="list-unstyled jf-user-submenu-list">
                                                    <li>
                                                        <Link className="jf-user-submenu-link" to="/jobs/applied" onClick={collapseMobileNavbar}>
                                                            <i className="bi bi-file-earmark-check text-primary"></i>
                                                            <span>Việc làm đã ứng tuyển</span>
                                                        </Link>
                                                    </li>
                                                    <li>
                                                        <Link className="jf-user-submenu-link" to="/jobs/saved" onClick={collapseMobileNavbar}>
                                                            <i className="bi bi-bookmark text-primary"></i>
                                                            <span>Việc làm đã lưu</span>
                                                        </Link>
                                                    </li>
                                                </ul>
                                            )}
                                        </li>
                                    ))}
                                    <li className="jf-user-dropdown-row">
                                        <Link className="dropdown-item jf-user-dropdown-item" to="/support" onClick={collapseMobileNavbar}>
                                            <i className="bi bi-bell text-primary"></i>
                                            <span>Hỗ trợ và thông báo</span>
                                        </Link>
                                    </li>
                                    <li><hr className="dropdown-divider" /></li>
                                    <li className="jf-user-dropdown-row jf-user-dropdown-row-last">
                                        <button className="btn btn-link text-decoration-none jf-user-logout-btn"
                                                onClick={() => {
                                                    const confirmed = window.confirm('Bạn có chắc chắn muốn đăng xuất?');
                                                    if (!confirmed) return;
                                                    localStorage.removeItem('user');
                                                    localStorage.removeItem('token');
                                                    window.location.reload();
                                                }}>
                                            Đăng xuất
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Header;