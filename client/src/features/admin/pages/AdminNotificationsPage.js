import React from 'react';
import { Link } from 'react-router-dom';
import './AdminNotificationsPage.css';

const notificationItems = [
  {
    title: 'Tin nhắn mới từ ứng viên',
    description: 'Khi ứng viên gửi tin nhắn, hệ thống sẽ đẩy toast trong app và thông báo thiết bị nếu đã bật quyền.',
    icon: 'bi-chat-dots',
    accent: 'primary'
  },
  {
    title: 'Cảnh báo quản trị',
    description: 'Theo dõi báo cáo, template CV và hoạt động hệ thống từ dashboard quản trị.',
    icon: 'bi-shield-check',
    accent: 'warning'
  },
  {
    title: 'Trạng thái PWA',
    description: 'Ứng dụng đã sẵn sàng cho cài đặt trên điện thoại và hỗ trợ thông báo trình duyệt.',
    icon: 'bi-phone',
    accent: 'info'
  }
];

const AdminNotificationsPage = () => {
  return (
    <div className="admin-notifications-page">
      <section className="admin-notification-hero">
        <div>
          <span className="admin-notification-eyebrow">Trang quản trị</span>
          <h1>Thông báo hệ thống</h1>
          <p>
            Đây là nơi tập trung các tín hiệu quan trọng cho quản trị viên: thông báo hệ thống, trạng thái vận hành và truy cập nhanh đến khu vực cần kiểm tra.
          </p>
        </div>
        <Link className="btn btn-light admin-notification-hero-btn" to="/support">
          <i className="bi bi-life-preserver me-2"></i>
          Mở trung tâm thông báo
        </Link>
      </section>

      <section className="admin-notification-grid">
        {notificationItems.map((item) => (
          <article key={item.title} className="admin-notification-card">
            <div className={`admin-notification-icon ${item.accent}`}>
              <i className={`bi ${item.icon}`}></i>
            </div>
            <div>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="admin-notification-footer">
        <div>
          <h2>Liên kết nhanh</h2>
          <p>Đi thẳng đến các khu vực hay dùng trong quản trị.</p>
        </div>
        <div className="admin-notification-links">
          <Link to="/admin/dashboard" className="admin-notification-link">Dashboard</Link>
          <Link to="/admin/reports" className="admin-notification-link">Báo cáo</Link>
          <Link to="/admin/usersmanament" className="admin-notification-link">Người dùng</Link>
        </div>
      </section>
    </div>
  );
};

export default AdminNotificationsPage;
