import React, { useMemo, useState } from 'react';
import { Building2, Eye, Mail, MapPin, PencilLine, RotateCcw, Trash2, Users } from 'lucide-react';

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const dateText = date.toLocaleDateString('vi-VN');
    const timeText = date.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
    });
    return `${dateText} ${timeText}`;
};

const formatDateOnly = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('vi-VN');
};

const toInputDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const toSafeString = (value) => String(value ?? '').trim();

const createEmptyCandidateForm = () => ({
    birthday: '',
    gender: '',
    city: '',
    district: '',
    address: '',
    title: '',
    education: '',
    experience: 0,
    personalLink: '',
    intro: ''
});

const createEmptyEmployerForm = () => ({
    companyName: '',
    taxCode: '',
    website: '',
    city: '',
    address: '',
    description: ''
});

const buildEditForm = (user, detail) => {
    const detailUser = detail?.user || user || {};
    const candidate = detail?.candidateProfile || null;
    const employer = detail?.employerProfile || null;
    const role = detailUser?.VaiTro || 'Ứng viên';

    return {
        fullName: toSafeString(detailUser?.HoTen),
        email: toSafeString(detailUser?.Email),
        phone: toSafeString(detailUser?.SoDienThoai),
        address: toSafeString(detailUser?.DiaChi),
        role,
        status: Number(detailUser?.TrangThai ?? 1),
        candidateEnabled: role === 'Ứng viên',
        employerEnabled: role === 'Nhà tuyển dụng',
        candidate: {
            birthday: toInputDate(candidate?.NgaySinh),
            gender: toSafeString(candidate?.GioiTinh),
            city: toSafeString(candidate?.ThanhPho),
            district: toSafeString(candidate?.QuanHuyen),
            address: toSafeString(candidate?.DiaChi),
            title: toSafeString(candidate?.ChucDanh),
            education: toSafeString(candidate?.TrinhDoHocVan),
            experience: Number(candidate?.SoNamKinhNghiem || 0),
            personalLink: toSafeString(candidate?.LinkCaNhan),
            intro: toSafeString(candidate?.GioiThieuBanThan)
        },
        employer: {
            companyName: toSafeString(employer?.TenCongTy),
            taxCode: toSafeString(employer?.MaSoThue),
            website: toSafeString(employer?.Website),
            city: toSafeString(employer?.ThanhPho),
            address: toSafeString(employer?.DiaChi),
            description: toSafeString(employer?.MoTa)
        }
    };
};

const buildUserUpdatePayload = (form) => {
    const role = form?.role || 'Ứng viên';
    const payload = {
        fullName: toSafeString(form?.fullName),
        email: toSafeString(form?.email),
        phone: toSafeString(form?.phone),
        address: toSafeString(form?.address),
        role,
        status: Number(form?.status ?? 1)
    };

    if (role === 'Ứng viên') {
        payload.candidateProfile = {
            birthday: toSafeString(form?.candidate?.birthday),
            gender: toSafeString(form?.candidate?.gender),
            city: toSafeString(form?.candidate?.city),
            district: toSafeString(form?.candidate?.district),
            address: toSafeString(form?.candidate?.address),
            title: toSafeString(form?.candidate?.title),
            education: toSafeString(form?.candidate?.education),
            experience: Number(form?.candidate?.experience ?? 0),
            personalLink: toSafeString(form?.candidate?.personalLink),
            intro: toSafeString(form?.candidate?.intro)
        };
    }

    if (role === 'Nhà tuyển dụng') {
        payload.employerProfile = {
            companyName: toSafeString(form?.employer?.companyName),
            taxCode: toSafeString(form?.employer?.taxCode),
            website: toSafeString(form?.employer?.website),
            city: toSafeString(form?.employer?.city),
            address: toSafeString(form?.employer?.address),
            description: toSafeString(form?.employer?.description)
        };
    }

    return payload;
};

const isUserSoftDeleted = (user) => !!user?.NgayXoa;

const getUserPermissions = (user, isSuperAdmin, isAdmin) => {
    const isTargetSuperAdmin = Number(user?.IsSuperAdmin) === 1;
    const isTargetAdmin = user?.VaiTro === 'Quản trị' || user?.VaiTro === 'Siêu quản trị viên' || isTargetSuperAdmin;
    const canManage = (isSuperAdmin || isAdmin) && !isTargetAdmin;
    return {
        canEdit: canManage,
        canDelete: canManage
    };
};

