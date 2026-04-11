import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import 'bootstrap-icons/font/bootstrap-icons.css';
import App from './App';
import { NotificationProvider } from './components/NotificationProvider';
import { API_BASE } from './config/apiBase';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

if (API_BASE && typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const nativeFetch = window.fetch.bind(window);
  // Prefix relative API paths in production builds where CRA dev proxy is unavailable
  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/') && !input.startsWith('//')) {
      return nativeFetch(`${API_BASE}${input}`, init);
    }
    return nativeFetch(input, init);
  };
}

if (typeof window !== 'undefined') {
  window.__jobfinderDeferredPrompt = window.__jobfinderDeferredPrompt || null;

  if (!window.__jobfinderPwaBridgeInitialized) {
    window.__jobfinderPwaBridgeInitialized = true;

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      window.__jobfinderDeferredPrompt = event;
      window.dispatchEvent(new Event('jobfinder:pwa-prompt-ready'));
    });

    window.addEventListener('appinstalled', () => {
      window.__jobfinderDeferredPrompt = null;
      localStorage.setItem('jobfinder-pwa-installed', 'true');
    });
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <NotificationProvider>
      <App />
    </NotificationProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    window.dispatchEvent(
      new CustomEvent('pwa:update-available', {
        detail: { registration },
      }),
    );
  },
});
