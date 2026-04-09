import { useEffect, useMemo, useRef } from 'react';
import { API_BASE as CLIENT_API_BASE } from '../config/apiBase';
import { useNotification } from './NotificationProvider';
import { showBrowserNotification } from './notificationUtils';

const parseUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const MessageNotificationBridge = () => {
  const { notify } = useNotification();
  const API_BASE = CLIENT_API_BASE;
  const token = String(localStorage.getItem('token') || '').trim();
  const user = useMemo(() => parseUser(), []);
  const currentUserId = user?.id || user?.MaNguoiDung || user?.userId || null;
  const role = String(user?.role || user?.vaiTro || '').trim();
  const isEmployer = role === 'Nhà tuyển dụng';

  const lastSnapshotRef = useRef(new Map());
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!token || !currentUserId) {
      bootstrappedRef.current = false;
      lastSnapshotRef.current = new Map();
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

      inbox.forEach((item) => {
        const userId = Number(item.userId);
        if (!Number.isFinite(userId)) return;

        const unread = Number(item.unread || 0);
        nextSnapshot.set(userId, {
          unread,
          lastAt: String(item.lastAt || ''),
          lastMessage: String(item.lastMessage || '')
        });

        const previous = lastSnapshotRef.current.get(userId);
        if (!initial && previous && unread > previous.unread) {
          void emitNotification(item);
        }
      });

      lastSnapshotRef.current = nextSnapshot;
      bootstrappedRef.current = true;
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
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [API_BASE, currentUserId, isEmployer, notify, token]);

  return null;
};

export default MessageNotificationBridge;
