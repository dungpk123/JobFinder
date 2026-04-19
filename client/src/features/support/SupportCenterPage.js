import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestBrowserNotificationPermission } from '../../components/notificationUtils';
import { useNotification } from '../../components/NotificationProvider';
import { API_BASE as CLIENT_API_BASE } from '../../config/apiBase';
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

const FEED_TYPE_LABELS = {
  message: 'Tin nhắn',
  'application-received': 'Ứng tuyển',
  'application-accepted': 'Đã nhận',
  'application-update': 'Hồ sơ',
  'application-review': 'Xem xét',
  'application-offer': 'Đề nghị',
  'application-rejected': 'Từ chối',
  'interview-invite': 'Phỏng vấn',
  'company-comment': 'Bình luận',
  'company-rating': 'Đánh giá'
};

const trimText = (value, max = 180) => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
};

const normalizeRoleName = (user) => normalizeText(
  user?.role
  || user?.VaiTro
  || user?.vaiTro
  || user?.LoaiNguoiDung
  || ''
);

const resolveCandidateStatusMeta = (statusValue) => {
  const normalized = normalizeText(statusValue);
  if (normalized === 'phong van') {
    return {
      type: 'interview-invite',
      title: 'Bạn có lịch phỏng vấn mới',
      label: FEED_TYPE_LABELS['interview-invite']
    };
  }
  if (normalized === 'da nhan') {
    return {
      type: 'application-accepted',
      title: 'Đơn ứng tuyển đã được chấp nhận',
      label: FEED_TYPE_LABELS['application-accepted']
    };
  }
  if (normalized === 'dang xem xet') {
    return {
      type: 'application-review',
      title: 'Nhà tuyển dụng đang xem xét hồ sơ',
      label: FEED_TYPE_LABELS['application-review']
    };
  }
  if (normalized === 'de nghi') {
    return {
      type: 'application-offer',
      title: 'Bạn nhận được đề nghị mới',
      label: FEED_TYPE_LABELS['application-offer']
    };
  }
  if (normalized === 'tu choi') {
    return {
      type: 'application-rejected',
      title: 'Đơn ứng tuyển đã bị từ chối',
      label: FEED_TYPE_LABELS['application-rejected']
    };
  }
  return {
    type: 'application-update',
    title: 'Hồ sơ ứng tuyển có cập nhật mới',
    label: FEED_TYPE_LABELS['application-update']
  };
};

const buildFeedTypeLabel = (type) => FEED_TYPE_LABELS[type] || 'Thông báo';

const buildMessageLink = (normalizedRole) => {
  if (normalizedRole === 'nha tuyen dung') return '/employer/messages';
  if (normalizedRole === 'ung vien') return '/messages';
  return '/login';
};

