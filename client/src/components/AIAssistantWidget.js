import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const isProviderBusyError = (text = '') => {
  const value = String(text || '').toLowerCase();
  return (
    /\b(gemini|openai)\s+error\s+(429|500|502|503|504)\b/i.test(value) ||
    /"code"\s*:\s*(429|500|502|503|504)/i.test(value) ||
    value.includes('high demand') ||
    value.includes('overloaded') ||
    value.includes('temporarily') ||
    value.includes('unavailable') ||
    value.includes('rate limit') ||
    value.includes('quota')
  );
};

const toFriendlyAiError = (text = '') => {
  const value = String(text || '').trim();
  if (!value) return 'Không thể gọi AI.';
  if (isProviderBusyError(value) || /"error"\s*:\s*\{/i.test(value)) {
    return 'Hệ thống AI đang quá tải tạm thời. Bạn thử gửi lại sau khoảng 10-30 giây nhé.';
  }
  return value;
};

const normalizeAssistantReply = (text = '') => {
  const value = String(text || '').trim();
  if (!value) return '';
  if (isProviderBusyError(value) || /"error"\s*:\s*\{/i.test(value)) {
    return 'Mình đang gặp tải cao từ hệ thống AI nên phản hồi chưa ổn định. Bạn vui lòng thử lại sau một chút nhé.';
  }
  return value;
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
        'Mình là AI hỗ trợ JobFinder. Bạn có thể hỏi về cách dùng website, CV, phỏng vấn, việc làm. Bạn cũng có thể chọn CV đã lưu để mình đọc và gợi ý việc phù hợp hơn.'
    }
  ]);
  const [cvOptions, setCvOptions] = useState([]);
  const [cvLoading, setCvLoading] = useState(false);
  const [selectedCvId, setSelectedCvId] = useState('');
  const [pendingUploadFile, setPendingUploadFile] = useState(null);
  const [cvModalOpen, setCvModalOpen] = useState(false);

  const listRef = useRef(null);
  const threadListRef = useRef(null);
  const fileInputRef = useRef(null);

  const title = useMemo(() => 'AI trợ lý', []);
  const selectedCv = useMemo(
    () => cvOptions.find((cv) => String(cv.id) === String(selectedCvId)) || null,
    [cvOptions, selectedCvId]
  );
  const attachedCvPreview = useMemo(() => {
    if (pendingUploadFile) {
      return {
        name: pendingUploadFile.name,
        subLabel: 'CV tải lên từ máy',
        source: 'upload'
      };
    }
    if (selectedCv) {
      return {
        name: selectedCv.name,
        subLabel: selectedCv.isOnline ? 'CV Online đã lưu' : 'CV tải lên đã lưu',
        source: 'stored'
      };
    }
    return null;
  }, [pendingUploadFile, selectedCv]);

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

  const loadUserCvs = useCallback(async (showErrorToast = true) => {
    const userId = getUserId();
    const token = getToken();

    if (!userId || !token) {
      setCvOptions([]);
      setSelectedCvId('');
      return [];
    }

    setCvLoading(true);
    try {
      const response = await fetch(`/api/cvs?userId=${encodeURIComponent(userId)}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không tải được danh sách CV');
      }

      const nextOptions = (Array.isArray(data?.cvs) ? data.cvs : [])
        .map((cv, index) => {
          const id = cv?.id || cv?.cvId || cv?.MaCV || `cv-${index}`;
          const name = String(cv?.name || cv?.TenCV || cv?.title || 'CV chưa đặt tên').trim();
          const refUrl = String(cv?.fileUrl || cv?.fileAbsoluteUrl || '').split('?')[0].toLowerCase();
          const isOnline = refUrl.endsWith('.html');
          return {
            id: String(id),
            name,
            isOnline,
            label: `${name} (${isOnline ? 'CV Online' : 'CV tải lên'})`
          };
        })
        .filter((cv) => cv.id);

      setCvOptions(nextOptions);
      setSelectedCvId((prev) => (nextOptions.some((cv) => cv.id === String(prev)) ? String(prev) : ''));

      return nextOptions;
    } catch (err) {
      setCvOptions([]);
      setSelectedCvId('');
      if (showErrorToast) {
        notify({ type: 'error', message: err.message || 'Không tải được CV đã lưu.' });
      }
      return [];
    } finally {
      setCvLoading(false);
    }
  }, [notify]);

  const openCvModal = async () => {
    if (!requireLogin('Bạn cần đăng nhập để chọn CV.')) return;
    setCvModalOpen(true);
    await loadUserCvs(false);
  };

  const chooseStoredCv = (cv) => {
    if (!cv?.id) return;
    setSelectedCvId(String(cv.id));
    setPendingUploadFile(null);
    setCvModalOpen(false);
    notify({ type: 'success', message: `Đã chọn CV: ${cv.name}` });
  };

  const clearSelectedCv = () => {
    setSelectedCvId('');
    setPendingUploadFile(null);
    notify({ type: 'success', message: 'Đã bỏ đính kèm CV.' });
  };

  const attachUploadedCv = (file) => {
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

    setPendingUploadFile(file);
    setSelectedCvId('');
    setCvModalOpen(false);
    notify({ type: 'success', message: `Đã đính kèm CV: ${file.name}` });
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
    const hasAttachment = Boolean(attachedCvPreview);
    if ((!text && !hasAttachment) || busy) return;

    const userPrompt = text || 'Đánh giá CV đã đính kèm và gợi ý công việc phù hợp giúp mình.';
    const composedUserMessage = pendingUploadFile
      ? `${userPrompt}\n(Đính kèm: ${pendingUploadFile.name})`
      : userPrompt;

    // Optimistic append user message
    const nextMessages = [...messages, { role: 'user', content: composedUserMessage }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    if (pendingUploadFile) {
      setUploading(true);
    }

    // Let the UI paint the new message then scroll.
    setTimeout(scrollToBottom, 0);

    try {
      let res;
      if (pendingUploadFile) {
        const userId = getUserId();
        const form = new FormData();
        form.append('cvFile', pendingUploadFile);
        if (userId) form.append('userId', userId);
        form.append('question', userPrompt);

        res = await fetch('/api/ai/chat/cv-file', {
          method: 'POST',
          body: form
        });
      } else if (selectedCvId) {
        const token = getToken();
        if (!token) {
          throw new Error('Bạn cần đăng nhập để phân tích CV đã lưu.');
        }

        res = await fetch('/api/ai/chat/cv-stored', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            cvId: Number(selectedCvId),
            question: userPrompt,
            messages: nextMessages.slice(-20)
          })
        });
      } else {
        const userId = getUserId();
        res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Send conversation context so AI can answer follow-ups naturally
          body: JSON.stringify({
            mode: 'general',
            userId,
            messages: nextMessages.slice(-20)
          })
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(toFriendlyAiError(data.error || 'Không thể gọi AI.'));
      }

      const safeReply = normalizeAssistantReply(data.reply || '');
      setMessages((prev) => [...prev, { role: 'assistant', content: safeReply || 'OK' }]);
      if (pendingUploadFile) {
        setPendingUploadFile(null);
      }
      setTimeout(scrollToBottom, 0);
    } catch (err) {
      const friendlyMessage = toFriendlyAiError(err.message || 'Không thể gọi AI.');
      notify({ type: 'error', message: friendlyMessage });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: isProviderBusyError(friendlyMessage)
            ? 'Máy chủ AI đang bận tạm thời. Bạn thử gửi lại sau vài chục giây nhé.'
            : 'Mình gặp lỗi khi xử lý. Bạn thử lại giúp mình nhé.'
        }
      ]);
      setTimeout(scrollToBottom, 0);
    } finally {
      setLoading(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    loadUserCvs(false);
  }, [open, loadUserCvs]);

  useEffect(() => {
    if (open) return;
    setCvModalOpen(false);
  }, [open]);

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

          {attachedCvPreview && (
            <div className="aiw-attachment-chip">
              <div className="aiw-attachment-icon">
                <i className="bi bi-file-earmark-text"></i>
              </div>
              <div className="aiw-attachment-content">
                <div className="aiw-attachment-name">{attachedCvPreview.name}</div>
                <div className="aiw-attachment-sub">{attachedCvPreview.subLabel}</div>
              </div>
              <button type="button" className="aiw-attachment-remove" onClick={clearSelectedCv} disabled={busy}>
                <i className="bi bi-x"></i>
              </button>
            </div>
          )}

          <div className="aiw-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
              placeholder={attachedCvPreview ? 'Nhập yêu cầu thêm (có thể bỏ trống)...' : 'Nhập câu hỏi của bạn...'}
              disabled={busy}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) attachUploadedCv(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className={`aiw-upload-btn ${attachedCvPreview ? 'is-attached' : ''}`}
              onClick={openCvModal}
              disabled={busy}
              title={attachedCvPreview ? `Đang đính kèm: ${attachedCvPreview.name}` : 'Đính kèm CV'}
            >
              <i className="bi bi-paperclip"></i>
            </button>
            <button type="button" onClick={send} disabled={busy || (!input.trim() && !attachedCvPreview)}>
              <i className="bi bi-send"></i>
            </button>
          </div>

          {cvModalOpen && (
            <div
              className="aiw-cv-modal-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="Đính kèm CV"
              onClick={() => setCvModalOpen(false)}
            >
              <div className="aiw-cv-modal" onClick={(e) => e.stopPropagation()}>
                <div className="aiw-cv-modal-head">
                  <h6>Đính kèm CV</h6>
                  <button type="button" className="aiw-cv-modal-close" onClick={() => setCvModalOpen(false)}>
                    <i className="bi bi-x"></i>
                  </button>
                </div>

                <div className="aiw-cv-modal-actions">
                  <button
                    type="button"
                    className={`aiw-cv-modal-btn ${cvLoading ? 'loading' : ''}`}
                    onClick={() => loadUserCvs(true)}
                    disabled={busy || cvLoading}
                  >
                    <i className="bi bi-arrow-clockwise"></i>
                    <span>Tải lại CV</span>
                  </button>
                  <button
                    type="button"
                    className="aiw-cv-modal-btn primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                  >
                    <i className="bi bi-upload"></i>
                    <span>Upload CV từ máy</span>
                  </button>
                </div>

                <div className="aiw-cv-modal-body">
                  {cvLoading ? (
                    <div className="aiw-cv-empty">Đang tải danh sách CV...</div>
                  ) : cvOptions.length === 0 ? (
                    <div className="aiw-cv-empty">Bạn chưa có CV nào đã lưu.</div>
                  ) : (
                    <div className="aiw-cv-list">
                      {cvOptions.map((cv) => {
                        const active = String(selectedCvId) === String(cv.id);
                        return (
                          <button
                            key={cv.id}
                            type="button"
                            className={`aiw-cv-item ${active ? 'active' : ''}`}
                            onClick={() => chooseStoredCv(cv)}
                          >
                            <div className="aiw-cv-item-title">{cv.name}</div>
                            <div className="aiw-cv-item-meta">{cv.isOnline ? 'CV Online' : 'CV tải lên'}</div>
                            <div className="aiw-cv-item-state">{active ? 'Đã chọn' : 'Chọn CV này'}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="aiw-cv-modal-foot">
                  {attachedCvPreview ? (
                    <div className="aiw-cv-selected-note">
                      Đang dùng: {attachedCvPreview.name}
                    </div>
                  ) : (
                    <div className="aiw-cv-selected-note">Chưa chọn CV (AI sẽ chat thường)</div>
                  )}
                  <button type="button" className="aiw-cv-clear-btn" onClick={clearSelectedCv} disabled={!attachedCvPreview || busy}>
                    Bỏ chọn CV
                  </button>
                </div>
              </div>
            </div>
          )}
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
              <button
                type="button"
                className="aiw-pill-btn"
                aria-label="Hỏi đáp"
                title="Tin nhắn"
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
