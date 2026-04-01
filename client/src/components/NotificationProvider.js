import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [state, setState] = useState({
    open: false,
    type: 'info',
    title: '',
    message: ''
  });

  const originalAlertRef = useRef(null);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, open: false }));
  }, []);

  const notify = useCallback((input) => {
    const payload = typeof input === 'string'
      ? { message: input }
      : (input || {});

    const next = {
      open: true,
      type: payload.type || 'info',
      title: payload.title || '',
      message: payload.message || ''
    };

    setState(next);
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

  const value = useMemo(() => ({ notify, close }), [notify, close]);

  const ui = useMemo(() => {
    switch (state.type) {
      case 'success':
        return { icon: 'bi-check-circle-fill', accent: 'success', title: state.title || 'Thành công' };
      case 'error':
        return { icon: 'bi-x-circle-fill', accent: 'danger', title: state.title || 'Có lỗi' };
      case 'warning':
        return { icon: 'bi-exclamation-triangle-fill', accent: 'warning', title: state.title || 'Cảnh báo' };
      case 'info':
      default:
        return { icon: 'bi-info-circle-fill', accent: 'primary', title: state.title || 'Thông báo' };
    }
  }, [state.type, state.title]);

  return (
    <NotificationContext.Provider value={value}>
      {children}

      {state.open && (
        <>
          {/* Backdrop */}
          <div
            className="modal-backdrop fade show"
            onClick={close}
            style={{ zIndex: 2000 }}
          />

          {/* Modal */}
          <div
            className="modal fade show"
            role="dialog"
            aria-modal="true"
            style={{ display: 'block', zIndex: 2001 }}
            onClick={close}
          >
            <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content border-0 shadow">
                <div className="modal-body p-4">
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className={`rounded-circle bg-${ui.accent} bg-opacity-10 d-inline-flex align-items-center justify-content-center flex-shrink-0`}
                      style={{ width: 52, height: 52 }}
                    >
                      <i className={`bi ${ui.icon} text-${ui.accent}`} style={{ fontSize: 26 }}></i>
                    </div>

                    <div className="flex-grow-1">
                      <div className="fw-bold fs-5 mb-1">{ui.title}</div>
                      <div className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>{state.message}</div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-end mt-4">
                    <button type="button" className={`btn btn-${ui.accent}`} onClick={close}>
                      OK
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
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
