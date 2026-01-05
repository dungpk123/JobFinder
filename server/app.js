require('dotenv').config();

const cors = require('cors');
const db = require('./config/sqlite');
const { bootstrapSuperAdmin } = require('./tools/bootstrap-super-admin');

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var changePasswordRouter = require('./routes/change-password');
var jobsRouter = require('./routes/jobs');
var applicationsRouter = require('./routes/applications');
var cvsRouter = require('./routes/cvs');
var mockJobsRouter = require('./routes/mock-jobs');
var universitiesRouter = require('./routes/universities');
var aiRouter = require('./routes/ai');
var provincesRouter = require('./routes/provinces');
var companiesRouter = require('./routes/companies');
var adminRouter = require('./routes/admin');
var employerRouter = require('./routes/employer');
var messagesRouter = require('./routes/messages');
var careerGuideRouter = require('./routes/career-guide');

var app = express();

// Ensure a Super Admin account exists (idempotent)
bootstrapSuperAdmin().catch((err) => {
  console.error('[bootstrap-super-admin] failed:', err.message || err);
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Base path prefix (e.g., '/id'). Can be configured via env BASE_PATH
const BASE_PATH = process.env.BASE_PATH || '/';
// Normalize: ensure leading slash, no trailing slash except root
const normalizeBase = (p) => {
  if (!p) return '/';
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
};
const BASE = normalizeBase(BASE_PATH);

app.use(cors());
app.use(logger('dev'));
// Increase body size limits because CV Online stores rendered HTML in JSON.
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));
app.use(cookieParser());
// Serve static under base path too
app.use(BASE, express.static(path.join(__dirname, 'public')));

// Mount routers under BASE
// Helper to concatenate paths without double slashes
const mountPath = (sub) => BASE === '/' ? sub : BASE + sub;

app.use(mountPath('/'), indexRouter);
app.use(mountPath('/users'), usersRouter);
app.use(mountPath('/auth'), authRouter);
app.use(mountPath('/auth/change-password'), changePasswordRouter);
app.use(mountPath('/jobs'), jobsRouter);
app.use(mountPath('/applications'), applicationsRouter);
app.use(mountPath('/api/cvs'), cvsRouter);
app.use(mountPath('/api/mock-jobs'), mockJobsRouter);
app.use(mountPath('/api/universities'), universitiesRouter);
app.use(mountPath('/api/ai'), aiRouter);
app.use(mountPath('/api/provinces'), provincesRouter);
app.use(mountPath('/api/companies'), companiesRouter);
app.use(mountPath('/api/admin'), adminRouter);
app.use(mountPath('/api/employer'), employerRouter);
app.use(mountPath('/api/messages'), messagesRouter);
app.use(mountPath('/api/career-guide'), careerGuideRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
