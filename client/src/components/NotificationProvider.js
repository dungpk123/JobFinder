import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import './NotificationProvider.css';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [state, setState] = useState({
    open: false,
    mode: 'modal',
    kind: 'notify',
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Xác nhận',
    cancelText: 'Hủy'
  });
  const [toastState, setToastState] = useState({
    open: false,
    token: 0,
    duration: 3000,
    type: 'info',
    title: '',
    message: ''
  });

  const originalAlertRef = useRef(null);
  const confirmResolverRef = useRef(null);

  const settleConfirm = useCallback((result) => {
    if (!confirmResolverRef.current) return;
    const resolve = confirmResolverRef.current;
    confirmResolverRef.current = null;
    resolve(Boolean(result));
  }, []);

  const close = useCallback(() => {
    if (state.kind === 'confirm') {
      settleConfirm(false);
    }
    setState(prev => ({ ...prev, open: false }));
  }, [state.kind, settleConfirm]);

  const closeWithResult = useCallback((result) => {
    setState(prev => ({ ...prev, open: false }));
    settleConfirm(result);
  }, [settleConfirm]);

  const closeToast = useCallback(() => {
    setToastState(prev => ({ ...prev, open: false }));
  }, []);

  const notify = useCallback((input) => {
    const payload = typeof input === 'string'
      ? { message: input }
      : (input || {});

    const useToastMode = payload.mode !== 'modal';

    if (useToastMode) {
      setToastState({
        open: true,
        token: Date.now(),
        duration: Number(payload.duration) > 0 ? Number(payload.duration) : 3000,
        type: payload.type || 'info',
        title: payload.title || '',
        message: payload.message || ''
      });
      return;
    }

    const next = {
      open: true,
      mode: 'modal',
      kind: 'notify',
      type: payload.type || 'info',
      title: payload.title || '',
      message: payload.message || ''
    };

    setState(next);
  }, []);

  const requestConfirm = useCallback((input) => {
    const payload = input || {};

    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
      confirmResolverRef.current = null;
    }

    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setState({
        open: true,
        mode: 'modal',
        kind: 'confirm',
        type: payload.type || 'warning',
        title: payload.title || 'Xác nhận thao tác',
        message: payload.message || 'Bạn có chắc chắn muốn tiếp tục?',
        confirmText: payload.confirmText || 'Xác nhận',
        cancelText: payload.cancelText || 'Hủy'
      });
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!originalAlertRef.current) {
      originalAlertRef.current = window.alert;
    }

    window.alert = (msg) => {
      notify({ message: String(msg ?? '') });
    };

    return () => {
      if (originalAlertRef.current) {
        window.alert = originalAlertRef.current;
      }
    };
  }, [notify]);

  useEffect(() => {
    if (!toastState.open) return undefined;

    const timer = window.setTimeout(() => {
      closeToast();
    }, toastState.duration);

    return () => window.clearTimeout(timer);
  }, [toastState.open, toastState.duration, toastState.token, closeToast]);

  const value = useMemo(() => ({ notify, close, closeToast, requestConfirm }), [notify, close, closeToast, requestConfirm]);

  const getUi = useCallback((type, title) => {
    switch (type) {
      case 'success':
        return { icon: 'bi-check-circle-fill', accent: 'success', title: title || 'Thành công' };
      case 'error':
        return { icon: 'bi-x-octagon-fill', accent: 'danger', title: title || 'Có lỗi' };
      case 'warning':
        return { icon: 'bi-exclamation-triangle-fill', accent: 'warning', title: title || 'Cảnh báo' };
      case 'info':
      default:
        return { icon: 'bi-info-circle-fill', accent: 'primary', title: title || 'Thông báo' };
    }
  }, []);

  const ui = useMemo(() => getUi(state.type, state.title), [state.type, state.title, getUi]);
  const toastUi = useMemo(() => getUi(toastState.type, toastState.title), [toastState.type, toastState.title, getUi]);

  return (
    <NotificationContext.Provider value={value}>
      {children}

      {state.open && (
        <div className="jf-notify-overlay" role="dialog" aria-modal="true" onClick={() => closeWithResult(false)}>
          <div
            className={`jf-notify-dialog jf-notify-${ui.accent} ${state.kind === 'confirm' ? 'jf-notify-dialog-confirm' : ''}`.trim()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="jf-notify-topbar" />

            <div className="jf-notify-content">
              <div className="jf-notify-icon-wrap">
                <i className={`bi ${ui.icon}`}></i>
              </div>

              <div className="jf-notify-copy">
                <h4>{ui.title}</h4>
                <p>{state.message}</p>
              </div>
            </div>

            <div className="jf-notify-actions">
              {state.kind === 'confirm' ? (
                <>
                  <button type="button" className="jf-notify-btn jf-notify-btn-ghost" onClick={() => closeWithResult(false)}>
                    {state.cancelText}
                  </button>
                  <button type="button" className={`jf-notify-btn jf-notify-btn-${ui.accent}`} onClick={() => closeWithResult(true)}>
                    {state.confirmText}
                  </button>
                </>
              ) : (
                <button type="button" className={`jf-notify-btn jf-notify-btn-${ui.accent}`} onClick={() => closeWithResult(true)}>
                  Đã hiểu
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {toastState.open && (
        <div className="jf-toast-stack" role="status" aria-live="polite">
          <div className={`jf-toast jf-toast-${toastUi.accent}`}>
            <div className="jf-toast-inner">
              <div className="jf-toast-icon-wrap">
                <i className={`bi ${toastUi.icon}`}></i>
              </div>

              <div className="jf-toast-copy">
                <strong>{toastUi.title}</strong>
                <p>{toastState.message}</p>
              </div>

              <button
                type="button"
                onClick={closeToast}
                className="jf-toast-close"
                aria-label="Đóng thông báo"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="jf-toast-progress-track">
              <div
                key={toastState.token}
                className="jf-toast-progress"
                style={{
                  animation: `notificationToastProgress ${toastState.duration}ms linear forwards`
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes notificationToastProgress { from { width: 100%; } to { width: 0%; } }`}</style>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return ctx;
};
