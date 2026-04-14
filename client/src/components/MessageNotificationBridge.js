import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE as CLIENT_API_BASE } from '../config/apiBase';
import { useNotification } from './NotificationProvider';
import { showBrowserNotification, syncAppIconBadge } from './notificationUtils';

const parseUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const readAuthSnapshot = () => {
  const token = String(localStorage.getItem('token') || '').trim();
  const user = parseUser();
  return { token, user };
};

const resolveUserId = (user = {}) => user?.id || user?.MaNguoiDung || user?.userId || null;
const resolveRole = (user = {}) => String(user?.role || user?.vaiTro || user?.VaiTro || '').trim();

const MessageNotificationBridge = () => {
  const { notify } = useNotification();
  const API_BASE = CLIENT_API_BASE;
  const [authSnapshot, setAuthSnapshot] = useState(() => readAuthSnapshot());

  const token = String(authSnapshot?.token || '').trim();
  const user = useMemo(() => authSnapshot?.user || {}, [authSnapshot]);
  const currentUserId = resolveUserId(user);
  const role = resolveRole(user);
  const isEmployer = role === 'Nhà tuyển dụng';

  const lastSnapshotRef = useRef(new Map());
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    const syncAuthFromStorage = (event) => {
      const fallback = readAuthSnapshot();

      if (event?.detail && typeof event.detail === 'object') {
        setAuthSnapshot({
          token: fallback.token,
          user: event.detail
        });
        return;
      }

      setAuthSnapshot(fallback);
    };

    const intervalId = window.setInterval(() => {
      setAuthSnapshot((prev) => {
        const next = readAuthSnapshot();
        const prevUserId = resolveUserId(prev?.user || {});
        const nextUserId = resolveUserId(next.user || {});
        const prevRole = resolveRole(prev?.user || {});
        const nextRole = resolveRole(next.user || {});

        if (
          String(prev?.token || '') === String(next.token || '')
          && String(prevUserId || '') === String(nextUserId || '')
          && String(prevRole || '') === String(nextRole || '')
        ) {
          return prev;
        }
        return next;
      });
    }, 1200);

    window.addEventListener('storage', syncAuthFromStorage);
    window.addEventListener('jobfinder:user-updated', syncAuthFromStorage);
    window.addEventListener('jobfinder:auth-changed', syncAuthFromStorage);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('storage', syncAuthFromStorage);
      window.removeEventListener('jobfinder:user-updated', syncAuthFromStorage);
      window.removeEventListener('jobfinder:auth-changed', syncAuthFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!token || !currentUserId) {
      bootstrappedRef.current = false;
      lastSnapshotRef.current = new Map();
      window.dispatchEvent(new CustomEvent('jobfinder:messages-unread-updated', {
        detail: {
          unreadConversations: 0,
          inbox: []
        }
      }));
      void syncAppIconBadge(0);
      return undefined;
    }

    let cancelled = false;

    const fetchInbox = async () => {
      const response = await fetch(`${API_BASE}/api/messages/inbox`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.error || `Request failed (${response.status})`);
      }

      return Array.isArray(payload?.inbox) ? payload.inbox : [];
    };

    const emitNotification = async (conversation) => {
      const senderName = conversation?.name || 'Có người gửi tin nhắn';
      const content = String(conversation?.lastMessage || '').trim() || 'Bạn có tin nhắn mới.';
      const basePath = isEmployer ? '/employer/messages' : '/messages';
      const url = `${basePath}?userId=${encodeURIComponent(String(conversation?.userId || ''))}`;

      notify({
        type: 'info',
        mode: 'toast',
        title: 'Tin nhắn mới',
        message: `${senderName}: ${content}`
      });

      await showBrowserNotification({
        title: 'Tin nhắn mới trên JobFinder',
        body: `${senderName}: ${content}`,
        url,
        tag: `jobfinder-message-${conversation?.userId || 'global'}`
      });
    };

    const syncInbox = async ({ initial = false } = {}) => {
      const inbox = await fetchInbox();
      const nextSnapshot = new Map();
      let unreadConversations = 0;

      inbox.forEach((item) => {
        const userId = Number(item.userId);
        if (!Number.isFinite(userId)) return;

        const unread = Number(item.unread || 0);
        if (unread > 0) unreadConversations += 1;

        const lastAt = String(item.lastAt || '');
        nextSnapshot.set(userId, {
          unread,
          lastAt,
          lastMessage: String(item.lastMessage || '')
        });

        const previous = lastSnapshotRef.current.get(userId);
        const previousUnread = Number(previous?.unread || 0);
        const previousLastAt = String(previous?.lastAt || '');
        const shouldNotify = !initial && unread > 0 && (
          unread > previousUnread
          || (lastAt && lastAt !== previousLastAt)
        );

        if (shouldNotify) {
          void emitNotification(item);
        }
      });

      lastSnapshotRef.current = nextSnapshot;
      bootstrappedRef.current = true;

      if (!cancelled) {
        window.dispatchEvent(new CustomEvent('jobfinder:messages-unread-updated', {
          detail: {
            unreadConversations,
            inbox
          }
        }));
      }
      void syncAppIconBadge(unreadConversations);
    };

    syncInbox({ initial: true }).catch((err) => {
      if (!cancelled) {
        console.log('Message notification bootstrap skipped:', err?.message || err);
      }
    });

    const intervalId = window.setInterval(() => {
      syncInbox({ initial: !bootstrappedRef.current }).catch(() => {
        // silent polling; inbox failures should not interrupt the app
      });
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [API_BASE, currentUserId, isEmployer, notify, token]);

  return null;
};

export default MessageNotificationBridge;
