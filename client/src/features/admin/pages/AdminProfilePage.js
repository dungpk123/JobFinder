import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, PencilLine, Save, ShieldCheck } from 'lucide-react';
import InstallAppPanel from '../../../components/pwa/InstallAppPanel';
import { API_BASE as CLIENT_API_BASE } from '../../../config/apiBase';

const AVATAR_FALLBACK = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const readStoredUser = () => {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
        return {};
    }
};

const syncLocalUserSnapshot = (overrides = {}) => {
    const current = readStoredUser();
    const next = {
        ...current,
        ...overrides
    };

    try {
        localStorage.setItem('user', JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('jobfinder:user-updated', { detail: next }));
    } catch {
        // Ignore localStorage sync errors.
    }
};

const normalizeAvatarUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && raw.startsWith('http://')) {
        return `https://${raw.slice(7)}`;
    }
    return raw;
};

const withAvatarVersion = (url, version) => {
    const raw = normalizeAvatarUrl(url);
    if (!raw || raw.startsWith('blob:')) return raw;

    const versionNumber = Number(version || 0);
    if (!Number.isFinite(versionNumber) || versionNumber <= 0) {
        return raw;
    }

    const separator = raw.includes('?') ? '&' : '?';
    return `${raw}${separator}v=${versionNumber}`;
};

const formatDateTime = (value) => {
    if (!value) return 'Chưa có dữ liệu';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';
    return date.toLocaleString('vi-VN');
};

const resolveUserId = (user = {}) => {
    return user?.id || user?.MaNguoiDung || user?.userId || user?.userID || null;
};

const buildInitialForm = (user = {}) => ({
    fullName: user?.full_name || user?.HoTen || user?.name || '',
    email: user?.email || user?.Email || '',
    phone: user?.phone || user?.SoDienThoai || '',
    city: user?.city || '',
    address: user?.address || user?.DiaChi || '',
    position: user?.position || '',
    personalLink: user?.personalLink || '',
    avatarUrl: normalizeAvatarUrl(user?.avatar || user?.avatarAbsoluteUrl || user?.AnhDaiDien || user?.avatarUrl || ''),
    createdAt: user?.createdAt || '',
    updatedAt: user?.updatedAt || ''
});

