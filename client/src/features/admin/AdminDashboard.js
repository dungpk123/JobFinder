import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const navigate = useNavigate();

    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
    const token = localStorage.getItem('token');

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
        return window.innerWidth < 992;
    });
    const [active, setActive] = useState('overview');

    const [counts, setCounts] = useState({});
    const [users, setUsers] = useState([]);
    const [roleFilter, setRoleFilter] = useState('all');
    const [jobs, setJobs] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [reports, setReports] = useState([]);

    const confirmResolveRef = useRef(null);
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

    const authHeaders = useMemo(() => ({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
    }), [token]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const loadAll = async () => {
        setLoading(true);
        setError('');
        try {
            const [ov, us, js, cs, rs] = await Promise.all([
                fetch(`${API_BASE}/api/admin/overview`, { headers: authHeaders }),
                fetch(`${API_BASE}/api/admin/users?limit=50`, { headers: authHeaders }),
                fetch(`${API_BASE}/api/admin/jobs?limit=50`, { headers: authHeaders }),
                fetch(`${API_BASE}/api/admin/companies?limit=50`, { headers: authHeaders }),
                fetch(`${API_BASE}/api/admin/reports?limit=50`, { headers: authHeaders })
            ]);

            const ovData = await ov.json().catch(() => null);
            const usData = await us.json().catch(() => null);
            const jsData = await js.json().catch(() => null);
            const csData = await cs.json().catch(() => null);
            const rsData = await rs.json().catch(() => null);

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
        } catch (err) {
            setError(err?.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [API_BASE]);

    useEffect(() => {
        const onResize = () => {
            if (typeof window === 'undefined') return;
            setSidebarCollapsed(window.innerWidth < 992);
        };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
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

    const patchJob = async (id, payload) => {
        const res = await fetch(`${API_BASE}/api/admin/jobs/${id}`, {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Không cập nhật được tin tuyển dụng');
        return data?.job;
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

    const menuItems = [
        { key: 'overview', icon: 'bi-speedometer2', label: 'Bảng tin' },
        { key: 'users', icon: 'bi-people', label: 'Quản lý người dùng' },
        { key: 'jobs', icon: 'bi-briefcase', label: 'Tin tuyển dụng' },
        { key: 'companies', icon: 'bi-building', label: 'Công ty' },
        { key: 'reports', icon: 'bi-flag', label: 'Báo cáo' },
    ];

    const filteredUsers = users
        .filter((u) => Number(u.IsSuperAdmin) !== 1) // ẩn super admin
        .filter((u) => roleFilter === 'all' ? true : (u.VaiTro === roleFilter));

    return (
        <div className="admin-layout">
            <div className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="admin-sidebar-header">
                    <img src="/images/logo.png" alt="JobFinder" className="admin-sidebar-logo" />
                    {!sidebarCollapsed && <h5 className="mb-0">JobFinder</h5>}
                </div>

                <div className="admin-sidebar-user">
                    <div className="admin-user-avatar">
                        <i className="bi bi-person-circle fs-1"></i>
                    </div>
                    {!sidebarCollapsed && (
                        <div className="admin-user-info">
                            <h6 className="mb-0">{user?.name || 'Admin'}</h6>
                            <small className="text-muted">{isSuperAdmin ? 'Siêu quản trị viên' : (user?.role || 'Quản trị')}</small>
                        </div>
                    )}
                </div>

                <div className="admin-menu">
                    {menuItems.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            className={`admin-menu-item ${active === item.key ? 'active' : ''}`}
                            onClick={() => setActive(item.key)}
                            title={item.label}
                        >
                            <i className={`bi ${item.icon}`}></i>
                            {!sidebarCollapsed && <span>{item.label}</span>}
                        </button>
                    ))}
                </div>

                <div className="admin-sidebar-footer">
                    <button className="btn btn-link text-decoration-none w-100" onClick={handleLogout}>
                        <i className="bi bi-box-arrow-right"></i>
                        {!sidebarCollapsed && <span>Đăng xuất</span>}
                    </button>
                </div>
            </div>

            <div className="admin-main">
                <div className="admin-header">
                    <button
                        type="button"
                        className="btn btn-link admin-sidebar-toggle"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    >
                        <i className="bi bi-list fs-4"></i>
                    </button>
                </div>

                <div className="admin-content">
                    {error && <div className="alert alert-danger">{error}</div>}
                    {loading && <div className="alert alert-info">Đang tải dữ liệu…</div>}

                    {active === 'overview' && (
                        <>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <div>
                                    <h2 className="mb-0">Dashboard Quản Trị</h2>
                                    <div className="text-muted">Xin chào, {user?.name || user?.email || 'Quản trị viên'} • {user?.role || (isSuperAdmin ? 'Siêu quản trị viên' : 'Quản trị')}</div>
                                </div>
                            </div>

                            <div className="row g-4 mb-4">
                                <div className="col-md-3">
                                    <div className="card border-0 shadow-sm h-100">
                                        <div className="card-body text-center">
                                            <div className="text-primary mb-3"><i className="bi bi-people fs-1"></i></div>
                                            <h3 className="mb-1">{counts?.NguoiDung ?? 0}</h3>
                                            <p className="text-muted mb-2">Người dùng</p>
                                            <button className="btn btn-sm btn-outline-primary" onClick={() => setActive('users')}>Quản lý</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="card border-0 shadow-sm h-100">
                                        <div className="card-body text-center">
                                            <div className="text-success mb-3"><i className="bi bi-briefcase fs-1"></i></div>
                                            <h3 className="mb-1">{counts?.TinTuyenDung ?? 0}</h3>
                                            <p className="text-muted mb-2">Tin tuyển dụng</p>
                                            <button className="btn btn-sm btn-outline-success" onClick={() => setActive('jobs')}>Xem danh sách</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="card border-0 shadow-sm h-100">
                                        <div className="card-body text-center">
                                            <div className="text-info mb-3"><i className="bi bi-building fs-1"></i></div>
                                            <h3 className="mb-1">{counts?.CongTy ?? 0}</h3>
                                            <p className="text-muted mb-2">Công ty</p>
                                            <button className="btn btn-sm btn-outline-info" onClick={() => setActive('companies')}>Xem danh sách</button>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="card border-0 shadow-sm h-100">
                                        <div className="card-body text-center">
                                            <div className="text-warning mb-3"><i className="bi bi-flag fs-1"></i></div>
                                            <h3 className="mb-1">{counts?.BaoCao ?? 0}</h3>
                                            <p className="text-muted mb-2">Báo cáo</p>
                                            <button className="btn btn-sm btn-outline-warning" onClick={() => setActive('reports')}>Xử lý</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {active === 'users' && (
                        <div className="card border-0 shadow-sm mb-4">
                            <div className="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center flex-wrap gap-3">
                                <h5 className="mb-0"><i className="bi bi-people me-2"></i>Quản lý người dùng</h5>
                                <div className="d-flex align-items-center gap-2">
                                    <i className="bi bi-funnel text-muted"></i>
                                    <select
                                        className="form-select form-select-sm"
                                        style={{ minWidth: 170 }}
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                        aria-label="Lọc vai trò"
                                    >
                                        <option value="all">Tất cả</option>
                                        <option value="Ứng viên">Ứng viên</option>
                                        <option value="Nhà tuyển dụng">Nhà tuyển dụng</option>
                                        <option value="Quản trị">Quản trị</option>
                                    </select>
                                </div>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 80 }}>ID</th>
                                            <th>Email</th>
                                            <th>Họ tên</th>
                                            <th style={{ width: 180 }}>Vai trò</th>
                                            <th style={{ width: 160 }}>Trạng thái</th>
                                            <th style={{ width: 220 }}>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map((u) => (
                                            <AdminUserRow
                                                key={u.MaNguoiDung}
                                                user={u}
                                                isSuperAdmin={isSuperAdmin}
                                                isAdmin={isAdmin}
                                                requestConfirm={requestConfirm}
                                                onSave={async (payload) => {
                                                    const updated = await patchUser(u.MaNguoiDung, payload);
                                                    setUsers((prev) => prev.map((x) => x.MaNguoiDung === u.MaNguoiDung ? updated : x));
                                                }}
                                                onDelete={async () => {
                                                    await deleteUser(u.MaNguoiDung);
                                                    setUsers((prev) => prev.filter((x) => x.MaNguoiDung !== u.MaNguoiDung));
                                                }}
                                            />
                                        ))}
                                        {filteredUsers.length === 0 && !loading && (
                                            <tr><td colSpan={6} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {active === 'jobs' && (
                        <div className="card border-0 shadow-sm mb-4">
                            <div className="card-header bg-white border-0 py-3">
                                <h5 className="mb-0"><i className="bi bi-briefcase me-2"></i>Quản lý tin tuyển dụng</h5>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 90 }}>Mã tin</th>
                                            <th>Tiêu đề</th>
                                            <th style={{ width: 200 }}>Công ty</th>
                                            <th style={{ width: 140 }}>Tỉnh/TP</th>
                                            <th style={{ width: 170 }}>Trạng thái</th>
                                            <th style={{ width: 180 }}>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {jobs.map((j) => (
                                            <AdminJobRow
                                                key={j.MaTin}
                                                job={j}
                                                requestConfirm={requestConfirm}
                                                onDelete={async () => {
                                                    await deleteJob(j.MaTin);
                                                    setJobs((prev) => prev.filter((x) => x.MaTin !== j.MaTin));
                                                }}
                                                canDelete={isSuperAdmin}
                                            />
                                        ))}
                                        {jobs.length === 0 && !loading && (
                                            <tr><td colSpan={6} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {active === 'companies' && (
                        <div className="card border-0 shadow-sm mb-4">
                            <div className="card-header bg-white border-0 py-3">
                                <h5 className="mb-0"><i className="bi bi-building me-2"></i>Danh sách công ty</h5>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 90 }}>Mã</th>
                                            <th>Tên công ty</th>
                                            <th style={{ width: 170 }}>Mã số thuế</th>
                                            <th style={{ width: 140 }}>Tỉnh/TP</th>
                                            <th style={{ width: 220 }}>Website</th>
                                            <th style={{ width: 150 }}>Trạng thái</th>
                                            <th style={{ width: 200 }}>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {companies.map((c) => (
                                            <AdminCompanyRow
                                                key={c.MaCongTy}
                                                company={c}
                                                canEdit={isSuperAdmin}
                                                requestConfirm={requestConfirm}
                                                onSaveStatus={async (status) => {
                                                    const updated = await patchCompany(c.MaCongTy, { status });
                                                    setCompanies((prev) => prev.map((x) => x.MaCongTy === c.MaCongTy ? updated : x));
                                                }}
                                                onDelete={async () => {
                                                    await deleteCompany(c.MaCongTy);
                                                    setCompanies((prev) => prev.filter((x) => x.MaCongTy !== c.MaCongTy));
                                                }}
                                            />
                                        ))}
                                        {companies.length === 0 && !loading && (
                                            <tr><td colSpan={7} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {active === 'reports' && (
                        <div className="card border-0 shadow-sm">
                            <div className="card-header bg-white border-0 py-3">
                                <h5 className="mb-0"><i className="bi bi-flag me-2"></i>Báo cáo</h5>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 90 }}>Mã</th>
                                            <th style={{ width: 220 }}>Người báo cáo</th>
                                            <th style={{ width: 170 }}>Đối tượng</th>
                                            <th>Lý do</th>
                                            <th style={{ width: 210 }}>Trạng thái</th>
                                            <th style={{ width: 120 }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reports.map((r) => (
                                            <AdminReportRow
                                                key={r.MaBaoCao}
                                                report={r}
                                                onSave={async (payload) => {
                                                    const updated = await patchReport(r.MaBaoCao, payload);
                                                    setReports((prev) => prev.map((x) => x.MaBaoCao === r.MaBaoCao ? { ...r, ...updated } : x));
                                                }}
                                            />
                                        ))}
                                        {reports.length === 0 && !loading && (
                                            <tr><td colSpan={6} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {confirmState.open && (
                <div className="admin-confirm-backdrop" role="dialog" aria-modal="true">
                    <div className="admin-confirm-dialog card border-0 shadow-sm">
                        <div className="card-body">
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

const AdminCompanyRow = ({ company, onSaveStatus, onDelete, canEdit, requestConfirm }) => {
    const initialStatus = Number(company.TrangThaiDaiDien ?? 1);
    const [status, setStatus] = useState(initialStatus);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        setStatus(initialStatus);
    }, [initialStatus]);

    const dirty = status !== initialStatus;

    const save = async (nextStatus = status) => {
        setSaving(true);
        setErr('');
        try {
            await onSaveStatus(nextStatus);
            setStatus(nextStatus);
        } catch (e) {
            setErr(e?.message || 'Lỗi');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!canEdit) return;
        const ok = await requestConfirm({
            title: 'Xác nhận xóa',
            message: 'Bạn có chắc muốn xóa công ty này?',
            confirmText: 'Xóa'
        });
        if (!ok) return;
        setSaving(true);
        setErr('');
        try {
            await onDelete();
        } catch (e) {
            setErr(e?.message || 'Lỗi');
        } finally {
            setSaving(false);
        }
    };

    return (
        <tr>
            <td>{company.MaCongTy}</td>
            <td className="fw-semibold">{company.TenCongTy}</td>
            <td>{company.MaSoThue || '-'}</td>
            <td>{company.ThanhPho || '-'}</td>
            <td>
                {company.Website ? (
                    <a href={company.Website} target="_blank" rel="noreferrer">{company.Website}</a>
                ) : '-'}
            </td>
            <td>
                {status === 1 ? (
                    <span className="badge bg-success-subtle text-success">Hoạt động</span>
                ) : (
                    <span className="badge bg-danger-subtle text-danger">Đã chặn</span>
                )}
            </td>
            <td>
                <div className="d-flex flex-wrap gap-2">
                    {status === 1 ? (
                        <button className="btn btn-sm btn-outline-warning" disabled={!canEdit || saving} onClick={() => save(0)}>
                            Chặn
                        </button>
                    ) : (
                        <button className="btn btn-sm btn-outline-success" disabled={!canEdit || saving} onClick={() => save(1)}>
                            Bỏ chặn
                        </button>
                    )}
                    <button className="btn btn-sm btn-outline-danger" disabled={!canEdit || saving} onClick={handleDelete}>
                        Xóa
                    </button>
                </div>
                {err ? <div className="text-danger small mt-1">{err}</div> : null}
            </td>
        </tr>
    );
};

const AdminUserRow = ({ user, onSave, onDelete, isSuperAdmin, isAdmin, requestConfirm }) => {
    const [role, setRole] = useState(user.VaiTro || 'Ứng viên');
    const [status, setStatus] = useState(Number(user.TrangThai ?? 1));
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const dirty = role !== (user.VaiTro || 'Ứng viên');
    const isTargetSuperAdmin = Number(user.IsSuperAdmin) === 1;
    const isTargetAdmin = user.VaiTro === 'Quản trị' || user.VaiTro === 'Siêu quản trị viên' || isTargetSuperAdmin;
    const canEdit = (isSuperAdmin || isAdmin) && !isTargetAdmin;
    const canDelete = !isTargetAdmin && (isSuperAdmin || isAdmin);

    const save = async (overrides = {}) => {
        setSaving(true);
        setErr('');
        try {
            const payload = {
                role: overrides.role ?? role,
                status: overrides.status ?? status
            };
            await onSave(payload);
            setRole(payload.role);
            setStatus(payload.status);
        } catch (e) {
            setErr(e?.message || 'Lỗi');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!canDelete) return;
        const ok = await requestConfirm({
            title: 'Xác nhận xóa',
            message: 'Bạn có chắc muốn xóa người dùng này?',
            confirmText: 'Xóa'
        });
        if (!ok) return;
        setSaving(true);
        setErr('');
        try {
            await onDelete();
        } catch (e) {
            setErr(e?.message || 'Lỗi');
        } finally {
            setSaving(false);
        }
    };

    return (
        <tr>
            <td>{user.MaNguoiDung}</td>
            <td>{user.Email}</td>
            <td>{user.HoTen || '-'}</td>
            <td>
                <select className="form-select form-select-sm" value={role} onChange={(e) => setRole(e.target.value)} disabled={!canEdit}>
                    <option value="Ứng viên">Ứng viên</option>
                    <option value="Nhà tuyển dụng">Nhà tuyển dụng</option>
                    <option value="Quản trị">Quản trị</option>
                </select>
            </td>
            <td>
                {status === 1 ? (
                    <span className="badge bg-success-subtle text-success">Hoạt động</span>
                ) : (
                    <span className="badge bg-danger-subtle text-danger">Đã chặn</span>
                )}
            </td>
            <td>
                <div className="d-flex flex-wrap gap-2">
                    <button className="btn btn-sm btn-primary" disabled={!canEdit || !dirty || saving} onClick={() => save()}>
                        Lưu
                    </button>
                    {status === 1 ? (
                        <button className="btn btn-sm btn-outline-warning" disabled={!canEdit || saving} onClick={() => save({ status: 0 })}>
                            Chặn
                        </button>
                    ) : (
                        <button className="btn btn-sm btn-outline-success" disabled={!canEdit || saving} onClick={() => save({ status: 1 })}>
                            Bỏ chặn
                        </button>
                    )}
                    <button className="btn btn-sm btn-outline-danger" disabled={!canDelete || saving} onClick={handleDelete}>
                        Xóa
                    </button>
                </div>
                {err ? <div className="text-danger small mt-1">{err}</div> : null}
            </td>
        </tr>
    );
};

const AdminJobRow = ({ job, onDelete, canDelete, requestConfirm }) => {
    const [status, setStatus] = useState(job.TrangThai || 'Nháp');
    const [deleting, setDeleting] = useState(false);
    const [err, setErr] = useState('');

    const handleDelete = async () => {
        if (!canDelete) return;
        const ok = await requestConfirm({
            title: 'Xác nhận xóa',
            message: 'Bạn có chắc muốn xóa tin tuyển dụng này?',
            confirmText: 'Xóa'
        });
        if (!ok) return;
        setDeleting(true);
        setErr('');
        try {
            await onDelete();
        } catch (e) {
            setErr(e?.message || 'Lỗi');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <tr>
            <td>{job.MaTin}</td>
            <td className="fw-semibold">{job.TieuDe}</td>
            <td>{job.TenCongTy || '-'}</td>
            <td>{job.ThanhPho || '-'}</td>
            <td>
                <span className="badge bg-secondary-subtle text-secondary">{status}</span>
            </td>
            <td>
                <div className="d-flex flex-wrap gap-2">
                    <button className="btn btn-sm btn-outline-danger" disabled={!canDelete || deleting} onClick={handleDelete}>
                        Xóa
                    </button>
                </div>
                {err ? <div className="text-danger small mt-1">{err}</div> : null}
            </td>
        </tr>
    );
};

const AdminReportRow = ({ report, onSave }) => {
    const [status, setStatus] = useState(report.TrangThai || 'Chưa xử lý');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const dirty = status !== (report.TrangThai || 'Chưa xử lý');

    const save = async () => {
        setSaving(true);
        setErr('');
        try {
            await onSave({ status });
        } catch (e) {
            setErr(e?.message || 'Lỗi');
        } finally {
            setSaving(false);
        }
    };

    return (
        <tr>
            <td>{report.MaBaoCao}</td>
            <td>{report.EmailNguoiBaoCao || report.MaNguoiBaoCao || '-'}</td>
            <td>{report.LoaiDoiTuong} #{report.MaDoiTuong}</td>
            <td>
                <div className="fw-semibold">{report.LyDo || '-'}</div>
                {report.ChiTiet ? <div className="text-muted small">{String(report.ChiTiet).slice(0, 120)}{String(report.ChiTiet).length > 120 ? '…' : ''}</div> : null}
            </td>
            <td>
                <select className="form-select form-select-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="Chưa xử lý">Chưa xử lý</option>
                    <option value="Đang xử lý">Đang xử lý</option>
                    <option value="Đã xử lý">Đã xử lý</option>
                    <option value="Từ chối">Từ chối</option>
                </select>
            </td>
            <td>
                <button className="btn btn-sm btn-primary" disabled={!dirty || saving} onClick={save}>
                    Lưu
                </button>
                {err ? <div className="text-danger small mt-1">{err}</div> : null}
            </td>
        </tr>
    );
};

export default AdminDashboard;
