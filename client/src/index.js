import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
import 'bootstrap-icons/font/bootstrap-icons.css';
import App from './App';
import { NotificationProvider } from './components/NotificationProvider';
import reportWebVitals from './reportWebVitals';

const API_BASE = (process.env.REACT_APP_API_BASE || '').replace(/\/+$/, '');

if (API_BASE && typeof window !== 'undefined' && typeof window.fetch === 'function') {
  const nativeFetch = window.fetch.bind(window);
  // Prefix relative API paths in production builds where CRA dev proxy is unavailable.
  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/') && !input.startsWith('//')) {
      return nativeFetch(`${API_BASE}${input}`, init);
    }
    return nativeFetch(input, init);
  };
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
