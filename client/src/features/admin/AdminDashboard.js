import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
    BarChart3,
    BriefcaseBusiness,
    Building2,
    Bell,
    CircleHelp,
    ChevronDown,
    ClipboardList,
    FileStack,
    House,
    LayoutDashboard,
    LogOut,
    Menu,
    ShieldCheck,
    Users,
    X
} from 'lucide-react';
import { API_BASE as CLIENT_API_BASE } from '../../config/apiBase';
import AdminCompaniesPage from './pages/AdminCompaniesPage';
import AdminJobsPage from './pages/AdminJobsPage';
import AdminOverviewPage from './pages/AdminOverviewPage';
import AdminNotificationsPage from './pages/AdminNotificationsPage';
import AdminProfilePage from './pages/AdminProfilePage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminTemplatesPage from './pages/AdminTemplatesPage';
import AdminUsersPage from './pages/AdminUsersPage';
import './AdminDashboard.css';

const safeNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const parseDateSafe = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const formatRelativeTime = (value) => {
    const date = value instanceof Date ? value : parseDateSafe(value);
    if (!date) return 'Chưa có thời gian';

    const diffInMs = Date.now() - date.getTime();
    if (diffInMs < 60 * 1000) return 'Vừa xong';

    const minutes = Math.floor(diffInMs / (60 * 1000));
    if (minutes < 60) return `${minutes} phút trước`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngày trước`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} tháng trước`;

    const years = Math.floor(months / 12);
    return `${years} năm trước`;
};

const getTemplateName = (template, index = 0) => {
    const name = template?.TenTemplate
        || template?.TemplateName
        || template?.name
        || template?.Slug
        || template?.slug;
    return String(name || `Template ${index + 1}`);
};

const getTemplateUsage = (template) => safeNumber(
    template?.SoLuotSuDung
    ?? template?.LuotSuDung
    ?? template?.TongLuotSuDung
    ?? template?.UsageCount
    ?? template?.useCount
    ?? template?.usedCount
    ?? template?.so_luot_su_dung
    ?? 0
);

const getTemplateCreatedAt = (template) => parseDateSafe(
    template?.NgayTao
    || template?.NgayCapNhat
    || template?.createdAt
    || template?.updatedAt
    || template?.ngay_tao
    || template?.created_at
);

