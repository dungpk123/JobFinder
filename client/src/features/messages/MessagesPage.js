import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { API_BASE as CLIENT_API_BASE } from '../../config/apiBase';
import './MessagesPage.css';

const MESSAGES_POLL_INTERVAL_MS = 6000;
const THREAD_SCROLL_BOTTOM_THRESHOLD_PX = 72;

const parseUserFromStorage = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const formatDateTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('vi-VN');
};

const MessagesPage = () => {
  const API_BASE = CLIENT_API_BASE;
  const location = useLocation();
  const threadRef = useRef(null);
  const pollInFlightRef = useRef(false);

  const token = String(localStorage.getItem('token') || '').trim();
  const user = useMemo(() => parseUserFromStorage(), []);
  const currentUserId = user?.id || user?.MaNguoiDung || user?.userId || null;

  const [inbox, setInbox] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [thread, setThread] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const activeUserId = Number(activeUser?.userId || 0) || null;

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const seededUserId = Number.parseInt(String(searchParams.get('userId') || ''), 10);
  const seededName = String(searchParams.get('name') || '').trim();
  const seededEmail = String(searchParams.get('email') || '').trim();

  const canSeedUser = Number.isFinite(seededUserId);

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || `Request failed (${response.status})`);
    }

    return payload;
  }, [API_BASE, token]);

  const scrollThreadBottom = useCallback(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, []);

  const isThreadNearBottom = useCallback(() => {
    const el = threadRef.current;
    if (!el) return true;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    return remaining <= THREAD_SCROLL_BOTTOM_THRESHOLD_PX;
  }, []);

  const hasThreadChanged = useCallback((prev, next) => {
    if (!Array.isArray(prev) || !Array.isArray(next)) return true;
    if (prev.length !== next.length) return true;

    const prevLast = prev[prev.length - 1];
    const nextLast = next[next.length - 1];
    if (!prevLast && !nextLast) return false;

    return (
      String(prevLast?.id || '') !== String(nextLast?.id || '')
      || String(prevLast?.createdAt || '') !== String(nextLast?.createdAt || '')
      || String(prevLast?.content || '') !== String(nextLast?.content || '')
    );
  }, []);

  const loadInbox = useCallback(async ({ silent = false } = {}) => {
    if (!token) {
      setInbox([]);
      return [];
    }

    if (!silent) setInboxLoading(true);
    try {
      const data = await apiFetch('/api/messages/inbox');
      const list = Array.isArray(data?.inbox) ? data.inbox : [];
      setInbox(list);
      return list;
    } finally {
      if (!silent) setInboxLoading(false);
    }
  }, [apiFetch, token]);

  const openConversation = useCallback(async (targetUser, { markRead = true, silent = false } = {}) => {
    if (!targetUser?.userId) return;

    const shouldAutoScroll = !silent || isThreadNearBottom();
    setActiveUser((prev) => (Number(prev?.userId || 0) === Number(targetUser.userId) ? prev : targetUser));
    if (!silent) setThreadLoading(true);

    try {
      const data = await apiFetch(`/api/messages/conversation/${targetUser.userId}`);
      const nextMessages = Array.isArray(data?.messages) ? data.messages : [];
      setThread((prev) => (hasThreadChanged(prev, nextMessages) ? nextMessages : prev));

      if (markRead) {
        await apiFetch(`/api/messages/mark-read/${targetUser.userId}`, { method: 'PATCH' });
        window.dispatchEvent(new Event('jobfinder:messages-force-refresh'));
      }

      if (shouldAutoScroll) {
        requestAnimationFrame(scrollThreadBottom);
      }
    } finally {
      if (!silent) setThreadLoading(false);
    }
  }, [apiFetch, hasThreadChanged, isThreadNearBottom, scrollThreadBottom]);

  const sendMessage = async () => {
    const content = String(input || '').trim();
    if (!content || !activeUser?.userId || sending) return;

    setSending(true);
    setError('');

    const optimistic = {
      id: `tmp-${Date.now()}`,
      fromUserId: currentUserId,
      toUserId: activeUser.userId,
      content,
      createdAt: new Date().toISOString(),
      read: true
    };

    setThread((prev) => [...prev, optimistic]);
    setInput('');
    requestAnimationFrame(scrollThreadBottom);

    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: activeUser.userId,
          content
        })
      });

      await openConversation(activeUser, { markRead: false, silent: true });
      await loadInbox({ silent: true });
      window.dispatchEvent(new Event('jobfinder:messages-force-refresh'));
    } catch (err) {
      setError(err?.message || 'Không thể gửi tin nhắn');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!token) {
        setError('Bạn cần đăng nhập để dùng tính năng nhắn tin.');
        setInitialLoading(false);
        return;
      }

      setInitialLoading(true);
      setError('');

      try {
        const inboxList = await loadInbox();
        if (cancelled) return;

        let nextUser = null;
        if (canSeedUser) {
          nextUser = inboxList.find((item) => Number(item.userId) === seededUserId) || {
            userId: seededUserId,
            name: seededName || `Ứng viên #${seededUserId}`,
            email: seededEmail,
            unread: 0,
            lastMessage: '',
            lastAt: ''
          };
        }

        if (!nextUser && inboxList.length > 0) {
          nextUser = inboxList[0];
        }

        if (nextUser) {
          await openConversation(nextUser, { markRead: true });
        } else {
          setThread([]);
          setActiveUser(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Không thể tải hộp thư');
          setInbox([]);
          setThread([]);
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [token, canSeedUser, seededUserId, seededName, seededEmail, loadInbox, openConversation]);

  useEffect(() => {
    if (!token) return undefined;

    const pollConversation = async () => {
      if (pollInFlightRef.current || document.hidden) return;
      pollInFlightRef.current = true;
      try {
        const refreshedInbox = await loadInbox({ silent: true });
        if (activeUser?.userId) {
          const candidate = refreshedInbox.find((item) => Number(item.userId) === Number(activeUser.userId)) || activeUser;
          const shouldMarkRead = Number(candidate?.unread || 0) > 0;
          await openConversation(candidate, { markRead: shouldMarkRead, silent: true });
        }
      } catch {
        // silent polling
      } finally {
        pollInFlightRef.current = false;
      }
    };

    const onFocus = () => {
      void pollConversation();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        void pollConversation();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    void pollConversation();

    const intervalId = window.setInterval(pollConversation, MESSAGES_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      pollInFlightRef.current = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [token, activeUser, activeUserId, loadInbox, openConversation]);

  return (
    <div className="messages-page">
      <div className="messages-page-header">
        <div>
          <h2 className="mb-1 employer-page-title">Tin nhắn tuyển dụng</h2>
          <p className="mb-0 text-muted">Trao đổi trực tiếp giữa nhà tuyển dụng và ứng viên.</p>
        </div>
        <Link className="btn btn-outline-primary" to="/employer/cv-search">
          <i className="bi bi-search me-2"></i>
          Tìm thêm ứng viên
        </Link>
      </div>

      <div className="card border-0 shadow-sm messages-shell">
        <div className="card-body p-0">
          {error ? <div className="alert alert-danger m-3 mb-0">{error}</div> : null}

          {initialLoading ? (
            <div className="messages-loading">Đang tải hộp thư...</div>
          ) : (
            <div className="row g-0 messages-layout">
              <aside className="col-lg-4 messages-inbox-col">
                <div className="messages-inbox-head">
                  <h5 className="mb-0">Hội thoại</h5>
                  {inboxLoading ? <small>Đang tải...</small> : <small>{inbox.length} liên hệ</small>}
                </div>

                <div className="messages-inbox-list">
                  {inbox.length === 0 ? (
                    <div className="messages-empty">Chưa có hội thoại nào</div>
                  ) : (
                    inbox.map((item) => (
                      <button
                        key={item.userId}
                        type="button"
                        className={`messages-inbox-item ${Number(activeUser?.userId) === Number(item.userId) ? 'active' : ''}`}
                        onClick={() => openConversation(item, { markRead: true })}
                      >
                        <div className="messages-inbox-item-top">
                          <strong>{item.name || item.email || `User #${item.userId}`}</strong>
                          {Number(item.unread || 0) > 0 ? <span className="messages-unread-pill">{item.unread}</span> : null}
                        </div>
                        <p className="mb-1">{item.lastMessage || 'Bắt đầu cuộc trò chuyện'}</p>
                        <small>{formatDateTime(item.lastAt)}</small>
                      </button>
                    ))
                  )}
                </div>
              </aside>

              <section className="col-lg-8 messages-thread-col">
                <div className="messages-thread-head">
                  {activeUser ? (
                    <>
                      <h5 className="mb-0">{activeUser.name || activeUser.email || `User #${activeUser.userId}`}</h5>
                      <small>{activeUser.email || ''}</small>
                    </>
                  ) : (
                    <>
                      <h5 className="mb-0">Chọn hội thoại</h5>
                      <small>Nhấn vào một ứng viên để bắt đầu nhắn tin</small>
                    </>
                  )}
                </div>

                <div className="messages-thread-body" ref={threadRef}>
                  {!activeUser ? (
                    <div className="messages-empty">Hãy chọn một hội thoại ở cột bên trái</div>
                  ) : threadLoading ? (
                    <div className="messages-empty">Đang tải tin nhắn...</div>
                  ) : thread.length === 0 ? (
                    <div className="messages-empty">Chưa có tin nhắn. Hãy gửi lời chào đầu tiên.</div>
                  ) : (
                    thread.map((item) => {
                      const isMine = String(item.fromUserId) === String(currentUserId);
                      return (
                        <div key={item.id} className={`messages-row ${isMine ? 'mine' : 'other'}`}>
                          <div className="messages-bubble-wrap">
                            <div className="messages-bubble">{item.content}</div>
                            <div className="messages-time">{formatDateTime(item.createdAt)}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="messages-thread-input">
                  <input
                    type="text"
                    className="form-control"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={activeUser ? 'Nhập nội dung tin nhắn...' : 'Chọn hội thoại để nhắn tin'}
                    disabled={!activeUser || sending}
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={sendMessage}
                    disabled={!activeUser || !String(input || '').trim() || sending}
                  >
                    {sending ? 'Đang gửi...' : 'Gửi'}
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
