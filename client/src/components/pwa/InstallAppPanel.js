import React, { useMemo, useState } from "react";
import usePWAInstallPrompt from "../../hooks/usePWAInstallPrompt";
import "./InstallAppPanel.css";

const PLATFORM_ANDROID = "android";
const PLATFORM_IOS = "ios";
const PLATFORM_DESKTOP = "desktop";

const InstallAppPanel = () => {
  const {
    isInstalled,
    isStandalone,
    canTriggerPrompt,
    isIOS,
    activePlatform,
    setActivePlatform,
    promptInstall,
    dismissInstall,
    clearDismissed,
    dismissedRecently,
  } = usePWAInstallPrompt();

  const [feedback, setFeedback] = useState("");

  const installSteps = useMemo(
    () => ({
      [PLATFORM_ANDROID]: [
        "Mở trang bằng Chrome hoặc Edge trên Android.",
        "Nhấn biểu tượng cài đặt hoặc menu 3 chấm của trình duyệt.",
        "Chọn Cài đặt ứng dụng hoặc Thêm vào màn hình chính.",
      ],
      [PLATFORM_IOS]: [
        "Mở trang bằng Safari trên iPhone/iPad.",
        "Nhấn nút Chia sẻ ở thanh dưới hoặc thanh trên.",
        "Chọn Thêm vào Màn hình chính, sau đó nhấn Thêm.",
      ],
      [PLATFORM_DESKTOP]: [
        "Mở trang bằng Chrome hoặc Edge trên máy tính.",
        "Nhấn biểu tượng cài đặt ở thanh địa chỉ.",
        "Hoặc vào menu trình duyệt rồi chọn Cài đặt JobFinder.",
      ],
    }),
    [],
  );

  const handleInstallClick = async () => {
    if (isInstalled || isStandalone) {
      setFeedback("Ứng dụng đã được cài đặt trên thiết bị này.");
      return;
    }

    if (isIOS) {
      setFeedback("iOS chưa hỗ trợ prompt tự động. Hãy làm theo hướng dẫn phía dưới để cài thủ công.");
      return;
    }

    if (!canTriggerPrompt) {
      setFeedback(
        "Trình duyệt chưa cấp beforeinstallprompt. Hãy đảm bảo chạy HTTPS hoặc localhost và truy cập lại trang vài giây.",
      );
      return;
    }

    const outcome = await promptInstall();

    if (outcome === "accepted") {
      setFeedback("Cài đặt thành công. Bạn có thể mở JobFinder như ứng dụng độc lập.");
      return;
    }

    if (outcome === "dismissed") {
      setFeedback("Bạn đã đóng hộp thoại cài đặt. Có thể bấm lại bất cứ lúc nào.");
      return;
    }

    setFeedback("Không thể mở prompt cài đặt ở thời điểm này.");
  };

  const installButtonLabel = isInstalled || isStandalone
    ? "Đã cài đặt"
    : isIOS
      ? "Xem hướng dẫn iOS"
      : canTriggerPrompt
        ? "Cài đặt ứng dụng"
        : "Xem hướng dẫn cài thủ công";

  return (
    <section className="install-app-panel" aria-label="Cài đặt ứng dụng JobFinder">
      <div className="install-app-panel__tabs" role="tablist" aria-label="Nền tảng cài đặt">
        <button
          type="button"
          role="tab"
          className={`install-app-panel__tab ${activePlatform === PLATFORM_ANDROID ? "is-active" : ""}`}
          onClick={() => setActivePlatform(PLATFORM_ANDROID)}
        >
          Android
        </button>
        <button
          type="button"
          role="tab"
          className={`install-app-panel__tab ${activePlatform === PLATFORM_IOS ? "is-active" : ""}`}
          onClick={() => setActivePlatform(PLATFORM_IOS)}
        >
          iOS
        </button>
        <button
          type="button"
          role="tab"
          className={`install-app-panel__tab ${activePlatform === PLATFORM_DESKTOP ? "is-active" : ""}`}
          onClick={() => setActivePlatform(PLATFORM_DESKTOP)}
        >
          Desktop
        </button>
      </div>

      <div className="install-app-panel__body" role="tabpanel">
        <ol className="install-app-panel__steps">
          {installSteps[activePlatform].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <div className="install-app-panel__actions">
          <button
            type="button"
            className="install-app-panel__install-btn"
            onClick={handleInstallClick}
            disabled={isInstalled || isStandalone}
          >
            {installButtonLabel}
          </button>

          <button
            type="button"
            className="install-app-panel__later-btn"
            onClick={() => {
              dismissInstall();
              setFeedback("Đã ẩn gợi ý cài đặt trong 7 ngày trên trình duyệt này.");
            }}
          >
            Để sau
          </button>

          {dismissedRecently && (
            <button
              type="button"
              className="install-app-panel__reset-btn"
              onClick={() => {
                clearDismissed();
                setFeedback("Đã bật lại gợi ý cài đặt.");
              }}
            >
              Bật lại gợi ý
            </button>
          )}
        </div>

        {feedback && <p className="install-app-panel__feedback">{feedback}</p>}
      </div>
    </section>
  );
};

export default InstallAppPanel;
