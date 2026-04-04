import { useCallback, useEffect, useMemo, useState } from "react";

const INSTALLED_KEY = "jobfinder-pwa-installed";
const DISMISSED_KEY = "jobfinder-pwa-install-dismissed-at";
const DISMISS_DAYS = 7;
const PROMPT_READY_EVENT = "jobfinder:pwa-prompt-ready";

const getStandaloneStatus = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone ||
    document.referrer.includes("android-app://")
  );
};

const detectPlatform = () => {
  if (typeof navigator === "undefined") {
    return "desktop";
  }

  const userAgent = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) &&
    !(typeof window !== "undefined" && window.MSStream);
  const isAndroid = /Android/i.test(userAgent);

  if (isIOS) {
    return "ios";
  }

  if (isAndroid) {
    return "android";
  }

  return "desktop";
};

export default function usePWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return window.__jobfinderDeferredPrompt || null;
  });
  const [isStandalone, setIsStandalone] = useState(() => getStandaloneStatus());
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const cached = localStorage.getItem(INSTALLED_KEY) === "true";
    return cached || getStandaloneStatus();
  });
  const [activePlatform, setActivePlatform] = useState(() => detectPlatform());
  const [dismissedAt, setDismissedAt] = useState(() => {
    if (typeof window === "undefined") {
      return 0;
    }

    return Number(localStorage.getItem(DISMISSED_KEY) || 0);
  });

  const isIOS = activePlatform === "ios";
  const isAndroid = activePlatform === "android";
  const isDesktop = activePlatform === "desktop";

  const dismissedRecently = useMemo(() => {
    if (!dismissedAt) {
      return false;
    }

    const days = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  }, [dismissedAt]);

  const canTriggerPrompt = Boolean(
    deferredPrompt && !isIOS && !isInstalled && !isStandalone,
  );

  const markInstalled = useCallback(() => {
    setIsInstalled(true);
    localStorage.setItem(INSTALLED_KEY, "true");
    localStorage.removeItem(DISMISSED_KEY);
    setDismissedAt(0);
  }, []);

  const dismissInstall = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(DISMISSED_KEY, String(now));
    setDismissedAt(now);
  }, []);

  const clearDismissed = useCallback(() => {
    localStorage.removeItem(DISMISSED_KEY);
    setDismissedAt(0);
  }, []);

  const promptInstall = useCallback(async () => {
    const promptEvent = deferredPrompt || window.__jobfinderDeferredPrompt;

    if (!promptEvent) {
      return "unavailable";
    }

    promptEvent.prompt();
    const result = await promptEvent.userChoice;

    setDeferredPrompt(null);
    window.__jobfinderDeferredPrompt = null;

    if (result?.outcome === "accepted") {
      markInstalled();
      return "accepted";
    }

    return "dismissed";
  }, [deferredPrompt, markInstalled]);

  useEffect(() => {
    const platform = detectPlatform();
    setActivePlatform(platform);

    const syncStandaloneState = () => {
      const standalone = getStandaloneStatus();
      setIsStandalone(standalone);
      if (standalone) {
        markInstalled();
      }
    };

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      window.__jobfinderDeferredPrompt = event;
      setDeferredPrompt(event);
      setIsInstalled(false);
      localStorage.removeItem(INSTALLED_KEY);
      window.dispatchEvent(new Event(PROMPT_READY_EVENT));
    };

    const onAppInstalled = () => {
      markInstalled();
      setDeferredPrompt(null);
      window.__jobfinderDeferredPrompt = null;
    };

    const onPromptReady = () => {
      setDeferredPrompt(window.__jobfinderDeferredPrompt || null);
      setIsInstalled(false);
    };

    syncStandaloneState();

    if (window.__jobfinderDeferredPrompt) {
      setDeferredPrompt(window.__jobfinderDeferredPrompt);
      setIsInstalled(false);
    }

    if ("getInstalledRelatedApps" in navigator) {
      navigator
        .getInstalledRelatedApps()
        .then((apps) => {
          if (apps?.length) {
            markInstalled();
          }
        })
        .catch(() => {
          // Ignore unsupported browsers returning errors.
        });
    }

    const modeQuery = window.matchMedia("(display-mode: standalone)");
    const onModeChange = () => syncStandaloneState();

    if (typeof modeQuery.addEventListener === "function") {
      modeQuery.addEventListener("change", onModeChange);
    } else if (typeof modeQuery.addListener === "function") {
      modeQuery.addListener(onModeChange);
    }

    window.addEventListener("focus", syncStandaloneState);
    window.addEventListener(PROMPT_READY_EVENT, onPromptReady);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      if (typeof modeQuery.removeEventListener === "function") {
        modeQuery.removeEventListener("change", onModeChange);
      } else if (typeof modeQuery.removeListener === "function") {
        modeQuery.removeListener(onModeChange);
      }

      window.removeEventListener("focus", syncStandaloneState);
      window.removeEventListener(PROMPT_READY_EVENT, onPromptReady);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [markInstalled]);

  return {
    isInstalled,
    isStandalone,
    dismissedRecently,
    canTriggerPrompt,
    isIOS,
    isAndroid,
    isDesktop,
    activePlatform,
    setActivePlatform,
    dismissInstall,
    clearDismissed,
    promptInstall,
  };
}
