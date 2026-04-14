import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';

const fallbackFirebaseConfig = {
  apiKey: 'AIzaSyB4-ASQPmNbDMVuSxwp33WXqsX0vNlOgto',
  authDomain: 'jobfinder-fc89f.firebaseapp.com',
  projectId: 'jobfinder-fc89f',
  storageBucket: 'jobfinder-fc89f.firebasestorage.app',
  messagingSenderId: '470606415903',
  appId: '1:470606415903:web:e8f84eecf9a3844df06d2a',
  measurementId: 'G-WZGNZ52YHK'
};

export const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || fallbackFirebaseConfig.apiKey,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || fallbackFirebaseConfig.authDomain,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || fallbackFirebaseConfig.projectId,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || fallbackFirebaseConfig.storageBucket,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || fallbackFirebaseConfig.messagingSenderId,
  appId: process.env.REACT_APP_FIREBASE_APP_ID || fallbackFirebaseConfig.appId,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || fallbackFirebaseConfig.measurementId
};

export const firebaseVapidKey = String(process.env.REACT_APP_FIREBASE_VAPID_KEY || '').trim();

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let analyticsInitialized = false;

export const initFirebaseAnalytics = async () => {
  if (analyticsInitialized) {
    return true;
  }

  if (typeof window === 'undefined' || !firebaseConfig.measurementId) {
    return false;
  }

  try {
    const supported = await isAnalyticsSupported();
    if (!supported) {
      return false;
    }

    getAnalytics(firebaseApp);
    analyticsInitialized = true;
    return true;
  } catch {
    return false;
  }
};
