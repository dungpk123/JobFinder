import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const Header = ({ onLoginClick = () => {}, onRegisterClick = () => {}, onEmployerRegisterClick = () => {} }) => {
    const [showJobManagement, setShowJobManagement] = useState(false);
    
    // Kiểm tra trạng thái đăng nhập
    const user = (() => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch {
            return null;
        }
    })();

    return (
        <nav className="navbar navbar-expand-lg bg-white border-bottom shadow-sm"
            style={{
                paddingTop: 0,
                paddingBottom: 0,
                minHeight: '64px',
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                zIndex: 1050
            }}>
            <div className="container-fluid px-4">
                <Link className="navbar-brand d-flex align-items-center gap-3 text-decoration-none" to="/">
                    <img src="/images/logo.png" alt="JobFinder Logo" style={{ height: '56px' }} />
                </Link>
                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar" aria-controls="mainNavbar" aria-expanded="false" aria-label="Toggle navigation">
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse justify-content-between" id="mainNavbar">
                    <ul className="navbar-nav align-items-lg-center gap-lg-4 mb-3 mb-lg-0">
                        <li className="nav-item">
                            <Link className="nav-link fw-semibold fs-6" to="/">Trang chủ</Link>
                        </li>
                        <li className="nav-item dropdown jf-nav-dropdown">
                            <span className="nav-link d-flex align-items-center gap-1 fw-semibold fs-6 jf-nav-dropdown-toggle">
                                Việc làm <i className="bi bi-chevron-down small jf-nav-chevron"></i>
                            </span>
                            <ul className="dropdown-menu jf-nav-dropdown-menu p-0" style={{ minWidth: 280, borderRadius: 12 }}>
                                <li className="px-3 pt-3 pb-2 text-uppercase text-secondary" style={{ fontSize: 12, letterSpacing: 1 }}>
                                    Việc làm
                                </li>
                                <li className="px-2 pb-2">
                                    <Link className="dropdown-item d-flex align-items-center gap-3 rounded p-2" to="/jobs">
                                        <i className="bi bi-search fs-5 text-primary"></i>
                                        <span className="fw-semibold">Tìm việc làm</span>
                                    </Link>
                                </li>
                                <li className="px-2 pb-2">
                                    <Link className="dropdown-item d-flex align-items-center gap-3 rounded p-2" to="/jobs/saved">
                                        <i className="bi bi-bookmark fs-5 text-primary"></i>
                                        <span className="fw-semibold">Việc làm đã lưu</span>
                                    </Link>
                                </li>
                                <li className="px-2 pb-2">
                                    <Link className="dropdown-item d-flex align-items-center gap-3 rounded p-2" to="/jobs/applied">
                                        <i className="bi bi-file-earmark-check fs-5 text-primary"></i>
                                        <span className="fw-semibold">Việc làm đã ứng tuyển</span>
                                    </Link>
                                </li>
                                <li className="px-2 pb-3">
                                    <Link className="dropdown-item d-flex align-items-center gap-3 rounded p-2" to="/jobs/matching">
                                        <i className="bi bi-hand-thumbs-up fs-5 text-primary"></i>
                                        <span className="fw-semibold">Việc làm phù hợp</span>
                                    </Link>
                                </li>
                            </ul>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link d-flex align-items-center gap-1 fw-semibold fs-6" to="/create-cv">
                                Tạo CV
                            </Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link fw-semibold fs-6" to="/career-guide">
                                Cẩm nang nghề nghiệp
                            </Link>
                        </li>
                    </ul>
                    <div className="d-flex align-items-center gap-3 ms-lg-auto me-lg-2">
                        {!user ? (
                            <>
                                <button type="button" className="btn btn-outline-primary fw-semibold fs-6 px-4 py-1" onClick={onLoginClick}>
                                    Đăng nhập
                                </button>
                                <button type="button" className="btn btn-primary fw-semibold fs-6 px-4 py-1" onClick={onRegisterClick}>
                                    Đăng ký
                                </button>
                                <button type="button" className="btn btn-warning fw-semibold fs-6 px-4 py-1 text-dark" onClick={onEmployerRegisterClick}>
                                    Dành cho nhà tuyển dụng
                                </button>
                            </>
                        ) : (
                            <div className="dropdown">
                                <button className="btn btn-light border-0 p-0 d-flex align-items-center gap-2" type="button" id="dropdownUser" data-bs-toggle="dropdown" aria-expanded="false">
                                    <img
                                        src={user.avatar || user.AnhDaiDien || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                                        alt="avatar"
                                        className="rounded-circle"
                                        style={{ width: 36, height: 36, objectFit: 'cover' }}
                                        onError={e => {
                                            console.warn('Avatar load error:', user.avatar, user.AnhDaiDien);
                                            e.target.onerror = null;
                                            e.target.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                                        }}
                                    />
                                    <span className="fw-semibold text-dark">{user.username || user.email || 'Người dùng'}</span>
                                    <i className="bi bi-chevron-down small text-secondary"></i>
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end p-0" aria-labelledby="dropdownUser" style={{ minWidth: 280, borderRadius: 12 }}>
                                    {/* Menu items */}
                                    <li className="px-3 pt-3 pb-2">
                                        <Link className="dropdown-item d-flex align-items-center gap-2 rounded p-2" to="/profile" style={{transition: 'background .2s'}}>
                                            <i className="bi bi-file-earmark-person fs-5 text-primary"></i>
                                            <span>Hồ sơ của tôi</span>
                                        </Link>
                                    </li>
                                    <li className="px-3 pb-2">
                                        <Link className="dropdown-item d-flex align-items-center gap-2 rounded p-2" to="/create-cv" style={{transition: 'background .2s'}}>
                                            <i className="bi bi-file-earmark-text fs-5 text-primary"></i>
                                            <span>Tạo CV</span>
                                        </Link>
                                    </li>
                                    <li className="px-3 pb-2">
                                        <div className="dropdown-item d-flex align-items-center justify-content-between rounded p-2" 
                                            style={{cursor: 'pointer', transition: 'background .2s'}}
                                            onClick={e => { e.stopPropagation(); setShowJobManagement(!showJobManagement); }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <i className="bi bi-briefcase fs-5 text-primary"></i>
                                                <span>Quản lý việc làm</span>
                                            </div>
                                            <i className={`bi bi-chevron-${showJobManagement ? 'up' : 'down'}`}></i>
                                        </div>
                                        {showJobManagement && (
                                            <ul className="list-unstyled ms-4 mt-2">
                                                <li className="mb-2">
                                                    <Link className="text-decoration-none text-dark d-flex align-items-center gap-2 py-1" to="/jobs/applied">
                                                        <i className="bi bi-file-earmark-check text-primary"></i>
                                                        <span>Việc làm đã ứng tuyển</span>
                                                    </Link>
                                                </li>
                                                <li className="mb-2">
                                                    <Link className="text-decoration-none text-dark d-flex align-items-center gap-2 py-1" to="/jobs/saved">
                                                        <i className="bi bi-bookmark text-primary"></i>
                                                        <span>Việc làm đã lưu</span>
                                                    </Link>
                                                </li>
                                            </ul>
                                        )}
                                    </li>
                                    <li className="px-3 pb-2">
                                        <Link className="dropdown-item d-flex align-items-center gap-2 rounded p-2" to="/support" style={{transition: 'background .2s'}}>
                                            <i className="bi bi-bell fs-5 text-primary"></i>
                                            <span>Hỗ trợ và thông báo</span>
                                        </Link>
                                    </li>
                                    <li className="px-3 pb-2">
                                        <Link className="dropdown-item d-flex align-items-center gap-2 rounded p-2" to="/account" style={{transition: 'background .2s'}}>
                                            <i className="bi bi-person-circle fs-5 text-primary"></i>
                                            <span>Quản lý tài khoản</span>
                                        </Link>
                                    </li>
                                    <li><hr className="dropdown-divider my-2" /></li>
                                    <li className="px-3 pb-3">
                                        <button className="btn btn-link text-decoration-none text-primary w-100 text-center p-2" 
                                                onClick={() => { localStorage.removeItem('user'); localStorage.removeItem('token'); window.location.reload(); }}>
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