import { firebaseApp, firebaseVapidKey } from './firebase';

const FCM_TOKEN_STORAGE_KEY = 'jobfinder:fcm-token';

let messagingContextPromise = null;

const readCachedToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return String(localStorage.getItem(FCM_TOKEN_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
};

const writeCachedToken = (token) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (token) {
      localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in private mode or restricted browsers.
  }
};

const getMessagingContext = async () => {
  if (messagingContextPromise) {
    return messagingContextPromise;
  }

  messagingContextPromise = (async () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return null;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return null;
    }

    const messagingModule = await import('firebase/messaging');
    const supported = await messagingModule.isSupported().catch(() => false);

    if (!supported) {
      return null;
    }

    const messaging = messagingModule.getMessaging(firebaseApp);

    return {
      getToken: messagingModule.getToken,
      onMessage: messagingModule.onMessage,
      messaging
    };
  })();

  return messagingContextPromise;
};

export const getCachedFcmToken = () => readCachedToken();

export const requestFirebaseMessagingToken = async () => {
  const context = await getMessagingContext();

  if (!context) {
    return {
      supported: false,
      token: '',
      reason: 'unsupported'
    };
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return {
      supported: true,
      token: '',
      reason: 'permission-not-granted'
    };
  }

  let registration = null;

  try {
    registration = await navigator.serviceWorker.ready;
  } catch {
    registration = null;
  }

  if (!registration) {
    return {
      supported: true,
      token: '',
      reason: 'service-worker-not-ready'
    };
  }

  try {
    const tokenOptions = {
      serviceWorkerRegistration: registration
    };

    if (firebaseVapidKey) {
      tokenOptions.vapidKey = firebaseVapidKey;
    }

    const token = await context.getToken(context.messaging, tokenOptions);
    const normalizedToken = String(token || '').trim();

    writeCachedToken(normalizedToken);

    if (normalizedToken && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('jobfinder:fcm-token', {
        detail: { token: normalizedToken }
      }));
    }

    return {
      supported: true,
      token: normalizedToken,
      reason: normalizedToken ? 'ok' : 'empty-token'
    };
  } catch (error) {
    console.warn('Không thể lấy FCM token:', error);

    return {
      supported: true,
      token: readCachedToken(),
      reason: 'token-error'
    };
  }
};

export const subscribeToForegroundMessages = async (handler) => {
  if (typeof handler !== 'function') {
    return () => {};
  }

  const context = await getMessagingContext();

  if (!context) {
    return () => {};
  }

  try {
    return context.onMessage(context.messaging, handler);
  } catch {
    return () => {};
  }
};
