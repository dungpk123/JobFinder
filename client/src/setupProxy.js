const { createProxyMiddleware } = require('http-proxy-middleware');

const target = process.env.REACT_APP_API_BASE || 'http://localhost:3001';

module.exports = function(app) {
  // Proxy API and uploaded assets.
  // IMPORTANT: Don't proxy SPA routes on full page reload (HTML navigation).
  // If we proxy '/jobs' blindly, refreshing http://localhost:3000/jobs will return JSON from backend.
  const commonProxy = createProxyMiddleware({
    target,
    changeOrigin: true,
    logLevel: 'warn'
  });

  const isHtmlNavigation = (req) => {
    const accept = req.headers && req.headers.accept ? String(req.headers.accept) : '';
    return accept.includes('text/html');
  };

  // Safe paths (no SPA collision)
  ['/auth', '/api', '/users', '/applications', '/cvs', '/images/avatars', '/images/company-logos'].forEach((path) => {
    app.use(path, commonProxy);
  });

  // '/jobs' collides with React Router route '/jobs' → skip proxy for HTML document requests.
  app.use('/jobs', (req, res, next) => {
    if (isHtmlNavigation(req)) return next();
    return commonProxy(req, res, next);
  });
};