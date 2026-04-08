// Runtime configuration loaded by Vercel
// This allows environment variables to be injected at runtime instead of build time
(function initConfig() {
  if (typeof window === 'undefined') return;

  window.__APP_CONFIG__ = {
    googleClientId: '%REACT_APP_GOOGLE_CLIENT_ID%',
    apiBase: '%REACT_APP_API_BASE%'
  };

  // Set window alias for fallback
  if (window.__APP_CONFIG__.googleClientId && !window.__APP_CONFIG__.googleClientId.includes('%')) {
    window.__GOOGLE_CLIENT_ID__ = window.__APP_CONFIG__.googleClientId;
  }
})();