const AdminProfilePage = ({ user, roleLabel, greetingName }) => {
    const API_BASE = CLIENT_API_BASE;
    const userId = useMemo(() => resolveUserId(user), [user]);
    const avatarInputRef = useRef(null);
    const avatarObjectUrlRef = useRef('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [form, setForm] = useState(() => buildInitialForm(user));
    const [baselineForm, setBaselineForm] = useState(() => buildInitialForm(user));
    const [avatarPreview, setAvatarPreview] = useState(() => normalizeAvatarUrl(user?.avatar || user?.avatarAbsoluteUrl || user?.AnhDaiDien || user?.avatarUrl || '') || AVATAR_FALLBACK);
    const [baselineAvatar, setBaselineAvatar] = useState(() => normalizeAvatarUrl(user?.avatar || user?.avatarAbsoluteUrl || user?.AnhDaiDien || user?.avatarUrl || '') || AVATAR_FALLBACK);
    const [avatarFile, setAvatarFile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => () => {
        if (avatarObjectUrlRef.current) {
            URL.revokeObjectURL(avatarObjectUrlRef.current);
            avatarObjectUrlRef.current = '';
        }
    }, []);

    useEffect(() => {
        if (!userId) {
            setError('Không tìm thấy tài khoản admin. Vui lòng đăng nhập lại.');
            setLoading(false);
            return;
        }

        let cancelled = false;

        const loadProfile = async () => {
            setLoading(true);
            setError('');
            setMessage('');

            try {
                const response = await fetch(`${API_BASE}/users/profile/${userId}`);
                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data?.success) {
                    throw new Error(data?.error || 'Không tải được thông tin cá nhân admin.');
                }

                if (cancelled) return;

                const profile = data.profile || {};
                const normalizedAvatar = normalizeAvatarUrl(profile.avatarAbsoluteUrl || profile.avatarUrl || '');
                const nextForm = {
                    fullName: profile.fullName || '',
                    email: profile.email || '',
                    phone: profile.phone || '',
                    city: profile.city || '',
                    address: profile.address || '',
                    position: profile.position || '',
                    personalLink: profile.personalLink || '',
                    avatarUrl: normalizedAvatar,
                    createdAt: profile.createdAt || '',
                    updatedAt: profile.updatedAt || ''
                };

                setForm(nextForm);
                setBaselineForm(nextForm);
                setAvatarPreview(normalizedAvatar || AVATAR_FALLBACK);
                setBaselineAvatar(normalizedAvatar || AVATAR_FALLBACK);
                setIsEditing(false);
                setAvatarFile(null);

                const storedUser = readStoredUser();
                const fallbackName = storedUser?.name || storedUser?.HoTen || '';
                const fallbackAvatar = normalizeAvatarUrl(
                    storedUser?.avatar
                    || storedUser?.avatarAbsoluteUrl
                    || storedUser?.AnhDaiDien
                    || storedUser?.avatarUrl
                    || ''
                );

                syncLocalUserSnapshot({
                    name: nextForm.fullName || fallbackName,
                    HoTen: nextForm.fullName || fallbackName,
                    avatar: normalizedAvatar || fallbackAvatar,
                    AnhDaiDien: normalizedAvatar || fallbackAvatar,
                    avatarAbsoluteUrl: normalizedAvatar || fallbackAvatar,
                    avatarUrl: normalizedAvatar || fallbackAvatar
                });
            } catch (err) {
                if (!cancelled) {
                    setError(err?.message || 'Không tải được thông tin cá nhân admin.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadProfile();

        return () => {
            cancelled = true;
        };
    }, [API_BASE, userId]);

    const handleFieldChange = (key) => (event) => {
        const value = event.target.value;
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const clearPendingAvatar = (nextAvatarUrl = form.avatarUrl) => {
        if (avatarObjectUrlRef.current) {
            URL.revokeObjectURL(avatarObjectUrlRef.current);
            avatarObjectUrlRef.current = '';
        }
        setAvatarFile(null);
        setAvatarPreview(nextAvatarUrl || AVATAR_FALLBACK);
        if (avatarInputRef.current) {
            avatarInputRef.current.value = '';
        }
    };

    const handleStartEditing = () => {
        setError('');
        setMessage('');
        setIsEditing(true);
    };

    const handleCancelEditing = () => {
        setForm(baselineForm);
        clearPendingAvatar(baselineAvatar);
        setError('');
        setMessage('');
        setIsEditing(false);
    };

    const handleAvatarSelect = (event) => {
        if (!isEditing) {
            setError('Nhấn "Chỉnh sửa hồ sơ" để thay đổi ảnh đại diện.');
            return;
        }

        const file = event.target.files?.[0];
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setError('Ảnh đại diện chỉ nhận JPG, PNG hoặc WEBP.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('Ảnh đại diện không được vượt quá 5MB.');
            return;
        }

        setError('');
        setMessage('');
        setAvatarFile(file);

        if (avatarObjectUrlRef.current) {
            URL.revokeObjectURL(avatarObjectUrlRef.current);
        }
        const objectUrl = URL.createObjectURL(file);
        avatarObjectUrlRef.current = objectUrl;
        setAvatarPreview(objectUrl);
    };

    const handleAvatarUpload = async () => {
        if (!isEditing || !userId || !avatarFile || uploadingAvatar) return;

        setUploadingAvatar(true);
        setError('');
        setMessage('');

        try {
            const formData = new FormData();
            formData.append('avatar', avatarFile);
            formData.append('userId', String(userId));

            const response = await fetch(`${API_BASE}/users/upload-avatar`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Không thể tải ảnh đại diện lên.');
            }

            const uploadedAvatar = normalizeAvatarUrl(data.absoluteUrl || data.avatarUrl || '');

            setForm((prev) => ({ ...prev, avatarUrl: uploadedAvatar }));
            setBaselineForm((prev) => ({ ...prev, avatarUrl: uploadedAvatar }));
            setAvatarPreview(uploadedAvatar || AVATAR_FALLBACK);
            setBaselineAvatar(uploadedAvatar || AVATAR_FALLBACK);
            setAvatarFile(null);

            if (avatarInputRef.current) {
                avatarInputRef.current.value = '';
            }
            if (avatarObjectUrlRef.current) {
                URL.revokeObjectURL(avatarObjectUrlRef.current);
                avatarObjectUrlRef.current = '';
            }

            syncLocalUserSnapshot({
                name: form.fullName || user?.name || user?.HoTen || '',
                HoTen: form.fullName || user?.HoTen || user?.name || '',
                avatar: uploadedAvatar,
                AnhDaiDien: uploadedAvatar,
                avatarAbsoluteUrl: uploadedAvatar,
                avatarUrl: uploadedAvatar,
                avatarUpdatedAt: Date.now()
            });

            setMessage('Đã cập nhật ảnh đại diện admin.');
        } catch (err) {
            setError(err?.message || 'Không thể tải ảnh đại diện lên.');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!isEditing || !userId || saving) return;

        setSaving(true);
        setError('');
        setMessage('');

        try {
            const payload = {
                userId,
                fullName: form.fullName || '',
                phone: form.phone || '',
                city: form.city || '',
                address: form.address || '',
                position: form.position || '',
                personalLink: form.personalLink || '',
                avatar: form.avatarUrl || ''
            };

            const response = await fetch(`${API_BASE}/users/update-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Không thể lưu hồ sơ admin.');
            }

            const normalizedAvatar = normalizeAvatarUrl(form.avatarUrl || user?.avatar || user?.AnhDaiDien || '');

            syncLocalUserSnapshot({
                name: form.fullName || user?.name || user?.HoTen || '',
                HoTen: form.fullName || user?.HoTen || user?.name || '',
                avatar: normalizedAvatar,
                AnhDaiDien: normalizedAvatar,
                avatarAbsoluteUrl: normalizedAvatar,
                avatarUrl: normalizedAvatar,
                avatarUpdatedAt: Date.now()
            });

            setBaselineForm(form);
            setBaselineAvatar(normalizedAvatar || AVATAR_FALLBACK);
            setIsEditing(false);
            setMessage('Đã lưu hồ sơ admin thành công.');
        } catch (err) {
            setError(err?.message || 'Không thể lưu hồ sơ admin.');
        } finally {
            setSaving(false);
        }
    };

    const displayName = form.fullName || greetingName || 'Admin';
    const resolvedAvatar = withAvatarVersion(avatarPreview || form.avatarUrl || AVATAR_FALLBACK, user?.avatarUpdatedAt);

    return (
        <section className="admin-profile-shell">
            <div className="admin-profile-card">
                <div className="admin-profile-avatar-wrap">
                    <img
                        src={resolvedAvatar || AVATAR_FALLBACK}
                        alt={displayName}
                        className="admin-profile-avatar-image"
                        onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = AVATAR_FALLBACK;
                        }}
                    />
                </div>
                <div className="admin-profile-card-copy">
                    <h3>{displayName}</h3>
                    <p>{roleLabel}</p>
                    <small>Ảnh JPG/PNG/WEBP, dung lượng tối đa 5MB.</small>
                </div>
                <div className="admin-profile-card-actions">
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="d-none"
                        onChange={handleAvatarSelect}
                    />
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => avatarInputRef.current?.click()} disabled={!isEditing || uploadingAvatar}>
                        <Camera size={14} />
                        <span>Chọn ảnh</span>
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleAvatarUpload} disabled={!isEditing || !avatarFile || uploadingAvatar}>
                        {uploadingAvatar ? 'Đang tải...' : 'Cập nhật avatar'}
                    </button>
                    {avatarFile ? (
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => clearPendingAvatar()} disabled={!isEditing || uploadingAvatar}>
                            Bỏ chọn
                        </button>
                    ) : null}
                </div>
            </div>

            {error && <div className="alert alert-danger mb-3">{error}</div>}
            {message && <div className="alert alert-success mb-3">{message}</div>}
            {loading && <div className="alert alert-info mb-3">Đang tải thông tin hồ sơ...</div>}

            <div className="admin-profile-grid">
                <article className="admin-profile-item">
                    <span>Email</span>
                    <strong>{form.email || '-'}</strong>
                </article>
                <article className="admin-profile-item">
                    <span>Vai trò</span>
                    <strong>{roleLabel}</strong>
                </article>
                <article className="admin-profile-item">
                    <span>Ngày tạo tài khoản</span>
                    <strong>{formatDateTime(form.createdAt)}</strong>
                </article>
                <article className="admin-profile-item">
                    <span>Lần cập nhật gần nhất</span>
                    <strong>{formatDateTime(form.updatedAt)}</strong>
                </article>
                <article className="admin-profile-item">
                    <span>Số điện thoại</span>
                    <strong>{form.phone || '-'}</strong>
                </article>
                <article className="admin-profile-item">
                    <span>Thành phố</span>
                    <strong>{form.city || '-'}</strong>
                </article>
                <article className="admin-profile-item">
                    <span>Địa chỉ</span>
                    <strong>{form.address || '-'}</strong>
                </article>
                <article className="admin-profile-item">
                    <span>Trạng thái</span>
                    <strong className="admin-profile-status">
                        <ShieldCheck size={14} />
                        Đang hoạt động
                    </strong>
                </article>
            </div>

            <section className="admin-profile-form">
                <div className="admin-profile-form-head">
                    <div className="admin-profile-form-head-copy">
                        <h4>Hồ sơ admin</h4>
                        <p>Thông tin này sẽ hiển thị ở chip tài khoản và dropdown của khu vực quản trị.</p>
                    </div>
                    {!isEditing ? (
                        <button type="button" className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1" onClick={handleStartEditing}>
                            <PencilLine size={14} />
                            <span>Chỉnh sửa hồ sơ</span>
                        </button>
                    ) : (
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleCancelEditing} disabled={saving}>
                            Hủy chỉnh sửa
                        </button>
                    )}
                </div>

                <div className="admin-profile-form-grid">
                    <label className="admin-profile-field">
                        <span>Họ tên</span>
                        <input className="form-control" value={form.fullName} onChange={handleFieldChange('fullName')} disabled={!isEditing} />
                    </label>
                    <label className="admin-profile-field">
                        <span>Email</span>
                        <input className="form-control" value={form.email} readOnly disabled />
                    </label>
                    <label className="admin-profile-field">
                        <span>Số điện thoại</span>
                        <input className="form-control" value={form.phone} onChange={handleFieldChange('phone')} disabled={!isEditing} />
                    </label>
                    <label className="admin-profile-field">
                        <span>Thành phố</span>
                        <input className="form-control" value={form.city} onChange={handleFieldChange('city')} disabled={!isEditing} />
                    </label>
                    <label className="admin-profile-field admin-profile-field-span-2">
                        <span>Địa chỉ</span>
                        <input className="form-control" value={form.address} onChange={handleFieldChange('address')} disabled={!isEditing} />
                    </label>
                    <label className="admin-profile-field">
                        <span>Chức danh</span>
                        <input className="form-control" value={form.position} onChange={handleFieldChange('position')} disabled={!isEditing} />
                    </label>
                    <label className="admin-profile-field">
                        <span>Link cá nhân / Website</span>
                        <input className="form-control" value={form.personalLink} onChange={handleFieldChange('personalLink')} disabled={!isEditing} />
                    </label>
                </div>

                <div className="admin-profile-form-actions">
                    {isEditing ? (
                        <button type="button" className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
                            <Save size={14} className="me-2" />
                            {saving ? 'Đang lưu...' : 'Lưu hồ sơ admin'}
                        </button>
                    ) : (
                        <span className="admin-profile-form-hint">Nhấn "Chỉnh sửa hồ sơ" để thay đổi thông tin.</span>
                    )}
                </div>
            </section>

            <section className="admin-profile-settings">
                <div className="admin-profile-settings-head">
                    <p className="admin-profile-settings-kicker">Ứng dụng</p>
                    <h4>Cài đặt JobFinder</h4>
                    <p>Cài app để truy cập nhanh hơn và hoạt động ổn định khi mạng yếu.</p>
                </div>
                <InstallAppPanel />
            </section>
        </section>
    );
};

export default AdminProfilePage;
