import React, { useMemo, useState } from 'react';
import { Eye, PencilLine, RotateCcw, Trash2, Users } from 'lucide-react';

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('vi-VN');
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

const UserInfoField = ({ label, value }) => (
    <div className="col-md-6 mb-2">
        <small className="text-muted d-block">{label}</small>
        <div>{value || '-'}</div>
    </div>
);

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
        role: 'Ứng viên',
        status: 1,
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

    const openEditModal = (user) => {
        clearRowError(user.MaNguoiDung);
        setEditModal({
            open: true,
            user,
            role: user.VaiTro || 'Ứng viên',
            status: Number(user.TrangThai ?? 1),
            saving: false,
            error: ''
        });
    };

    const closeEditModal = () => {
        setEditModal({
            open: false,
            user: null,
            role: 'Ứng viên',
            status: 1,
            saving: false,
            error: ''
        });
    };

    const submitEditModal = async () => {
        if (!editModal.user || typeof onSaveUser !== 'function') return;
        const userId = editModal.user.MaNguoiDung;
        setEditModal((prev) => ({ ...prev, saving: true, error: '' }));
        setRowBusyId(userId);
        clearRowError(userId);
        try {
            await onSaveUser(userId, {
                role: editModal.role,
                status: Number(editModal.status)
            });
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

    const editDirty = Boolean(editModal.user) && (
        editModal.role !== (editModal.user?.VaiTro || 'Ứng viên')
        || Number(editModal.status) !== Number(editModal.user?.TrangThai ?? 1)
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
                                                    className="btn btn-sm btn-outline-info d-inline-flex align-items-center gap-1"
                                                    onClick={() => openViewModal(user)}
                                                    disabled={busy}
                                                >
                                                    <Eye size={14} />
                                                    Xem
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                                                    onClick={() => openEditModal(user)}
                                                    disabled={!permissions.canEdit || busy}
                                                >
                                                    <PencilLine size={14} />
                                                    Sửa
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`btn btn-sm d-inline-flex align-items-center gap-1 ${isDeleted ? 'btn-outline-success' : 'btn-outline-danger'}`}
                                                    onClick={() => handleDeleteOrRestore(user)}
                                                    disabled={!permissions.canDelete || busy}
                                                >
                                                    {isDeleted ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                                                    {isDeleted ? 'Khôi phục' : 'Xóa'}
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
                    <div className="admin-confirm-dialog card border-0 shadow-sm" style={{ maxWidth: 860 }}>
                        <div className="card-header bg-white border-0 d-flex align-items-center justify-content-between">
                            <h5 className="mb-0">Thông tin người dùng</h5>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setViewModal({ open: false, user: null, detail: null, loading: false, error: '' })}>
                                Đóng
                            </button>
                        </div>
                        <div className="card-body">
                            {viewModal.loading && <div className="alert alert-info mb-0">Đang tải chi tiết người dùng...</div>}
                            {!viewModal.loading && viewModal.error && <div className="alert alert-danger mb-0">{viewModal.error}</div>}

                            {!viewModal.loading && !viewModal.error && detailUser && (
                                <div>
                                    <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
                                        {avatarUrl ? (
                                            <img
                                                src={avatarUrl}
                                                alt="avatar"
                                                style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0' }}
                                            />
                                        ) : (
                                            <div
                                                style={{
                                                    width: 72,
                                                    height: 72,
                                                    borderRadius: '50%',
                                                    border: '1px solid #e2e8f0',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 700,
                                                    color: '#334155',
                                                    background: '#f8fafc'
                                                }}
                                            >
                                                {(detailUser.HoTen || detailUser.Email || '?').charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <h6 className="mb-1">{detailUser.HoTen || '-'}</h6>
                                            <div className="text-muted small">{detailUser.Email}</div>
                                            <div className="text-muted small">Vai trò: {detailUser.VaiTro || '-'}</div>
                                        </div>
                                    </div>

                                    <div className="row">
                                        <UserInfoField label="Số điện thoại" value={detailUser.SoDienThoai} />
                                        <UserInfoField label="Trạng thái" value={Number(detailUser.TrangThai) === 1 ? 'Hoạt động' : 'Đã chặn'} />
                                        <UserInfoField label="Ngày tạo" value={formatDateTime(detailUser.NgayTao)} />
                                        <UserInfoField label="Ngày cập nhật" value={formatDateTime(detailUser.NgayCapNhat)} />
                                        <UserInfoField label="Ngày xóa" value={formatDateTime(detailUser.NgayXoa)} />
                                    </div>

                                    {candidateProfile && (
                                        <div className="mt-3">
                                            <h6 className="mb-2">Thông tin ứng viên</h6>
                                            <div className="row">
                                                <UserInfoField label="Chức danh" value={candidateProfile.ChucDanh} />
                                                <UserInfoField label="Giới tính" value={candidateProfile.GioiTinh} />
                                                <UserInfoField label="Ngày sinh" value={formatDateTime(candidateProfile.NgaySinh)} />
                                                <UserInfoField label="Thành phố" value={candidateProfile.ThanhPho} />
                                                <UserInfoField label="Quận/Huyện" value={candidateProfile.QuanHuyen} />
                                                <UserInfoField label="Trình độ học vấn" value={candidateProfile.TrinhDoHocVan} />
                                                <UserInfoField label="Số năm kinh nghiệm" value={candidateProfile.SoNamKinhNghiem} />
                                                <UserInfoField label="Link cá nhân" value={candidateProfile.LinkCaNhan} />
                                            </div>
                                            {candidateProfile.GioiThieuBanThan ? (
                                                <div className="mt-2">
                                                    <small className="text-muted d-block">Giới thiệu bản thân</small>
                                                    <div className="border rounded p-2 bg-light-subtle">{candidateProfile.GioiThieuBanThan}</div>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}

                                    {employerProfile && (
                                        <div className="mt-3">
                                            <h6 className="mb-2">Thông tin nhà tuyển dụng</h6>
                                            <div className="row">
                                                <UserInfoField label="Tên công ty" value={employerProfile.TenCongTy} />
                                                <UserInfoField label="Mã số thuế" value={employerProfile.MaSoThue} />
                                                <UserInfoField label="Website" value={employerProfile.Website} />
                                                <UserInfoField label="Thành phố" value={employerProfile.ThanhPho} />
                                                <UserInfoField label="Địa chỉ" value={employerProfile.DiaChi} />
                                            </div>
                                            {employerProfile.MoTa ? (
                                                <div className="mt-2">
                                                    <small className="text-muted d-block">Mô tả công ty</small>
                                                    <div className="border rounded p-2 bg-light-subtle">{employerProfile.MoTa}</div>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {editModal.open && (
                <div className="admin-confirm-backdrop" role="dialog" aria-modal="true">
                    <div className="admin-confirm-dialog card border-0 shadow-sm" style={{ maxWidth: 620 }}>
                        <div className="card-body">
                            <h5 className="mb-3">Sửa người dùng #{editModal.user?.MaNguoiDung}</h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label">Vai trò</label>
                                    <select
                                        className="form-select"
                                        value={editModal.role}
                                        onChange={(e) => setEditModal((prev) => ({ ...prev, role: e.target.value }))}
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
                                        value={editModal.status}
                                        onChange={(e) => setEditModal((prev) => ({ ...prev, status: Number(e.target.value) }))}
                                        disabled={editModal.saving}
                                    >
                                        <option value={1}>Hoạt động</option>
                                        <option value={0}>Đã chặn</option>
                                    </select>
                                </div>
                            </div>

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
                                    disabled={editModal.saving || !editDirty}
                                >
                                    {editModal.saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdminUsersPage;
