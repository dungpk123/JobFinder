import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestBrowserNotificationPermission } from '../../components/notificationUtils';
import { useNotification } from '../../components/NotificationProvider';
import './SupportCenterPage.css';

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLowerCase()
  .trim();

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const formatDateTime = (value) => {
  if (!value) return 'Vừa xong';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Vừa xong';
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const ACCEPTED_APPLICATION_STATUSES = new Set(['da nhan']);

const buildMessageLink = (normalizedRole) => {
  if (normalizedRole === 'nha tuyen dung') return '/employer/messages';
  if (normalizedRole === 'ung vien') return '/messages';
  return '/login';
};

const quickLinks = [
  { label: 'Tìm việc làm', to: '/jobs', icon: 'bi-search' },
  { label: 'Mẫu CV', to: '/create-cv/templates', icon: 'bi-file-earmark-text' },
  { label: 'Việc đã ứng tuyển', to: '/jobs/applied', icon: 'bi-file-earmark-check' },
  { label: 'Cẩm nang nghề nghiệp', to: '/career-guide', icon: 'bi-journal-text' }
];

const SupportCenterPage = () => {
  const { notify } = useNotification();
  const [currentUser, setCurrentUser] = useState(() => readStoredUser());
  const [token, setToken] = useState(() => String(localStorage.getItem('token') || '').trim());
  const [permissionState, setPermissionState] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [notificationFeed, setNotificationFeed] = useState([]);

  const normalizedRole = normalizeText(
    currentUser?.role
    || currentUser?.VaiTro
    || currentUser?.vaiTro
    || currentUser?.LoaiNguoiDung
    || ''
  );
  const messageLink = buildMessageLink(normalizedRole);
  const canReadPrivateNotifications = normalizedRole === 'nha tuyen dung' || normalizedRole === 'ung vien';
  const isLoggedIn = Boolean(token);

  const unreadMessageCount = notificationFeed
    .filter((item) => item.type === 'message')
    .reduce((sum, item) => sum + Number(item.badgeCount || 0), 0);

  const acceptedApplicationCount = notificationFeed
    .filter((item) => item.type === 'application-accepted')
    .length;

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermissionState(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const syncAuth = (event) => {
      if (event?.detail && typeof event.detail === 'object') {
        setCurrentUser(event.detail);
      } else {
        setCurrentUser(readStoredUser());
      }
      setToken(String(localStorage.getItem('token') || '').trim());
    };

    window.addEventListener('storage', syncAuth);
    window.addEventListener('jobfinder:user-updated', syncAuth);

    return () => {
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener('jobfinder:user-updated', syncAuth);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadNotifications = async () => {
      if (!token || !canReadPrivateNotifications) {
        setNotificationFeed([]);
        setFeedError('');
        setFeedLoading(false);
        return;
      }

      setFeedLoading(true);
      setFeedError('');

      try {
        const headers = { Authorization: `Bearer ${token}` };

        const inboxPromise = fetch('/messages/inbox', { headers })
          .then(async (response) => {
            if (!response.ok) return { success: false, inbox: [] };
            return response.json().catch(() => ({ success: false, inbox: [] }));
          })
          .catch(() => ({ success: false, inbox: [] }));

        const applicationsPromise = normalizedRole === 'ung vien'
          ? fetch('/applications/mine', { headers })
            .then(async (response) => {
              if (!response.ok) return [];
              return response.json().catch(() => []);
            })
            .catch(() => [])
          : Promise.resolve([]);

        const [inboxPayload, applicationsPayload] = await Promise.all([inboxPromise, applicationsPromise]);
        if (cancelled) return;

        const inboxRows = Array.isArray(inboxPayload?.inbox) ? inboxPayload.inbox : [];
        const messageNotifications = inboxRows
          .filter((row) => Number(row?.unread || 0) > 0)
          .map((row, index) => ({
            id: `msg-${row?.userId || index}`,
            type: 'message',
            title: `Tin nhắn mới từ ${row?.name || 'Người dùng'}`,
            description: String(row?.lastMessage || 'Bạn có tin nhắn mới.').trim() || 'Bạn có tin nhắn mới.',
            createdAt: row?.lastAt || '',
            timestamp: toTimestamp(row?.lastAt),
            badgeCount: Number(row?.unread || 0),
            actionLabel: 'Mở hội thoại',
            actionTo: messageLink
          }));

        const appRows = Array.isArray(applicationsPayload) ? applicationsPayload : [];
        const acceptedNotifications = normalizedRole === 'ung vien'
          ? appRows
            .filter((row) => ACCEPTED_APPLICATION_STATUSES.has(normalizeText(row?.TrangThai || row?.status)))
            .map((row, index) => ({
              id: `accepted-${row?.MaUngTuyen || index}`,
              type: 'application-accepted',
              title: 'Đơn ứng tuyển đã được chấp nhận',
              description: `${row?.TenCongTy || 'Nhà tuyển dụng'} đã chấp nhận hồ sơ của bạn cho vị trí ${row?.TieuDe || 'đã ứng tuyển'}.`,
              createdAt: row?.NgayNop || '',
              timestamp: toTimestamp(row?.NgayNop),
              badgeCount: 0,
              actionLabel: 'Xem chi tiết',
              actionTo: row?.MaTin ? `/jobs/${row.MaTin}` : '/jobs/applied'
            }))
          : [];

        const merged = [...messageNotifications, ...acceptedNotifications]
          .sort((a, b) => (b.timestamp - a.timestamp));

        setNotificationFeed(merged);
      } catch (error) {
        if (!cancelled) {
          setFeedError(error?.message || 'Không thể tải danh sách thông báo.');
          setNotificationFeed([]);
        }
      } finally {
        if (!cancelled) {
          setFeedLoading(false);
        }
      }
    };

    loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [canReadPrivateNotifications, messageLink, normalizedRole, token]);

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
          <span className="support-eyebrow">Thông báo</span>
          <h1>Trung tâm thông báo kiểu job board hiện đại</h1>
          <p>
            Giữ liên lạc giữa ứng viên và nhà tuyển dụng, bật thông báo hệ thống, và theo dõi các kênh liên hệ quan trọng.
          </p>
          <div className="support-hero-actions">
            <button type="button" className="btn btn-primary support-primary-btn" onClick={handleEnableNotifications}>
              <i className="bi bi-bell me-2"></i>
              {permissionState === 'granted' ? 'Thông báo đã bật' : 'Bật thông báo thiết bị'}
            </button>
            <Link to={messageLink} className="btn btn-outline-light support-secondary-btn">
              <i className="bi bi-chat-dots me-2"></i>
              Mở trang tin nhắn
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
            <div><i className="bi bi-check2-circle"></i> Tin nhắn chưa đọc: {unreadMessageCount}</div>
            <div><i className="bi bi-check2-circle"></i> Hồ sơ được chấp nhận: {acceptedApplicationCount}</div>
            <div><i className="bi bi-check2-circle"></i> Tổng thông báo mới: {notificationFeed.length}</div>
          </div>
        </div>
      </section>

      <section className="support-content-grid">
        <div className="support-panel">
          <div className="support-panel-head">
            <h2>Thông báo mới</h2>
            <span>{notificationFeed.length} mục</span>
          </div>

          {canReadPrivateNotifications && feedLoading ? <div className="support-state-inline">Đang tải thông báo...</div> : null}
          {canReadPrivateNotifications && feedError ? <div className="alert alert-danger mb-0">{feedError}</div> : null}

          {!isLoggedIn ? (
            <div className="support-empty-state">
              <h3>Đăng nhập để xem thông báo cá nhân</h3>
              <p>Trang này hiển thị thông báo theo tài khoản, bao gồm tin nhắn mới và trạng thái hồ sơ ứng tuyển.</p>
              <Link to="/login" className="btn btn-primary">Đăng nhập</Link>
            </div>
          ) : null}

          {isLoggedIn && !canReadPrivateNotifications ? (
            <div className="support-empty-state">
              <h3>Thông báo cá nhân khả dụng cho ứng viên và nhà tuyển dụng</h3>
              <p>Tài khoản hiện tại vẫn nhận được thông báo hệ thống trong ứng dụng, nhưng không có hộp thư ứng tuyển riêng trên màn hình này.</p>
            </div>
          ) : null}

          {canReadPrivateNotifications && !feedLoading && !feedError && notificationFeed.length === 0 ? (
            <div className="support-empty-state">
              <h3>Chưa có thông báo mới</h3>
              <p>Khi có tin nhắn mới hoặc hồ sơ ứng tuyển được nhà tuyển dụng chấp nhận, hệ thống sẽ hiển thị tại đây.</p>
            </div>
          ) : null}

          {canReadPrivateNotifications && !feedLoading && !feedError && notificationFeed.length > 0 ? (
            <div className="support-feed-list">
              {notificationFeed.map((item) => (
                <article key={item.id} className="support-feed-item">
                  <div className="support-feed-meta">
                    <span className={`support-feed-type ${item.type}`}>
                      {item.type === 'message' ? 'Tin nhắn mới' : 'Đơn đã chấp nhận'}
                    </span>
                    <span className="support-feed-time">{formatDateTime(item.createdAt)}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="support-feed-actions">
                    {item.badgeCount > 0 ? <span className="support-feed-badge">+{item.badgeCount}</span> : null}
                    <Link to={item.actionTo} className="support-feed-action">{item.actionLabel}</Link>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <div className="support-panel">
          <div className="support-panel-head">
            <h2>Liên kết nhanh</h2>
            <span>Đi đến tính năng thường dùng</span>
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
      </section>

      <section className="support-notice-band">
        <div>
          <span className="support-band-label">Thông báo hệ thống</span>
          <h2>Nhận thông báo khi có cập nhật quan trọng</h2>
          <p>
            Khi có tin nhắn mới hoặc hồ sơ được duyệt, JobFinder sẽ hiển thị toast trong ứng dụng và thông báo thiết bị nếu bạn đã cấp quyền.
          </p>
        </div>
        <Link to={messageLink} className="btn btn-light support-band-btn">
          Mở thông báo
        </Link>
      </section>
    </div>
  );
};

export default SupportCenterPage;
