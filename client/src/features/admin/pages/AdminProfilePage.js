import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, UserRound } from 'lucide-react';

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
    createdAt: user?.createdAt || '',
    updatedAt: user?.updatedAt || ''
});

const AdminProfilePage = ({ user, roleLabel, greetingName }) => {
    const userId = useMemo(() => resolveUserId(user), [user]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState(() => buildInitialForm(user));

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

            try {
                const response = await fetch(`/users/profile/${userId}`);
                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data?.success) {
                    throw new Error(data?.error || 'Không tải được thông tin cá nhân admin.');
                }

                if (cancelled) return;

                const profile = data.profile || {};
                setForm({
                    fullName: profile.fullName || '',
                    email: profile.email || '',
                    phone: profile.phone || '',
                    city: profile.city || '',
                    address: profile.address || '',
                    position: profile.position || '',
                    personalLink: profile.personalLink || '',
                    createdAt: profile.createdAt || '',
                    updatedAt: profile.updatedAt || ''
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
    }, [userId]);

    const displayName = form.fullName || greetingName || 'Admin';

    return (
        <section className="admin-profile-shell">
            <div className="admin-profile-card">
                <div className="admin-profile-icon">
                    <UserRound size={22} />
                </div>
                <div>
                    <h3>{displayName}</h3>
                    <p>{roleLabel}</p>
                </div>
            </div>

            {error && <div className="alert alert-danger mb-3">{error}</div>}
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
        </section>
    );
};

export default AdminProfilePage;
