import { useEffect } from 'react';
import { useNotification } from './NotificationProvider';
import { initFirebaseAnalytics } from '../config/firebase';
import {
  requestFirebaseMessagingToken,
  subscribeToForegroundMessages
} from '../config/firebaseMessaging';
import { showBrowserNotification } from './notificationUtils';

const resolveNotificationTitle = (payload) => {
  return String(
    payload?.notification?.title
    || payload?.data?.title
    || 'Thông báo JobFinder'
  ).trim();
};

const resolveNotificationBody = (payload) => {
  return String(
    payload?.notification?.body
    || payload?.data?.body
    || payload?.data?.message
    || 'Bạn có thông báo mới.'
  ).trim();
};

const resolveNotificationUrl = (payload) => {
  const link = String(
    payload?.fcmOptions?.link
    || payload?.data?.url
    || payload?.data?.link
    || '/messages'
  ).trim();

  return link || '/messages';
};

const FirebaseMessagingBridge = () => {
  const { notify } = useNotification();

  useEffect(() => {
    let isUnmounted = false;
    let unsubscribe = () => {};

    const bootstrap = async () => {
      await initFirebaseAnalytics();

      unsubscribe = await subscribeToForegroundMessages(async (payload) => {
        if (isUnmounted) {
          return;
        }

        const title = resolveNotificationTitle(payload);
        const body = resolveNotificationBody(payload);
        const url = resolveNotificationUrl(payload);

        notify({
          type: 'info',
          mode: 'toast',
          title,
          message: body
        });

        await showBrowserNotification({
          title,
          body,
          url,
          tag: String(payload?.messageId || 'jobfinder-fcm')
        });
      });

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        await requestFirebaseMessagingToken();
      }
    };

    const refreshToken = () => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        void requestFirebaseMessagingToken();
      }
    };

    void bootstrap();

    window.addEventListener('jobfinder:auth-changed', refreshToken);
    window.addEventListener('jobfinder:user-updated', refreshToken);

    return () => {
      isUnmounted = true;
      unsubscribe();
      window.removeEventListener('jobfinder:auth-changed', refreshToken);
      window.removeEventListener('jobfinder:user-updated', refreshToken);
    };
  }, [notify]);

  return null;
};

export default FirebaseMessagingBridge;
