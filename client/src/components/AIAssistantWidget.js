import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNotification } from './NotificationProvider';
import './AIAssistantWidget.css';
import { useNavigate } from 'react-router-dom';

const getUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    return user?.id || user?.MaNguoiDung || user?.maNguoiDung || user?.userId || user?.userID || null;
  } catch {
    return null;
  }
};

const getToken = () => {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

const AIAssistantWidget = () => {
  const { notify } = useNotification();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [pillExpanded, setPillExpanded] = useState(true);

  const [chatOpen, setChatOpen] = useState(false);
  const [unreadConversations, setUnreadConversations] = useState(0);
  const [inbox, setInbox] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Mình là AI hỗ trợ JobFinder. Bạn có thể hỏi về cách dùng website (bấm ở đâu, tìm việc, tạo CV, tài khoản...) hoặc hỏi về CV, phỏng vấn, việc làm.'
    }
  ]);

  const listRef = useRef(null);
  const threadListRef = useRef(null);
  const fileInputRef = useRef(null);

  const title = useMemo(() => 'AI trợ lý', []);

  const busy = loading || uploading;

  const requireLogin = (message = 'Bạn cần đăng nhập để dùng trợ lý AI.') => {
    const token = getToken();
    if (!token) {
      notify({ type: 'error', message });
      return false;
    }
    return true;
  };

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const scrollThreadToBottom = () => {
    const el = threadListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const apiFetch = async (path, options = {}) => {
    const token = getToken();
    const headers = {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.success === false) {
      const msg = data?.error || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  };

  const refreshUnreadCount = async () => {
    const token = getToken();
    if (!token) {
      setUnreadConversations(0);
      return;
    }
    try {
      const data = await apiFetch('/api/messages/unread-count');
      setUnreadConversations(Number(data?.count || 0));
    } catch (err) {
      // Silent: badge shouldn't spam toasts, just log the error
      console.log('Could not fetch unread count:', err.message);
      setUnreadConversations(0);
    }
  };

  const refreshInbox = async () => {
    const token = getToken();
    if (!token) {
      setInbox([]);
      return [];
    }

    setInboxLoading(true);
    try {
      const data = await apiFetch('/api/messages/inbox');
      const list = Array.isArray(data?.inbox) ? data.inbox : [];
      setInbox(list);
      return list;
    } catch (err) {
      // Don't show error if token is invalid - user might not have messages setup
      if (err.message.includes('Invalid token') || err.message.includes('401')) {
        console.log('Message inbox not available:', err.message);
      } else {
        notify({ type: 'error', message: err.message || 'Không thể tải hộp thư.' });
      }
      setInbox([]);
      return [];
    } finally {
      setInboxLoading(false);
    }
  };

  const openConversation = async (user) => {
    if (!user?.userId) return;

    setActiveChatUser(user);
    setThreadLoading(true);
    try {
      const data = await apiFetch(`/api/messages/conversation/${user.userId}`);
      setThreadMessages(Array.isArray(data?.messages) ? data.messages : []);
      setTimeout(scrollThreadToBottom, 0);

      await apiFetch(`/api/messages/mark-read/${user.userId}`, { method: 'PATCH' });
      await Promise.all([refreshUnreadCount(), refreshInbox()]);
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không thể tải hội thoại.' });
    } finally {
      setThreadLoading(false);
    }
  };

  const sendChatMessage = async () => {
    const content = chatInput.trim();
    if (!content || !activeChatUser?.userId) return;

    const token = getToken();
    if (!token) {
      notify({ type: 'error', message: 'Bạn cần đăng nhập để nhắn tin.' });
      return;
    }

    const myId = getUserId();
    const optimistic = {
      id: `tmp-${Date.now()}`,
      fromUserId: myId,
      toUserId: activeChatUser.userId,
      content,
      createdAt: new Date().toISOString(),
      read: true
    };
    setThreadMessages((prev) => [...prev, optimistic]);
    setChatInput('');
    setTimeout(scrollThreadToBottom, 0);

    try {
      await apiFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: activeChatUser.userId, content })
      });
      await refreshInbox();
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không thể gửi tin nhắn.' });
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    // Optimistic append user message
    const nextMessages = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    // Let the UI paint the new message then scroll.
    setTimeout(scrollToBottom, 0);

    try {
      const userId = getUserId();
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send conversation context so AI can answer follow-ups naturally
        body: JSON.stringify({
          mode: 'general',
          userId,
          messages: nextMessages.slice(-20)
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể gọi AI.');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply || 'OK' }]);
      setTimeout(scrollToBottom, 0);
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không thể gọi AI.' });
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Mình gặp lỗi khi xử lý. Bạn thử lại giúp mình nhé.' }]);
      setTimeout(scrollToBottom, 0);
    } finally {
      setLoading(false);
    }
  };

  const uploadCv = async (file) => {
    if (!file || busy) return;
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowed.includes(file.type)) {
      notify({ type: 'error', message: 'Chỉ nhận file PDF hoặc DOCX.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify({ type: 'error', message: 'File quá lớn (tối đa 5MB).' });
      return;
    }

    const userId = getUserId();

    setMessages((prev) => [...prev, { role: 'user', content: `Đã gửi CV: ${file.name}` }]);
    setUploading(true);
    setTimeout(scrollToBottom, 0);

    const form = new FormData();
    form.append('cvFile', file);
    if (userId) form.append('userId', userId);
    if (input.trim()) form.append('question', input.trim());

    try {
      const res = await fetch('/api/ai/chat/cv-file', {
        method: 'POST',
        body: form
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể phân tích CV.');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply || 'OK' }]);
      setTimeout(scrollToBottom, 0);
    } catch (err) {
      notify({ type: 'error', message: err.message || 'Không thể phân tích CV.' });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Mình chưa đọc được CV này. Bạn thử lại với file PDF/DOCX khác nhé.' }
      ]);
      setTimeout(scrollToBottom, 0);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const onToggle = () => setOpen((v) => !v);
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);

    window.addEventListener('aiw:toggle', onToggle);
    window.addEventListener('aiw:open', onOpen);
    window.addEventListener('aiw:close', onClose);

    return () => {
      window.removeEventListener('aiw:toggle', onToggle);
      window.removeEventListener('aiw:open', onOpen);
      window.removeEventListener('aiw:close', onClose);
    };
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const id = setInterval(refreshUnreadCount, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!chatOpen) return;

    (async () => {
      const token = getToken();
      if (!token) {
        // Don't show error - user might not have logged in yet
        setChatOpen(false);
        return;
      }

      const list = await refreshInbox();
      if (!activeChatUser && list.length > 0) {
        await openConversation(list[0]);
      } else if (activeChatUser) {
        await openConversation(activeChatUser);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpen]);

  return (
    <div className={`aiw-root ${open ? 'aiw-open' : ''}`}>
      {!open && chatOpen && (
        <div className="aiw-chat-panel" role="dialog" aria-label="Tin nhắn">
          <div className="aiw-header">
            <div className="aiw-title">
              <div className="aiw-avatar">💬</div>
              <div>
                <div className="aiw-title-text">Tin nhắn</div>
                <div className="aiw-title-sub">Trò chuyện lại với người đã nhắn</div>
              </div>
            </div>
            <button type="button" className="aiw-close" onClick={() => setChatOpen(false)} aria-label="Đóng">
              <i className="bi bi-x"></i>
            </button>
          </div>

          <div className="aiw-chat-body">
            <div className="aiw-chat-inbox">
              {inboxLoading ? (
                <div style={{ padding: 12, color: 'rgba(15, 23, 42, 0.7)', fontWeight: 700 }}>Đang tải...</div>
              ) : inbox.length === 0 ? (
                <div style={{ padding: 12, color: 'rgba(15, 23, 42, 0.7)', fontWeight: 700 }}>Chưa có hội thoại</div>
              ) : (
                inbox.map((c) => (
                  <button
                    key={c.userId}
                    type="button"
                    className={`aiw-inbox-item ${activeChatUser?.userId === c.userId ? 'active' : ''}`}
                    onClick={() => openConversation(c)}
                  >
                    <div className="aiw-inbox-top">
                      <div className="aiw-inbox-name">{c.name}</div>
                      {c.unread > 0 && <div className="aiw-inbox-unread">{c.unread}</div>}
                    </div>
                    <div className="aiw-inbox-last">{c.lastMessage}</div>
                  </button>
                ))
              )}
            </div>

            <div className="aiw-chat-thread">
              <div className="aiw-thread-list" ref={threadListRef}>
                {!activeChatUser ? (
                  <div style={{ color: 'rgba(15, 23, 42, 0.7)', fontWeight: 700 }}>Chọn một hội thoại</div>
                ) : threadLoading ? (
                  <div style={{ color: 'rgba(15, 23, 42, 0.7)', fontWeight: 700 }}>Đang tải tin nhắn...</div>
                ) : threadMessages.length === 0 ? (
                  <div style={{ color: 'rgba(15, 23, 42, 0.7)', fontWeight: 700 }}>Chưa có tin nhắn</div>
                ) : (
                  threadMessages.map((m) => {
                    const myId = getUserId();
                    const isMe = myId != null && String(m.fromUserId) === String(myId);
                    const dt = m.createdAt ? new Date(m.createdAt) : null;
                    const timeText = dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleString() : '';
                    return (
                      <div key={m.id} className={`aiw-thread-msg ${isMe ? 'me' : 'other'}`}>
                        <div>
                          <div className="aiw-thread-bubble" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                          {timeText && <div className="aiw-thread-time">{timeText}</div>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="aiw-thread-input">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendChatMessage();
                  }}
                  placeholder={activeChatUser ? `Nhắn cho ${activeChatUser.name}...` : 'Chọn hội thoại để nhắn'}
                  disabled={!activeChatUser}
                />
                <button type="button" onClick={sendChatMessage} disabled={!activeChatUser || !chatInput.trim()}>
                  Gửi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="aiw-panel" role="dialog" aria-label="AI Assistant">
          <div className="aiw-header">
            <div className="aiw-title">
              <div className="aiw-avatar">🤖</div>
              <div>
                <div className="aiw-title-text">{title}</div>
                <div className="aiw-title-sub">Trả lời nhanh, gợi ý rõ ràng</div>
              </div>
            </div>
            <button type="button" className="aiw-close" onClick={() => setOpen(false)} aria-label="Đóng">
              <i className="bi bi-x"></i>
            </button>
          </div>

          <div className="aiw-messages" ref={listRef}>
            {messages.map((m, idx) => (
              <div key={idx} className={`aiw-msg ${m.role === 'user' ? 'user' : 'assistant'}`}>
                <div className="aiw-bubble" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
              </div>
            ))}
            {uploading && (
              <div className="aiw-msg assistant">
                <div className="aiw-bubble aiw-typing">Đang phân tích CV...</div>
              </div>
            )}
            {loading && (
              <div className="aiw-msg assistant">
                <div className="aiw-bubble aiw-typing">Đang trả lời...</div>
              </div>
            )}
          </div>

          <div className="aiw-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              placeholder={'Nhập câu hỏi của bạn...'}
              disabled={busy}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadCv(file);
                e.target.value = '';
              }}
            />
            <button type="button" className="aiw-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={busy} title="Đính kèm CV">
              <i className="bi bi-paperclip"></i>
            </button>
            <button type="button" onClick={send} disabled={busy || !input.trim()}>
              <i className="bi bi-send"></i>
            </button>
          </div>
        </div>
      )}

      {!open && (
        <div className={`aiw-pill ${pillExpanded ? 'expanded' : 'collapsed'}`} role="complementary" aria-label="AI shortcuts">
          {pillExpanded ? (
            <>
              <button
                type="button"
                className="aiw-pill-btn"
                onClick={() => {
                  if (!requireLogin()) return;
                  setOpen(true);
                  setPillExpanded(true);
                }}
                aria-label="Mở AI"
                title="Mở AI"
              >
                <i className="bi bi-robot" />
              </button>
              <button
                type="button"
                className="aiw-pill-btn"
                onClick={() => navigate('/jobs/saved')}
                aria-label="Việc làm đã lưu"
                title="Việc làm đã lưu"
              >
                <i className="bi bi-bookmark" />
              </button>
              <button type="button" className="aiw-pill-btn" aria-label="Hồ sơ" title="Hồ sơ">
                <i className="bi bi-person" />
              </button>
              <button
                type="button"
                className="aiw-pill-btn"
                aria-label="Hỏi đáp"
                title="Chát"
                onClick={() => {
                  if (!requireLogin('Bạn cần đăng nhập để xem tin nhắn.')) return;
                  setChatOpen((v) => !v);
                }}
              >
                <i className="bi bi-chat-dots" />
                {unreadConversations > 0 && <span className="aiw-badge">{unreadConversations}</span>}
              </button>
              <button
                type="button"
                className="aiw-pill-caret"
                onClick={() => setPillExpanded(false)}
                aria-label="Thu nhỏ"
                title="Thu nhỏ"
              >
                <i className="bi bi-caret-up-fill" />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="aiw-pill-caret aiw-pill-caret-alone"
              onClick={() => setPillExpanded(true)}
              aria-label="Phóng ra"
              title="Phóng ra"
            >
              <i className="bi bi-caret-down-fill" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AIAssistantWidget;
