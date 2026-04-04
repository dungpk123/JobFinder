import React, { useEffect, useState } from "react";
import "./PWAUpdatePrompt.css";

const PWAUpdatePrompt = () => {
  const [registration, setRegistration] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const updateHandler = (event) => {
      setRegistration(event.detail?.registration || null);
      setHidden(false);
    };

    window.addEventListener("pwa:update-available", updateHandler);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          setRegistration(reg);
          setHidden(false);
        }
      });
    }

    return () => {
      window.removeEventListener("pwa:update-available", updateHandler);
    };
  }, []);

  const handleRefresh = () => {
    if (!registration?.waiting) {
      window.location.reload();
      return;
    }

    const onControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange, {
      once: true,
    });

    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  };

  if (!registration || hidden) {
    return null;
  }

  return (
    <div className="pwa-update-prompt" role="status" aria-live="polite">
      <div className="pwa-update-prompt__content">
        <strong>Phiên bản mới đã sẵn sàng.</strong>
        <span>Làm mới để cập nhật JobFinder.</span>
      </div>
      <div className="pwa-update-prompt__actions">
        <button type="button" onClick={handleRefresh}>
          Cập nhật ngay
        </button>
        <button type="button" className="is-secondary" onClick={() => setHidden(true)}>
          Để sau
        </button>
      </div>
    </div>
  );
};

export default PWAUpdatePrompt;
