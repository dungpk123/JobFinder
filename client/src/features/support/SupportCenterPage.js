import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestBrowserNotificationPermission } from '../../components/notificationUtils';
import { useNotification } from '../../components/NotificationProvider';
import './SupportCenterPage.css';

const supportCards = [
  {
    icon: 'bi-envelope-paper',
    title: 'Email hỗ trợ',
    description: 'support@jobfinder.vn',
    href: 'mailto:support@jobfinder.vn'
  },
  {
    icon: 'bi-telephone',
    title: 'Hotline',
    description: '1900 1234',
    href: 'tel:19001234'
  },
  {
    icon: 'bi-chat-dots',
    title: 'Nhắn tin nhanh',
    description: 'Trao đổi trực tiếp với ứng viên và nhà tuyển dụng',
    href: '/messages'
  }
];

const quickLinks = [
  { label: 'Tìm việc làm', to: '/jobs', icon: 'bi-search' },
  { label: 'Mẫu CV', to: '/create-cv/templates', icon: 'bi-file-earmark-text' },
  { label: 'Cẩm nang nghề nghiệp', to: '/career-guide', icon: 'bi-journal-text' },
  { label: 'Hộp thư', to: '/messages', icon: 'bi-inbox' }
];

const supportTopics = [
  {
    title: 'Không nhận được thông báo?',
    text: 'Bật quyền thông báo của trình duyệt và cho phép JobFinder gửi thông báo thiết bị.'
  },
  {
    title: 'Tin nhắn mới không hiện?',
    text: 'Kiểm tra kết nối mạng, đăng nhập đúng tài khoản và mở lại hộp thư.'
  },
  {
    title: 'Cần hỗ trợ tài khoản?',
    text: 'Liên hệ bộ phận hỗ trợ qua email hoặc gọi hotline trong giờ làm việc.'
  }
];

const SupportCenterPage = () => {
  const { notify } = useNotification();
  const [permissionState, setPermissionState] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermissionState(Notification.permission);
    }
  }, []);

  const handleEnableNotifications = async () => {
    const result = await requestBrowserNotificationPermission();
    setPermissionState(result.permission);

    if (result.permission === 'granted') {
      notify({ type: 'success', mode: 'toast', title: 'Đã bật thông báo', message: 'JobFinder sẽ hiển thị thông báo trên thiết bị của bạn.' });
      return;
    }

    if (result.permission === 'denied') {
      notify({ type: 'warning', mode: 'toast', title: 'Chưa bật được thông báo', message: 'Hãy cho phép thông báo trong cài đặt trình duyệt hoặc thiết bị.' });
    }
  };

  return (
    <div className="support-center-page">
      <section className="support-hero">
        <div className="support-hero-copy">
          <span className="support-eyebrow">Hỗ trợ và thông báo</span>
          <h1>Trung tâm hỗ trợ kiểu job board hiện đại</h1>
          <p>
            Giữ liên lạc giữa ứng viên và nhà tuyển dụng, bật thông báo hệ thống, và tìm nhanh các kênh hỗ trợ quan trọng.
          </p>
          <div className="support-hero-actions">
            <button type="button" className="btn btn-primary support-primary-btn" onClick={handleEnableNotifications}>
              <i className="bi bi-bell me-2"></i>
              {permissionState === 'granted' ? 'Thông báo đã bật' : 'Bật thông báo thiết bị'}
            </button>
            <Link to="/messages" className="btn btn-outline-light support-secondary-btn">
              <i className="bi bi-chat-dots me-2"></i>
              Mở hộp thư
            </Link>
          </div>
        </div>

        <div className="support-hero-panel">
          <div className="support-status-card">
            <div>
              <small>Trạng thái thông báo</small>
              <strong>{permissionState === 'granted' ? 'Đang hoạt động' : permissionState === 'denied' ? 'Đã từ chối' : 'Chưa cấp quyền'}</strong>
            </div>
            <i className="bi bi-phone"></i>
          </div>
          <div className="support-mini-list">
            <div><i className="bi bi-check2-circle"></i> Đồng bộ tin nhắn giữa web và PWA</div>
            <div><i className="bi bi-check2-circle"></i> Toast trong app + thông báo hệ thống</div>
            <div><i className="bi bi-check2-circle"></i> Giao diện hỗ trợ đồng nhất với web việc làm</div>
          </div>
        </div>
      </section>

      <section className="support-grid">
        {supportCards.map((card) => (
          card.href.startsWith('/') ? (
            <Link key={card.title} to={card.href} className="support-card">
              <span className="support-card-icon"><i className={`bi ${card.icon}`}></i></span>
              <strong>{card.title}</strong>
              <p>{card.description}</p>
            </Link>
          ) : (
            <a key={card.title} href={card.href} className="support-card">
              <span className="support-card-icon"><i className={`bi ${card.icon}`}></i></span>
              <strong>{card.title}</strong>
              <p>{card.description}</p>
            </a>
          )
        ))}
      </section>

      <section className="support-content-grid">
        <div className="support-panel">
          <div className="support-panel-head">
            <h2>Hỗ trợ nhanh</h2>
            <span>Liên kết ngắn, đúng việc</span>
          </div>
          <div className="support-link-list">
            {quickLinks.map((item) => (
              <Link key={item.label} to={item.to} className="support-link-item">
                <i className={`bi ${item.icon}`}></i>
                <span>{item.label}</span>
                <i className="bi bi-arrow-right-short"></i>
              </Link>
            ))}
          </div>
        </div>

        <div className="support-panel">
          <div className="support-panel-head">
            <h2>Câu hỏi thường gặp</h2>
            <span>Chủ đề theo luồng sử dụng</span>
          </div>
          <div className="support-topic-list">
            {supportTopics.map((topic) => (
              <article key={topic.title} className="support-topic-item">
                <h3>{topic.title}</h3>
                <p>{topic.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="support-notice-band">
        <div>
          <span className="support-band-label">Thông báo hệ thống</span>
          <h2>Nhận thông báo giống message ngay trên máy</h2>
          <p>
            Khi có tin nhắn mới, JobFinder sẽ hiển thị toast trong app và, nếu bạn đã bật quyền, hiển thị thông báo hệ thống trên trình duyệt/PWA.
          </p>
        </div>
        <Link to="/messages" className="btn btn-light support-band-btn">
          Xem tin nhắn
        </Link>
      </section>
    </div>
  );
};

export default SupportCenterPage;