const getStatusBadge = (user) => {
    if (isUserSoftDeleted(user)) {
        return <span className="badge bg-danger-subtle text-danger">Đã xóa mềm</span>;
    }
    const status = Number(user?.TrangThai ?? 1);
    if (status === 1) {
        return <span className="badge bg-success-subtle text-success">Hoạt động</span>;
    }
    return <span className="badge bg-warning-subtle text-warning-emphasis">Đã chặn</span>;
};

const UserInfoField = ({ label, value, className = '', noWrap = false }) => {
    const rawValue = value === 0 ? '0' : String(value ?? '').trim();
    const displayValue = rawValue || '-';
    const isLink = /^https?:\/\//i.test(displayValue);

    return (
        <div className={`admin-users-info-field ${noWrap ? 'is-nowrap' : ''} ${className}`.trim()}>
            <small>{label}</small>
            <div className={`admin-users-info-value ${isLink ? 'is-link' : ''}`.trim()}>
                {isLink ? (
                    <a href={displayValue} target="_blank" rel="noreferrer">{displayValue}</a>
                ) : (
                    <span>{displayValue}</span>
                )}
            </div>
        </div>
    );
};

const AdminUsersPage = ({
    users,
    loading,
    roleFilter,
    onRoleFilterChange,
    isSuperAdmin,
    isAdmin,
    requestConfirm,
    onSaveUser,
    onDeleteUser,
    onRestoreUser,
    onViewUserDetail
}) => {
    const [rowBusyId, setRowBusyId] = useState(null);
    const [rowErrors, setRowErrors] = useState({});
    const [viewModal, setViewModal] = useState({
        open: false,
        user: null,
        detail: null,
        loading: false,
        error: ''
    });
    const [editModal, setEditModal] = useState({
        open: false,
        user: null,
        loadingDetail: false,
        form: {
            fullName: '',
            email: '',
            phone: '',
            address: '',
            role: 'Ứng viên',
            status: 1,
            candidateEnabled: false,
            employerEnabled: false,
            candidate: createEmptyCandidateForm(),
            employer: createEmptyEmployerForm()
        },
        initialSnapshot: '',
        saving: false,
        error: ''
    });

    const filteredUsers = useMemo(() => (
        (users || [])
            .filter((u) => Number(u.IsSuperAdmin) !== 1)
            .filter((u) => (roleFilter === 'all' ? true : u.VaiTro === roleFilter))
    ), [users, roleFilter]);

    const setRowError = (userId, message) => {
        setRowErrors((prev) => ({ ...prev, [userId]: message }));
    };

    const clearRowError = (userId) => {
        setRowErrors((prev) => {
            if (!prev[userId]) return prev;
            const next = { ...prev };
            delete next[userId];
            return next;
        });
    };

    const openViewModal = async (user) => {
        const userId = user.MaNguoiDung;
        clearRowError(userId);
        setViewModal({
            open: true,
            user,
            detail: null,
            loading: true,
            error: ''
        });

        if (typeof onViewUserDetail !== 'function') {
            setViewModal((prev) => ({
                ...prev,
                loading: false,
                error: 'Chưa cấu hình API xem chi tiết người dùng.'
            }));
            return;
        }

        try {
            const detail = await onViewUserDetail(userId);
            setViewModal((prev) => ({ ...prev, detail, loading: false, error: '' }));
        } catch (error) {
            setViewModal((prev) => ({
                ...prev,
                loading: false,
                error: error?.message || 'Không tải được chi tiết người dùng'
            }));
        }
    };

    const openEditModal = async (user) => {
        clearRowError(user.MaNguoiDung);
        const initialForm = buildEditForm(user, null);
        setEditModal({
            open: true,
            user,
            loadingDetail: true,
            form: initialForm,
            initialSnapshot: JSON.stringify(buildUserUpdatePayload(initialForm)),
            saving: false,
            error: ''
        });

        if (typeof onViewUserDetail !== 'function') {
            setEditModal((prev) => ({ ...prev, loadingDetail: false }));
            return;
        }

        try {
            const detail = await onViewUserDetail(user.MaNguoiDung);
            const nextForm = buildEditForm(user, detail);
            setEditModal((prev) => ({
                ...prev,
                loadingDetail: false,
                form: nextForm,
                initialSnapshot: JSON.stringify(buildUserUpdatePayload(nextForm)),
                error: ''
            }));
        } catch (error) {
            setEditModal((prev) => ({
                ...prev,
                loadingDetail: false,
                error: error?.message || 'Không tải được chi tiết để chỉnh sửa.'
            }));
        }
    };

    const closeEditModal = () => {
        setEditModal({
            open: false,
            user: null,
            loadingDetail: false,
            form: {
                fullName: '',
                email: '',
                phone: '',
                address: '',
                role: 'Ứng viên',
                status: 1,
                candidateEnabled: false,
                employerEnabled: false,
                candidate: createEmptyCandidateForm(),
                employer: createEmptyEmployerForm()
            },
            initialSnapshot: '',
            saving: false,
            error: ''
        });
    };

    const updateEditField = (field, value) => {
        setEditModal((prev) => ({
            ...prev,
            form: {
                ...prev.form,
                [field]: value
            }
        }));
    };

    const updateRole = (role) => {
        setEditModal((prev) => ({
            ...prev,
            form: {
                ...prev.form,
                role,
                candidateEnabled: role === 'Ứng viên',
                employerEnabled: role === 'Nhà tuyển dụng'
            }
        }));
    };

    const updateCandidateField = (field, value) => {
        setEditModal((prev) => ({
            ...prev,
            form: {
                ...prev.form,
                candidate: {
                    ...prev.form.candidate,
                    [field]: value
                }
            }
        }));
    };

    const updateEmployerField = (field, value) => {
        setEditModal((prev) => ({
            ...prev,
            form: {
                ...prev.form,
                employer: {
                    ...prev.form.employer,
                    [field]: value
                }
            }
        }));
    };

    const submitEditModal = async () => {
        if (!editModal.user || typeof onSaveUser !== 'function') return;
        const userId = editModal.user.MaNguoiDung;
        setEditModal((prev) => ({ ...prev, saving: true, error: '' }));
        setRowBusyId(userId);
        clearRowError(userId);
        try {
            await onSaveUser(userId, buildUserUpdatePayload(editModal.form));
            closeEditModal();
        } catch (error) {
            const message = error?.message || 'Không cập nhật được người dùng';
            setEditModal((prev) => ({ ...prev, saving: false, error: message }));
            setRowError(userId, message);
        } finally {
            setRowBusyId(null);
        }
    };

    const handleDeleteOrRestore = async (user) => {
        const userId = user.MaNguoiDung;
        const isDeleted = isUserSoftDeleted(user);
        const actionText = isDeleted ? 'khôi phục' : 'xóa mềm';
        const confirmText = isDeleted ? 'Khôi phục' : 'Xóa';
        const ok = await requestConfirm({
            title: `Xác nhận ${actionText}`,
            message: `Bạn có chắc muốn ${actionText} tài khoản này?`,
            confirmText
        });
        if (!ok) return;

        setRowBusyId(userId);
        clearRowError(userId);
        try {
            if (isDeleted) {
                if (typeof onRestoreUser !== 'function') {
                    throw new Error('Chưa cấu hình thao tác khôi phục người dùng.');
                }
                await onRestoreUser(userId);
            } else {
                await onDeleteUser(userId);
            }
        } catch (error) {
            setRowError(userId, error?.message || 'Thao tác thất bại');
        } finally {
            setRowBusyId(null);
        }
    };

    const detailUser = viewModal.detail?.user || viewModal.user;
    const avatarUrl = viewModal.detail?.avatarAbsoluteUrl || viewModal.detail?.avatarUrl || '';
    const candidateProfile = viewModal.detail?.candidateProfile || null;
    const employerProfile = viewModal.detail?.employerProfile || null;
    const editRole = editModal.form.role;
    const showCandidateSection = editRole === 'Ứng viên';
    const showEmployerSection = editRole === 'Nhà tuyển dụng';

    const currentEditSnapshot = JSON.stringify(buildUserUpdatePayload(editModal.form));
    const editDirty = Boolean(editModal.user) && (
        currentEditSnapshot !== editModal.initialSnapshot
    );

    return (
        <>
            <div className="card border-0 shadow-sm admin-module-card mb-4">
                <div className="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center flex-wrap gap-3">
                    <h5 className="mb-0 d-flex align-items-center gap-2">
                        <Users size={18} />
                        <span>Quản lý người dùng</span>
                    </h5>
                    <div className="d-flex align-items-center gap-2">
                        <select
                            className="form-select form-select-sm"
                            style={{ minWidth: 170 }}
                            value={roleFilter}
                            onChange={(e) => onRoleFilterChange(e.target.value)}
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
                                <th style={{ width: 190 }}>Ngày xóa</th>
                                <th style={{ width: 280 }}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => {
                                const userId = user.MaNguoiDung;
                                const isDeleted = isUserSoftDeleted(user);
                                const permissions = getUserPermissions(user, isSuperAdmin, isAdmin);
                                const busy = rowBusyId === userId;
                                return (
                                    <tr key={userId}>
                                        <td>{userId}</td>
                                        <td>{user.Email}</td>
                                        <td>{user.HoTen || '-'}</td>
                                        <td>
                                            <span className="badge rounded-pill text-bg-light border">{user.VaiTro || 'Ứng viên'}</span>
                                        </td>
                                        <td>{getStatusBadge(user)}</td>
                                        <td>{formatDateTime(user.NgayXoa)}</td>
                                        <td>
                                            <div className="d-flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-info admin-action-icon-btn"
                                                    onClick={() => openViewModal(user)}
                                                    disabled={busy}
                                                    title="Xem chi tiết"
                                                    aria-label="Xem chi tiết"
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary admin-action-icon-btn"
                                                    onClick={() => openEditModal(user)}
                                                    disabled={!permissions.canEdit || busy}
                                                    title="Sửa người dùng"
                                                    aria-label="Sửa người dùng"
                                                >
                                                    <PencilLine size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`btn btn-sm admin-action-icon-btn ${isDeleted ? 'btn-outline-success' : 'btn-outline-danger'}`}
                                                    onClick={() => handleDeleteOrRestore(user)}
                                                    disabled={!permissions.canDelete || busy}
                                                    title={isDeleted ? 'Khôi phục người dùng' : 'Xóa người dùng'}
                                                    aria-label={isDeleted ? 'Khôi phục người dùng' : 'Xóa người dùng'}
                                                >
                                                    {isDeleted ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                                                </button>
                                            </div>
                                            {rowErrors[userId] ? <div className="text-danger small mt-1">{rowErrors[userId]}</div> : null}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredUsers.length === 0 && !loading && (
                                <tr><td colSpan={7} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {viewModal.open && (
                <div className="admin-confirm-backdrop" role="dialog" aria-modal="true">
                    <div className="admin-confirm-dialog admin-users-view-dialog card border-0 shadow-sm">
                        <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between admin-users-view-header">
                            <h5 className="mb-0">Thông tin người dùng</h5>
                            <button type="button" className="admin-users-close-btn" onClick={() => setViewModal({ open: false, user: null, detail: null, loading: false, error: '' })}>
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        <div className="card-body">
                            {viewModal.loading && <div className="alert alert-info mb-0">Đang tải chi tiết người dùng...</div>}
                            {!viewModal.loading && viewModal.error && <div className="alert alert-danger mb-0">{viewModal.error}</div>}

                            {!viewModal.loading && !viewModal.error && detailUser && (
                                <div className="admin-users-view-layout">
                                    <aside className="admin-users-profile-panel">
                                        {avatarUrl ? (
                                            <img
                                                src={avatarUrl}
                                                alt="avatar"
                                                className="admin-users-avatar"
                                            />
                                        ) : (
                                            <div className="admin-users-avatar admin-users-avatar-fallback">
                                                {(detailUser.HoTen || detailUser.Email || '?').charAt(0).toUpperCase()}
                                            </div>
                                        )}

                                        <div className="admin-users-profile-name">{detailUser.HoTen || '-'}</div>
                                        <div className="admin-users-profile-email">
                                            <Mail size={14} />
                                            <span>{detailUser.Email || '-'}</span>
                                        </div>

                                        <div className="admin-users-profile-tags">
                                            <span className="badge rounded-pill text-bg-light border">{detailUser.VaiTro || 'Ứng viên'}</span>
                                            {getStatusBadge(detailUser)}
                                        </div>

                                        <div className="admin-users-profile-meta">
                                            <div className="admin-users-profile-meta-item">
                                                <span>Mã người dùng</span>
                                                <strong>{viewModal.user?.MaNguoiDung || '-'}</strong>
                                            </div>
                                            <div className="admin-users-profile-meta-item">
                                                <span>Ngày tạo</span>
                                                <strong>{formatDateTime(detailUser.NgayTao)}</strong>
                                            </div>
                                            <div className="admin-users-profile-meta-item">
                                                <span>Cập nhật</span>
                                                <strong>{formatDateTime(detailUser.NgayCapNhat)}</strong>
                                            </div>
                                        </div>
                                    </aside>

                                    <div className="admin-users-detail-panels">
                                        <section className="admin-users-section-card">
                                            <h6 className="mb-2">Thông tin cơ bản</h6>
                                            <div className="admin-users-field-grid">
                                                <UserInfoField label="Số điện thoại" value={detailUser.SoDienThoai} className="admin-users-info-card" />
                                                <UserInfoField label="Địa chỉ" value={detailUser.DiaChi} className="admin-users-info-card" />
                                                <UserInfoField label="Ngày tạo" value={formatDateTime(detailUser.NgayTao)} className="admin-users-info-card" noWrap />
                                                <UserInfoField label="Ngày cập nhật" value={formatDateTime(detailUser.NgayCapNhat)} className="admin-users-info-card" noWrap />
                                                <UserInfoField label="Ngày xóa" value={formatDateTime(detailUser.NgayXoa)} className="admin-users-info-card" noWrap />
                                            </div>
                                        </section>

                                        {candidateProfile && (
                                            <section className="admin-users-section-card">
                                                <h6 className="mb-2 d-flex align-items-center gap-2">
                                                    <MapPin size={16} />
                                                    Thông tin ứng viên
                                                </h6>
                                                <div className="admin-users-field-grid">
                                                    <UserInfoField label="Chức danh" value={candidateProfile.ChucDanh} className="admin-users-info-card" />
                                                    <UserInfoField label="Giới tính" value={candidateProfile.GioiTinh} className="admin-users-info-card" />
                                                    <UserInfoField label="Ngày sinh" value={formatDateOnly(candidateProfile.NgaySinh)} className="admin-users-info-card" noWrap />
                                                    <UserInfoField label="Thành phố" value={candidateProfile.ThanhPho} className="admin-users-info-card" />
                                                    <UserInfoField label="Quận/Huyện" value={candidateProfile.QuanHuyen} className="admin-users-info-card" />
                                                    <UserInfoField label="Địa chỉ chi tiết" value={candidateProfile.DiaChi} className="admin-users-info-card" />
                                                    <UserInfoField label="Trình độ học vấn" value={candidateProfile.TrinhDoHocVan} className="admin-users-info-card" />
                                                    <UserInfoField label="Số năm kinh nghiệm" value={candidateProfile.SoNamKinhNghiem} className="admin-users-info-card" />
                                                    <UserInfoField label="Link cá nhân" value={candidateProfile.LinkCaNhan} className="admin-users-info-card" />
                                                </div>
                                                {candidateProfile.GioiThieuBanThan ? (
                                                    <div className="mt-2 admin-users-note-box">
                                                        <small className="text-muted d-block">Giới thiệu bản thân</small>
                                                        <div>{candidateProfile.GioiThieuBanThan}</div>
                                                    </div>
                                                ) : null}
                                            </section>
                                        )}

                                        {employerProfile && (
                                            <section className="admin-users-section-card">
                                                <h6 className="mb-2 d-flex align-items-center gap-2">
                                                    <Building2 size={16} />
                                                    Thông tin nhà tuyển dụng
                                                </h6>
                                                <div className="admin-users-field-grid">
                                                    <UserInfoField label="Tên công ty" value={employerProfile.TenCongTy} className="admin-users-info-card" />
                                                    <UserInfoField label="Mã số thuế" value={employerProfile.MaSoThue} className="admin-users-info-card" />
                                                    <UserInfoField label="Website" value={employerProfile.Website} className="admin-users-info-card" />
                                                    <UserInfoField label="Thành phố" value={employerProfile.ThanhPho} className="admin-users-info-card" />
                                                    <UserInfoField label="Địa chỉ" value={employerProfile.DiaChi} className="admin-users-info-card" />
                                                </div>
                                                {employerProfile.MoTa ? (
                                                    <div className="mt-2 admin-users-note-box">
                                                        <small className="text-muted d-block">Mô tả công ty</small>
                                                        <div>{employerProfile.MoTa}</div>
                                                    </div>
                                                ) : null}
                                            </section>
                                        )}
                                    </div>
                                </div>
                            )}

                            {!viewModal.loading && !viewModal.error && (
                                <div className="admin-users-view-footer mt-3">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => setViewModal({ open: false, user: null, detail: null, loading: false, error: '' })}
                                    >
                                        Hủy
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {editModal.open && (
                <div className="admin-confirm-backdrop" role="dialog" aria-modal="true">
                    <div className="admin-confirm-dialog admin-users-edit-dialog card border-0 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <h5 className="mb-0">Sửa người dùng #{editModal.user?.MaNguoiDung}</h5>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={closeEditModal}
                                    disabled={editModal.saving}
                                >
                                    Đóng
                                </button>
                            </div>

                            {editModal.loadingDetail ? (
                                <div className="alert alert-info mb-0">Đang tải đầy đủ thông tin người dùng...</div>
                            ) : (
                                <>
                                    <div className="admin-users-edit-section">
                                        <h6 className="mb-3">Thông tin cơ bản</h6>
                                        <div className="row g-3">
                                            <div className="col-md-6">
                                                <label className="form-label">Họ tên</label>
                                                <input
                                                    className="form-control"
                                                    value={editModal.form.fullName}
                                                    onChange={(e) => updateEditField('fullName', e.target.value)}
                                                    disabled={editModal.saving}
                                                    placeholder="Nhập họ tên"
                                                />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label">Email</label>
                                                <input
                                                    type="email"
                                                    className="form-control"
                                                    value={editModal.form.email}
                                                    onChange={(e) => updateEditField('email', e.target.value)}
                                                    disabled={editModal.saving}
                                                    placeholder="name@example.com"
                                                />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label">Số điện thoại</label>
                                                <input
                                                    className="form-control"
                                                    value={editModal.form.phone}
                                                    onChange={(e) => updateEditField('phone', e.target.value)}
                                                    disabled={editModal.saving}
                                                    placeholder="Nhập số điện thoại"
                                                />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label">Địa chỉ</label>
                                                <input
                                                    className="form-control"
                                                    value={editModal.form.address}
                                                    onChange={(e) => updateEditField('address', e.target.value)}
                                                    disabled={editModal.saving}
                                                    placeholder="Nhập địa chỉ"
                                                />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label">Vai trò</label>
                                                <select
                                                    className="form-select"
                                                    value={editModal.form.role}
                                                    onChange={(e) => updateRole(e.target.value)}
                                                    disabled={editModal.saving}
                                                >
                                                    <option value="Ứng viên">Ứng viên</option>
                                                    <option value="Nhà tuyển dụng">Nhà tuyển dụng</option>
                                                    <option value="Quản trị">Quản trị</option>
                                                </select>
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label">Trạng thái</label>
                                                <select
                                                    className="form-select"
                                                    value={editModal.form.status}
                                                    onChange={(e) => updateEditField('status', Number(e.target.value))}
                                                    disabled={editModal.saving}
                                                >
                                                    <option value={1}>Hoạt động</option>
                                                    <option value={0}>Đã chặn</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {showCandidateSection && (
                                        <div className="admin-users-edit-section mt-3">
                                            <div className="d-flex align-items-center justify-content-between mb-3">
                                                <h6 className="mb-0">Hồ sơ ứng viên</h6>
                                            </div>

                                            <div className="row g-3">
                                                <div className="col-md-4">
                                                    <label className="form-label">Ngày sinh</label>
                                                    <input
                                                        type="date"
                                                        className="form-control"
                                                        value={editModal.form.candidate.birthday}
                                                        onChange={(e) => updateCandidateField('birthday', e.target.value)}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>
                                                <div className="col-md-4">
                                                    <label className="form-label">Giới tính</label>
                                                    <select
                                                        className="form-select"
                                                        value={editModal.form.candidate.gender}
                                                        onChange={(e) => updateCandidateField('gender', e.target.value)}
                                                        disabled={editModal.saving}
                                                    >
                                                        <option value="">Chưa chọn</option>
                                                        <option value="Nam">Nam</option>
                                                        <option value="Nữ">Nữ</option>
                                                        <option value="Khác">Khác</option>
                                                    </select>
                                                </div>
                                                <div className="col-md-4">
                                                    <label className="form-label">Số năm kinh nghiệm</label>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        max={60}
                                                        className="form-control"
                                                        value={editModal.form.candidate.experience}
                                                        onChange={(e) => updateCandidateField('experience', Number(e.target.value || 0))}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>

                                                <div className="col-md-4">
                                                    <label className="form-label">Thành phố</label>
                                                    <input
                                                        className="form-control"
                                                        value={editModal.form.candidate.city}
                                                        onChange={(e) => updateCandidateField('city', e.target.value)}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>
                                                <div className="col-md-4">
                                                    <label className="form-label">Quận/Huyện</label>
                                                    <input
                                                        className="form-control"
                                                        value={editModal.form.candidate.district}
                                                        onChange={(e) => updateCandidateField('district', e.target.value)}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>
                                                <div className="col-md-4">
                                                    <label className="form-label">Chức danh</label>
                                                    <input
                                                        className="form-control"
                                                        value={editModal.form.candidate.title}
                                                        onChange={(e) => updateCandidateField('title', e.target.value)}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>

                                                <div className="col-md-6">
                                                    <label className="form-label">Trình độ học vấn</label>
                                                    <input
                                                        className="form-control"
                                                        value={editModal.form.candidate.education}
                                                        onChange={(e) => updateCandidateField('education', e.target.value)}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label">Link cá nhân</label>
                                                    <input
                                                        className="form-control"
                                                        value={editModal.form.candidate.personalLink}
                                                        onChange={(e) => updateCandidateField('personalLink', e.target.value)}
                                                        disabled={editModal.saving}
                                                        placeholder="https://..."
                                                    />
                                                </div>

                                                <div className="col-12">
                                                    <label className="form-label">Địa chỉ chi tiết</label>
                                                    <input
                                                        className="form-control"
                                                        value={editModal.form.candidate.address}
                                                        onChange={(e) => updateCandidateField('address', e.target.value)}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label">Giới thiệu bản thân</label>
                                                    <textarea
                                                        rows={3}
                                                        className="form-control"
                                                        value={editModal.form.candidate.intro}
                                                        onChange={(e) => updateCandidateField('intro', e.target.value)}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {showEmployerSection && (
                                        <div className="admin-users-edit-section mt-3">
                                            <div className="d-flex align-items-center justify-content-between mb-3">
                                                <h6 className="mb-0">Hồ sơ nhà tuyển dụng</h6>
                                            </div>

                                            <div className="row g-3">
                                                <div className="col-md-6">
                                                    <label className="form-label">Tên công ty</label>
                                                    <input
                                                        className="form-control"
                                                        value={editModal.form.employer.companyName}
                                                        onChange={(e) => updateEmployerField('companyName', e.target.value)}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label">Mã số thuế</label>
                                                    <input
                                                        className="form-control"
                                                        value={editModal.form.employer.taxCode}
                                                        onChange={(e) => updateEmployerField('taxCode', e.target.value)}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label">Website</label>
                                                    <input
                                                        className="form-control"
                                                        value={editModal.form.employer.website}
                                                        onChange={(e) => updateEmployerField('website', e.target.value)}
                                                        disabled={editModal.saving}
                                                        placeholder="https://..."
                                                    />
                                                </div>
                                                <div className="col-md-6">
                                                    <label className="form-label">Thành phố</label>
                                                    <input
                                                        className="form-control"
                                                        value={editModal.form.employer.city}
                                                        onChange={(e) => updateEmployerField('city', e.target.value)}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label">Địa chỉ công ty</label>
                                                    <input
                                                        className="form-control"
                                                        value={editModal.form.employer.address}
                                                        onChange={(e) => updateEmployerField('address', e.target.value)}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label">Mô tả công ty</label>
                                                    <textarea
                                                        rows={3}
                                                        className="form-control"
                                                        value={editModal.form.employer.description}
                                                        onChange={(e) => updateEmployerField('description', e.target.value)}
                                                        disabled={editModal.saving}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {editModal.user?.NgayXoa ? (
                                        <div className="alert alert-warning mt-3 mb-0">
                                            Tài khoản đã bị xóa mềm vào {formatDateTime(editModal.user.NgayXoa)}. Chuyển trạng thái về hoạt động sẽ tự động bỏ ngày xóa.
                                        </div>
                                    ) : null}

                                    {editModal.error ? <div className="text-danger small mt-2">{editModal.error}</div> : null}

                                    <div className="d-flex justify-content-end gap-2 mt-4">
                                        <button type="button" className="btn btn-outline-secondary" onClick={closeEditModal} disabled={editModal.saving}>
                                            Hủy
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={submitEditModal}
                                            disabled={editModal.saving || !editDirty || editModal.loadingDetail}
                                        >
                                            {editModal.saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </>
    );
};

export default AdminUsersPage;