const menuItems = [
    { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', to: '/admin/dashboard' },
    { key: 'users', icon: Users, label: 'Quản lý người dùng', to: '/admin/usersmanament' },
    { key: 'jobs', icon: BriefcaseBusiness, label: 'Quản lý tin tuyển dụng', to: '/admin/jobs' },
    { key: 'companies', icon: Building2, label: 'Quản lý công ty', to: '/admin/companies' },
    {
        key: 'templates',
        icon: FileStack,
        label: 'Quản lý template CV',
        children: [
            { key: 'templates-all', label: 'Tất cả template', to: '/admin/templates', exact: true },
            { key: 'templates-create', label: 'Tạo template mới', to: '/admin/templates/create' }
        ]
    },
    { key: 'reports', icon: ClipboardList, label: 'Báo cáo', to: '/admin/reports' }
];

const SIDEBAR_LOGO_URL = 'https://i.postimg.cc/nhWfcVvh/logo.png';

const resolvePageTitle = (pathname) => {
    if (pathname.startsWith('/admin/profile')) return 'Hồ sơ';
    if (pathname.startsWith('/admin/notifications')) return 'Thông báo';
    if (pathname.startsWith('/admin/usersmanament')) return 'Quản lý người dùng';
    if (pathname.startsWith('/admin/jobs')) return 'Quản lý tin tuyển dụng';
    if (pathname.startsWith('/admin/companies')) return 'Quản lý công ty';
    if (pathname.startsWith('/admin/templates')) return 'Quản lý template CV';
    if (pathname.startsWith('/admin/reports')) return 'Báo cáo';
    return 'Dashboard';
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const API_BASE = CLIENT_API_BASE;
    const token = String(localStorage.getItem('token') || '').trim();

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}');
        } catch {
            return {};
        }
    }, []);

    const isSuperAdmin = !!user?.isSuperAdmin;
    const isAdmin = isSuperAdmin || user?.role === 'Quản trị';

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth <= 1280;
    });
    const [openMenus, setOpenMenus] = useState(() => ({
        templates: location.pathname.startsWith('/admin/templates')
    }));
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);

    const [counts, setCounts] = useState({});
    const [users, setUsers] = useState([]);
    const [roleFilter, setRoleFilter] = useState('all');
    const [jobs, setJobs] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [reports, setReports] = useState([]);
    const [templates, setTemplates] = useState([]);

    const confirmResolveRef = useRef(null);
    const profileMenuRef = useRef(null);
    const [confirmState, setConfirmState] = useState({
        open: false,
        title: 'Xác nhận',
        message: '',
        confirmText: 'OK',
        cancelText: 'Hủy'
    });

    const requestConfirm = (opts = {}) => {
        return new Promise((resolve) => {
            confirmResolveRef.current = resolve;
            setConfirmState({
                open: true,
                title: opts.title || 'Xác nhận',
                message: opts.message || '',
                confirmText: opts.confirmText || 'OK',
                cancelText: opts.cancelText || 'Hủy'
            });
        });
    };

    const closeConfirm = (result) => {
        const resolve = confirmResolveRef.current;
        confirmResolveRef.current = null;
        setConfirmState((prev) => ({ ...prev, open: false }));
        if (typeof resolve === 'function') resolve(result);
    };

    const authHeaders = useMemo(() => {
        const base = {
            'Content-Type': 'application/json'
        };
        if (token) {
            base.Authorization = `Bearer ${token}`;
        }
        return base;
    }, [token]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const loadAll = async () => {
        setLoading(true);
        setError('');
        try {
            const [ov, us, js, cs, rs, ts] = await Promise.all([
                fetch(`${API_BASE}/api/admin/overview`, { headers: authHeaders }),
                fetch(`${API_BASE}/api/admin/users?limit=50`, { headers: authHeaders }),
                fetch(`${API_BASE}/api/admin/jobs?limit=50`, { headers: authHeaders }),
                fetch(`${API_BASE}/api/admin/companies?limit=50`, { headers: authHeaders }),
                fetch(`${API_BASE}/api/admin/reports?limit=50`, { headers: authHeaders }),
                fetch(`${API_BASE}/api/admin/templates?limit=50&offset=0`, { headers: authHeaders })
            ]);

            const ovData = await ov.json().catch(() => null);
            const usData = await us.json().catch(() => null);
            const jsData = await js.json().catch(() => null);
            const csData = await cs.json().catch(() => null);
            const rsData = await rs.json().catch(() => null);
            const tsData = await ts.json().catch(() => null);

            if (!ov.ok) throw new Error(ovData?.error || 'Không tải được thống kê');
            if (!us.ok) throw new Error(usData?.error || 'Không tải được người dùng');
            if (!js.ok) throw new Error(jsData?.error || 'Không tải được tin tuyển dụng');
            if (!cs.ok) throw new Error(csData?.error || 'Không tải được công ty');
            if (!rs.ok) throw new Error(rsData?.error || 'Không tải được báo cáo');

            setCounts(ovData?.counts || {});
            setUsers(Array.isArray(usData?.users) ? usData.users : []);
            setJobs(Array.isArray(jsData?.jobs) ? jsData.jobs : []);
            setCompanies(Array.isArray(csData?.companies) ? csData.companies : []);
            setReports(Array.isArray(rsData?.reports) ? rsData.reports : []);

            const templateRows = Array.isArray(tsData?.templates)
                ? tsData.templates
                : Array.isArray(tsData?.data)
                    ? tsData.data
                    : [];
            setTemplates(templateRows);
        } catch (err) {
            setError(err?.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [API_BASE, token]);

    useEffect(() => {
        const onResize = () => {
            if (typeof window === 'undefined') return;
            if (window.innerWidth < 992) {
                setSidebarCollapsed(false);
            } else {
                setMobileMenuOpen(false);
            }
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 992) {
            setMobileMenuOpen(false);
        }
        setProfileMenuOpen(false);

        if (location.pathname.startsWith('/admin/templates')) {
            setOpenMenus((prev) => ({ ...prev, templates: true }));
        }
    }, [location.pathname]);

    useEffect(() => {
        const handleDocumentClick = (event) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setProfileMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleDocumentClick);
        return () => document.removeEventListener('mousedown', handleDocumentClick);
    }, []);

    const patchUser = async (id, payload) => {
        const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Không cập nhật được người dùng');
        return data?.user;
    };

    const fetchUserDetail = async (id) => {
        const res = await fetch(`${API_BASE}/api/admin/users/${id}/detail`, {
            headers: authHeaders
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Không tải được chi tiết người dùng');
        return data?.detail || null;
    };

    const patchReport = async (id, payload) => {
        const res = await fetch(`${API_BASE}/api/admin/reports/${id}`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Không cập nhật được báo cáo');
        return data?.report;
    };

    const deleteJob = async (id) => {
        const res = await fetch(`${API_BASE}/api/admin/jobs/${id}`, {
            method: 'DELETE',
            headers: authHeaders
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Không xóa được tin tuyển dụng');
    };

    const deleteUser = async (id) => {
        const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
            method: 'DELETE',
            headers: authHeaders
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Không xóa được người dùng');
        return data?.user;
    };

    const restoreUser = async (id) => {
        const res = await fetch(`${API_BASE}/api/admin/users/${id}/restore`, {
            method: 'POST',
            headers: authHeaders
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Không khôi phục được người dùng');
        return data?.user;
    };

    const patchCompany = async (id, payload) => {
        const res = await fetch(`${API_BASE}/api/admin/companies/${id}`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Không cập nhật được công ty');
        return data?.company;
    };

    const deleteCompany = async (id) => {
        const res = await fetch(`${API_BASE}/api/admin/companies/${id}`, {
            method: 'DELETE',
            headers: authHeaders
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Không xóa được công ty');
    };

    const saveUserById = async (userId, payload) => {
        const updated = await patchUser(userId, payload);
        setUsers((prev) => prev.map((item) => (item.MaNguoiDung === userId ? updated : item)));
    };

    const deleteUserById = async (userId) => {
        const updated = await deleteUser(userId);
        setUsers((prev) => prev.map((item) => (item.MaNguoiDung === userId ? updated : item)));
    };

    const restoreUserById = async (userId) => {
        const updated = await restoreUser(userId);
        setUsers((prev) => prev.map((item) => (item.MaNguoiDung === userId ? updated : item)));
    };

    const deleteJobById = async (jobId) => {
        await deleteJob(jobId);
        setJobs((prev) => prev.filter((item) => item.MaTin !== jobId));
    };

    const saveCompanyStatusById = async (companyId, status) => {
        const updated = await patchCompany(companyId, { status });
        setCompanies((prev) => prev.map((item) => (item.MaCongTy === companyId ? updated : item)));
    };

    const deleteCompanyById = async (companyId) => {
        await deleteCompany(companyId);
        setCompanies((prev) => prev.filter((item) => item.MaCongTy !== companyId));
    };

    const saveReportById = async (reportId, payload) => {
        const updated = await patchReport(reportId, payload);
        setReports((prev) => prev.map((item) => (item.MaBaoCao === reportId ? { ...item, ...updated } : item)));
    };

    const greetingName = user?.name || user?.full_name || user?.email || 'Admin';
    const roleLabel = isSuperAdmin ? 'Siêu quản trị viên' : (user?.role || 'Quản trị');

    const totalTemplateCount = Math.max(safeNumber(counts?.CvTemplate), templates.length);
    const usedTemplateCount = templates.filter((template) => getTemplateUsage(template) > 0).length;

    const statsCards = [
        {
            key: 'total-templates',
            title: 'Tổng template CV',
            value: totalTemplateCount,
            meta: `${totalTemplateCount > 0 ? '+12%' : '0%'} so với tháng trước`,
            icon: FileStack,
            iconClass: 'sky'
        },
        {
            key: 'used-templates',
            title: 'Template đã sử dụng',
            value: usedTemplateCount,
            meta: `${usedTemplateCount} template có lượt dùng`,
            icon: BarChart3,
            iconClass: 'violet'
        },
        {
            key: 'users',
            title: 'Người dùng',
            value: safeNumber(counts?.NguoiDung),
            meta: `${safeNumber(counts?.NguoiDung) > 0 ? '+6%' : '0%'} so với tháng trước`,
            icon: Users,
            iconClass: 'blue'
        },
        {
            key: 'companies',
            title: 'Công ty',
            value: safeNumber(counts?.CongTy),
            meta: `${safeNumber(counts?.CongTy) > 0 ? '+4%' : '0%'} so với tháng trước`,
            icon: Building2,
            iconClass: 'indigo'
        }
    ];

    const recentTemplateActivities = useMemo(() => {
        const rows = templates
            .map((template, index) => {
                const createdAt = getTemplateCreatedAt(template);
                return {
                    id: template?.MaTemplateCV || template?.id || `${getTemplateName(template, index)}-${index}`,
                    name: getTemplateName(template, index),
                    createdAt,
                    usage: getTemplateUsage(template),
                    relativeTime: formatRelativeTime(createdAt),
                    exactTime: createdAt ? createdAt.toLocaleString('vi-VN') : 'Chưa có dữ liệu ngày tạo'
                };
            })
            .sort((a, b) => {
                const aTime = a.createdAt ? a.createdAt.getTime() : 0;
                const bTime = b.createdAt ? b.createdAt.getTime() : 0;
                return bTime - aTime;
            });

        return rows.slice(0, 6);
    }, [templates]);

    const popularTemplates = useMemo(() => {
        const rows = templates
            .map((template, index) => ({
                id: template?.MaTemplateCV || template?.id || `${getTemplateName(template, index)}-${index}`,
                name: getTemplateName(template, index),
                usage: getTemplateUsage(template)
            }))
            .sort((a, b) => b.usage - a.usage)
            .slice(0, 5);

        const maxUsage = rows.reduce((max, row) => Math.max(max, row.usage), 0);
        return rows.map((row) => ({
            ...row,
            progress: maxUsage > 0 ? Math.round((row.usage / maxUsage) * 100) : 0
        }));
    }, [templates]);

    const handleSidebarToggle = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 992) {
            setMobileMenuOpen((prev) => !prev);
            return;
        }
        setSidebarCollapsed((prev) => !prev);
    };

    const handleSidebarItemClick = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 992) {
            setMobileMenuOpen(false);
        }
    };

    const handleProfileMenuNavigate = (path) => {
        setProfileMenuOpen(false);
        navigate(path);
    };

    const isPathActive = (path, exact = false) => {
        if (exact) return location.pathname === path;
        return location.pathname === path || location.pathname.startsWith(`${path}/`);
    };

    if (!token) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="admin-layout">
            <button
                type="button"
                className={`admin-mobile-overlay ${mobileMenuOpen ? 'show' : ''}`}
                aria-label="Đóng menu"
                onClick={() => setMobileMenuOpen(false)}
            />

            <div className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="admin-sidebar-brand" title="JobFinder">
                    <img src={SIDEBAR_LOGO_URL} alt="JobFinder" className="admin-sidebar-logo" />
                    {!sidebarCollapsed && <span>JobFinder</span>}
                </div>

                <div className="admin-menu">
                    {menuItems.map((item) => {
                        const Icon = item.icon;

                        if (Array.isArray(item.children) && item.children.length > 0) {
                            const isGroupActive = item.children.some((child) => isPathActive(child.to, child.exact));
                            const isOpen = !sidebarCollapsed && (openMenus[item.key] || isGroupActive);

                            return (
                                <div key={item.key} className={`admin-menu-group ${isGroupActive ? 'active' : ''}`}>
                                    <button
                                        type="button"
                                        className={`admin-menu-item admin-menu-parent ${isGroupActive ? 'active' : ''}`}
                                        onClick={() => {
                                            if (sidebarCollapsed) {
                                                navigate(item.children[0].to);
                                                handleSidebarItemClick();
                                                return;
                                            }
                                            setOpenMenus((prev) => ({
                                                ...prev,
                                                [item.key]: !prev[item.key]
                                            }));
                                        }}
                                        title={item.label}
                                    >
                                        <Icon size={18} strokeWidth={2.1} />
                                        {!sidebarCollapsed && <span>{item.label}</span>}
                                        {!sidebarCollapsed && (
                                            <ChevronDown
                                                size={16}
                                                className={`admin-menu-caret ${isOpen ? 'open' : ''}`}
                                            />
                                        )}
                                    </button>

                                    {!sidebarCollapsed && isOpen && (
                                        <div className="admin-submenu">
                                            {item.children.map((child) => (
                                                <NavLink
                                                    key={child.key}
                                                    to={child.to}
                                                    end={Boolean(child.exact)}
                                                    className={({ isActive }) => `admin-submenu-item ${isActive ? 'active' : ''}`}
                                                    onClick={handleSidebarItemClick}
                                                >
                                                    {child.label}
                                                </NavLink>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <NavLink
                                key={item.key}
                                to={item.to}
                                className={({ isActive }) => `admin-menu-item ${isActive ? 'active' : ''}`}
                                onClick={handleSidebarItemClick}
                                title={item.label}
                            >
                                <Icon size={18} strokeWidth={2.1} />
                                {!sidebarCollapsed && <span>{item.label}</span>}
                            </NavLink>
                        );
                    })}
                </div>
            </div>

            <div className={`admin-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <div className="admin-header">
                    <div className="admin-header-left">
                        <button
                            type="button"
                            className="admin-sidebar-toggle"
                            onClick={handleSidebarToggle}
                            aria-label="Bật hoặc tắt sidebar"
                        >
                            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>
                        <h1 className="admin-header-page-title">{resolvePageTitle(location.pathname)}</h1>
                    </div>

                    <div className="admin-header-user">
                        <button
                            type="button"
                            className="admin-header-home-btn"
                            onClick={() => navigate('/')}
                        >
                            <House size={16} />
                            <span>Trang chủ</span>
                        </button>

                        <div className={`admin-header-user-menu ${profileMenuOpen ? 'open' : ''}`} ref={profileMenuRef}>
                            <button
                                type="button"
                                className="admin-header-user-trigger"
                                onClick={() => setProfileMenuOpen((prev) => !prev)}
                                aria-haspopup="menu"
                                aria-expanded={profileMenuOpen}
                            >
                                <div className="admin-header-avatar">
                                    <ShieldCheck size={15} />
                                </div>
                                <div className="admin-header-user-info">
                                    <strong>{greetingName}</strong>
                                    <small>{roleLabel}</small>
                                </div>
                                <ChevronDown size={16} className="admin-header-user-chevron" />
                            </button>

                            {profileMenuOpen && (
                                <div className="admin-header-dropdown" role="menu">
                                    <button type="button" className="admin-header-dropdown-item" onClick={() => handleProfileMenuNavigate('/support')}>
                                        <CircleHelp size={16} />
                                        <span>Hỗ trợ</span>
                                    </button>
                                    <button type="button" className="admin-header-dropdown-item" onClick={() => handleProfileMenuNavigate('/admin/notifications')}>
                                        <Bell size={16} />
                                        <span>Thông báo</span>
                                    </button>
                                    <button type="button" className="admin-header-dropdown-item" onClick={() => handleProfileMenuNavigate('/admin/profile')}>
                                        Hồ sơ
                                    </button>
                                    <button type="button" className="admin-header-dropdown-item" onClick={() => handleProfileMenuNavigate('/admin/dashboard')}>
                                        Dashboard
                                    </button>
                                    <button
                                        type="button"
                                        className="admin-header-dropdown-item danger"
                                        onClick={handleLogout}
                                    >
                                        <LogOut size={16} />
                                        <span>Đăng xuất</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="admin-content">
                    {error && <div className="alert alert-danger admin-feedback">{error}</div>}
                    {loading && <div className="alert alert-info admin-feedback">Đang tải dữ liệu...</div>}

                    <Routes>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route
                            path="dashboard"
                            element={
                                <AdminOverviewPage
                                    statsCards={statsCards}
                                    recentTemplateActivities={recentTemplateActivities}
                                    popularTemplates={popularTemplates}
                                />
                            }
                        />
                        <Route
                            path="usersmanament"
                            element={
                                <AdminUsersPage
                                    users={users}
                                    loading={loading}
                                    roleFilter={roleFilter}
                                    onRoleFilterChange={setRoleFilter}
                                    isSuperAdmin={isSuperAdmin}
                                    isAdmin={isAdmin}
                                    requestConfirm={requestConfirm}
                                    onSaveUser={saveUserById}
                                    onDeleteUser={deleteUserById}
                                    onRestoreUser={restoreUserById}
                                    onViewUserDetail={fetchUserDetail}
                                />
                            }
                        />
                        <Route
                            path="jobs"
                            element={
                                <AdminJobsPage
                                    jobs={jobs}
                                    loading={loading}
                                    canDelete={isSuperAdmin}
                                    requestConfirm={requestConfirm}
                                    onDeleteJob={deleteJobById}
                                />
                            }
                        />
                        <Route
                            path="companies"
                            element={
                                <AdminCompaniesPage
                                    companies={companies}
                                    loading={loading}
                                    canEdit={isSuperAdmin}
                                    requestConfirm={requestConfirm}
                                    onSaveCompanyStatus={saveCompanyStatusById}
                                    onDeleteCompany={deleteCompanyById}
                                />
                            }
                        />
                        <Route
                            path="templates"
                            element={
                                <AdminTemplatesPage
                                    API_BASE={API_BASE}
                                    authHeaders={authHeaders}
                                    requestConfirm={requestConfirm}
                                    mode="list"
                                />
                            }
                        />
                        <Route
                            path="templates/create"
                            element={
                                <AdminTemplatesPage
                                    API_BASE={API_BASE}
                                    authHeaders={authHeaders}
                                    requestConfirm={requestConfirm}
                                    mode="create"
                                />
                            }
                        />
                        <Route
                            path="reports"
                            element={
                                <AdminReportsPage
                                    reports={reports}
                                    loading={loading}
                                    onSaveReport={saveReportById}
                                />
                            }
                        />
                        <Route
                            path="profile"
                            element={
                                <AdminProfilePage
                                    user={user}
                                    roleLabel={roleLabel}
                                    greetingName={greetingName}
                                />
                            }
                        />
                        <Route path="*" element={<Navigate to="dashboard" replace />} />
                    </Routes>
                </div>
            </div>

            {confirmState.open && (
                <div className="admin-confirm-backdrop" role="dialog" aria-modal="true">
                    <div className="admin-confirm-dialog card border-0 shadow-sm">
                        <div className="card-body">
                        <Route path="notifications" element={<AdminNotificationsPage />} />
                            <h5 className="mb-3">{confirmState.title}</h5>
                            <div className="mb-4">{confirmState.message}</div>
                            <div className="d-flex justify-content-end gap-2">
                                <button type="button" className="btn btn-outline-secondary" onClick={() => closeConfirm(false)}>
                                    {confirmState.cancelText}
                                </button>
                                <button type="button" className="btn btn-danger" onClick={() => closeConfirm(true)}>
                                    {confirmState.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
