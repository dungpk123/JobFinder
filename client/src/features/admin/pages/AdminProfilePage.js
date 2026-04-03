import React from 'react';
import { ShieldCheck, UserRound } from 'lucide-react';

const AdminProfilePage = ({ user, roleLabel, greetingName }) => {
    return (
        <section className="admin-profile-shell">
            <div className="admin-profile-card">
                <div className="admin-profile-icon">
                    <UserRound size={22} />
                </div>
                <div>
                    <h3>{greetingName}</h3>
                    <p>{roleLabel}</p>
                </div>
            </div>

            <div className="admin-profile-grid">
                <article className="admin-profile-item">
                    <span>Họ tên</span>
                    <strong>{user?.full_name || user?.name || '-'}</strong>
                </article>
                <article className="admin-profile-item">
                    <span>Email</span>
                    <strong>{user?.email || '-'}</strong>
                </article>
                <article className="admin-profile-item">
                    <span>Vai trò</span>
                    <strong>{roleLabel}</strong>
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