const SupportCenterPage = () => {
  const API_BASE = CLIENT_API_BASE;
  const { notify } = useNotification();
  const [currentUser, setCurrentUser] = useState(() => readStoredUser());
  const [token, setToken] = useState(() => String(localStorage.getItem('token') || '').trim());
  const [permissionState, setPermissionState] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [notificationFeed, setNotificationFeed] = useState([]);

  const normalizedRole = normalizeRoleName(currentUser);
  const messageLink = buildMessageLink(normalizedRole);
  const canReadPrivateNotifications = normalizedRole === 'nha tuyen dung' || normalizedRole === 'ung vien';
  const isLoggedIn = Boolean(token);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermissionState(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
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
    let loadingInFlight = false;
    let intervalId = null;

    const loadNotifications = async () => {
      if (loadingInFlight) return;

      if (!token || !canReadPrivateNotifications) {
        setNotificationFeed([]);
        setFeedError('');
        setFeedLoading(false);
        return;
      }

      loadingInFlight = true;
      setFeedLoading(true);
      setFeedError('');

      try {
        const headers = { Authorization: `Bearer ${token}` };

        const inboxPromise = fetch(`${API_BASE}/api/messages/inbox`, { headers })
          .then(async (response) => {
            if (!response.ok) return { success: false, inbox: [] };
            return response.json().catch(() => ({ success: false, inbox: [] }));
          })
          .catch(() => ({ success: false, inbox: [] }));

        const applicationsPromise = normalizedRole === 'ung vien'
          ? fetch(`${API_BASE}/applications/mine`, { headers })
            .then(async (response) => {
              if (!response.ok) return [];
              return response.json().catch(() => []);
            })
            .catch(() => [])
          : normalizedRole === 'nha tuyen dung'
            ? fetch(`${API_BASE}/applications`, { headers })
              .then(async (response) => {
                if (!response.ok) return [];
                return response.json().catch(() => []);
              })
              .catch(() => [])
            : Promise.resolve([]);

        const employerReviewPromise = normalizedRole === 'nha tuyen dung'
          ? fetch(`${API_BASE}/api/companies/me/reviews`, { headers })
            .then(async (response) => {
              if (!response.ok) return { success: false, comments: [], recentRatings: [] };
              return response.json().catch(() => ({ success: false, comments: [], recentRatings: [] }));
            })
            .catch(() => ({ success: false, comments: [], recentRatings: [] }))
          : Promise.resolve({ success: false, comments: [], recentRatings: [] });

        const [inboxPayload, applicationsPayload, employerReviewPayload] = await Promise.all([
          inboxPromise,
          applicationsPromise,
          employerReviewPromise
        ]);
        if (cancelled) return;

        const inboxRows = Array.isArray(inboxPayload?.inbox) ? inboxPayload.inbox : [];
        const messageNotifications = inboxRows
          .map((row, index) => ({
            id: `msg-${row?.userId || index}`,
            type: 'message',
            typeLabel: buildFeedTypeLabel('message'),
            title: Number(row?.unread || 0) > 0
              ? `Bạn có ${Number(row?.unread || 0)} tin nhắn mới từ ${row?.name || 'Người dùng'}`
              : `Tin nhắn mới từ ${row?.name || 'Người dùng'}`,
            description: String(row?.lastMessage || 'Bạn có tin nhắn mới.').trim() || 'Bạn có tin nhắn mới.',
            createdAt: row?.lastAt || '',
            timestamp: toTimestamp(row?.lastAt),
            badgeCount: Number(row?.unread || 0),
            actionLabel: 'Mở hội thoại',
            actionTo: messageLink
          }));

        const appRows = Array.isArray(applicationsPayload) ? applicationsPayload : [];
        const candidateApplicationNotifications = normalizedRole === 'ung vien'
          ? appRows
            .map((row, index) => {
              const statusMeta = resolveCandidateStatusMeta(row?.TrangThai || row?.status);
              const statusText = String(row?.TrangThai || row?.status || '').trim();
              const companyName = String(row?.TenCongTy || 'Nhà tuyển dụng').trim() || 'Nhà tuyển dụng';
              const jobTitle = String(row?.TieuDe || 'vị trí đã ứng tuyển').trim() || 'vị trí đã ứng tuyển';
              return {
                id: `candidate-app-${row?.MaUngTuyen || row?.MaTin || index}`,
                type: statusMeta.type,
                typeLabel: statusMeta.label,
                title: statusMeta.title,
                description: `${companyName} cập nhật hồ sơ cho vị trí ${jobTitle}${statusText ? ` (${statusText})` : ''}.`,
                createdAt: row?.NgayNop || '',
                timestamp: toTimestamp(row?.NgayNop),
                badgeCount: 0,
                actionLabel: 'Xem chi tiết hồ sơ',
                actionTo: '/jobs/applied'
              };
            })
          : [];

        const employerApplicationNotifications = normalizedRole === 'nha tuyen dung'
          ? appRows
            .map((row, index) => {
              const candidateName = String(row?.TenUngVien || 'Ứng viên').trim() || 'Ứng viên';
              const jobTitle = String(row?.TieuDe || 'tin tuyển dụng').trim() || 'tin tuyển dụng';
              const statusText = String(row?.TrangThai || '').trim();
              return {
                id: `employer-app-${row?.MaUngTuyen || row?.MaTin || index}`,
                type: 'application-received',
                typeLabel: buildFeedTypeLabel('application-received'),
                title: `Hồ sơ ứng tuyển mới cho ${jobTitle}`,
                description: `${candidateName} vừa nộp hồ sơ${statusText ? ` (${statusText})` : ''}.`,
                createdAt: row?.NgayNop || '',
                timestamp: toTimestamp(row?.NgayNop),
                badgeCount: 0,
                actionLabel: 'Xem hồ sơ',
                actionTo: '/employer/applications'
              };
            })
          : [];

        const commentRows = Array.isArray(employerReviewPayload?.comments) ? employerReviewPayload.comments : [];
        const companyCommentNotifications = normalizedRole === 'nha tuyen dung'
          ? commentRows.map((row, index) => {
            const author = String(row?.userName || 'Ứng viên').trim() || 'Ứng viên';
            return {
              id: `company-comment-${row?.id || index}`,
              type: 'company-comment',
              typeLabel: buildFeedTypeLabel('company-comment'),
              title: 'Bình luận mới về công ty',
              description: `${author}: ${trimText(row?.content || 'Có bình luận mới về công ty của bạn.', 160)}`,
              createdAt: row?.createdAt || '',
              timestamp: toTimestamp(row?.createdAt),
              badgeCount: 0,
              actionLabel: 'Xem hồ sơ công ty',
              actionTo: '/employer/company'
            };
          })
          : [];

        const ratingRows = Array.isArray(employerReviewPayload?.recentRatings) ? employerReviewPayload.recentRatings : [];
        const companyRatingNotifications = normalizedRole === 'nha tuyen dung'
          ? ratingRows.map((row, index) => {
            const stars = Number(row?.stars || 0);
            const author = String(row?.userName || 'Ứng viên').trim() || 'Ứng viên';
            return {
              id: `company-rating-${row?.id || index}`,
              type: 'company-rating',
              typeLabel: buildFeedTypeLabel('company-rating'),
              title: `Công ty nhận thêm đánh giá ${stars > 0 ? `${stars}/5 sao` : 'mới'}`,
              description: `${author} vừa gửi đánh giá cho công ty của bạn.`,
              createdAt: row?.createdAt || '',
              timestamp: toTimestamp(row?.createdAt),
              badgeCount: 0,
              actionLabel: 'Xem hồ sơ công ty',
              actionTo: '/employer/company'
            };
          })
          : [];

        const merged = [
          ...messageNotifications,
          ...candidateApplicationNotifications,
          ...employerApplicationNotifications,
          ...companyCommentNotifications,
          ...companyRatingNotifications
        ]
          .sort((a, b) => (b.timestamp - a.timestamp));

        setNotificationFeed(merged.slice(0, 80));
      } catch (error) {
        if (!cancelled) {
          setFeedError(error?.message || 'Không thể tải danh sách thông báo.');
          setNotificationFeed([]);
        }
      } finally {
        loadingInFlight = false;
        if (!cancelled) {
          setFeedLoading(false);
        }
      }
    };

    loadNotifications();

    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications();
      }
    };

    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications();
      }
    };

    if (typeof window !== 'undefined') {
      intervalId = window.setInterval(loadNotifications, 15000);
      window.addEventListener('focus', refreshOnFocus);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', refreshOnVisible);
    }

    return () => {
      cancelled = true;
      if (intervalId && typeof window !== 'undefined') {
        window.clearInterval(intervalId);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', refreshOnFocus);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', refreshOnVisible);
      }
    };
  }, [API_BASE, canReadPrivateNotifications, messageLink, normalizedRole, token]);

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
      <section className="support-hero support-hero--single">
        <div className="support-hero-copy">
          <span className="support-eyebrow">Thông báo</span>
          <h1>Trung tâm thông báo kiểu job board hiện đại</h1>
          <p>
            Theo dõi toàn bộ thông báo trên JobFinder: tin nhắn, ứng tuyển, lịch phỏng vấn, đánh giá và bình luận công ty.
          </p>
          <div className="support-hero-actions">
            <button type="button" className="btn btn-primary support-primary-btn" onClick={handleEnableNotifications}>
              <i className="bi bi-bell me-2"></i>
              {permissionState === 'granted' ? 'Thông báo đã bật' : 'Bật thông báo thiết bị'}
            </button>
          </div>
        </div>
      </section>

      <section className="support-content-grid support-content-grid--single">
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
              <p>Khi có tin nhắn, cập nhật hồ sơ ứng tuyển, lịch phỏng vấn, đánh giá hoặc bình luận công ty, hệ thống sẽ hiển thị tại đây.</p>
            </div>
          ) : null}

          {canReadPrivateNotifications && !feedLoading && !feedError && notificationFeed.length > 0 ? (
            <div className="support-feed-list">
              {notificationFeed.map((item) => (
                <article key={item.id} className="support-feed-item">
                  <div className="support-feed-meta">
                    <span className={`support-feed-type ${item.type}`}>
                      {item.typeLabel || buildFeedTypeLabel(item.type)}
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
