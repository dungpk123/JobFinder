export const isBrowserNotificationSupported = () => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const requestBrowserNotificationPermission = async () => {
  if (!isBrowserNotificationSupported()) {
    return { supported: false, permission: 'denied' };
  }

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return { supported: true, permission: Notification.permission };
  }

  try {
    const permission = await Notification.requestPermission();
    return { supported: true, permission };
  } catch {
    return { supported: true, permission: 'denied' };
  }
};

export const showBrowserNotification = async ({ title, body, url = '/', tag = 'jobfinder-message' }) => {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }

  const options = {
    body: body || '',
    tag,
    renotify: true,
    silent: false,
    data: { url },
    icon: '/pwa-192x192.png',
    badge: '/favicon-32x32.png'
  };

  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.ready) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration?.showNotification) {
        await registration.showNotification(title || 'Thông báo JobFinder', options);
        return true;
      }
    } catch {
      // fall back to Notification API below
    }
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(title || 'Thông báo JobFinder', options);
    return true;
  } catch {
    return false;
  }
};

export const syncAppIconBadge = async (count = 0) => {
  if (typeof navigator === 'undefined') return false;

  const unread = Math.max(0, Number(count) || 0);
  const canSetBadge = typeof navigator.setAppBadge === 'function';
  const canClearBadge = typeof navigator.clearAppBadge === 'function';

  if (!canSetBadge || !canClearBadge) {
    return false;
  }

  try {
    if (unread > 0) {
      await navigator.setAppBadge(Math.min(unread, 99));
    } else {
      await navigator.clearAppBadge();
    }
    return true;
  } catch {
    return false;
  }
};
