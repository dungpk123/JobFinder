const mysql = require('mysql2/promise');

const databaseUrl = process.env.DATABASE_URL || '';
const useMysql = /^mysql:\/\//i.test(databaseUrl);

const normalizeSql = (sql) => {
  let normalized = String(sql || '');

  normalized = normalized.replace(/\bINSERT\s+OR\s+REPLACE\s+INTO\b/gi, 'REPLACE INTO');
  normalized = normalized.replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi, 'INSERT IGNORE INTO');
  normalized = normalized.replace(/datetime\(\s*['"]now['"]\s*,\s*['"]localtime['"]\s*\)/gi, 'NOW()');
  normalized = normalized.replace(/datetime\(\s*['"]now['"]\s*\)/gi, 'NOW()');
  normalized = normalized.replace(/datetime\(\s*([A-Za-z0-9_$.]+)\s*\)/gi, '$1');

  return normalized;
};

const normalizeParams = (params, callback) => {
  if (typeof params === 'function') {
    return { params: [], callback: params };
  }

  if (params == null) {
    return { params: [], callback };
  }

  return { params: Array.isArray(params) ? params : [params], callback };
};

const normalizeBindValue = (value) => (typeof value === 'undefined' ? null : value);

if (!useMysql) {
  const sqliteDb = require('./sqlite');

  module.exports = {
    get: (...args) => sqliteDb.get(...args),
    all: (...args) => sqliteDb.all(...args),
    run: (...args) => sqliteDb.run(...args),
    serialize: (fn) => {
      if (typeof fn === 'function') fn();
    },
    close: () => {}
  };
  return;
}

const url = new URL(databaseUrl);
const sslaccept = url.searchParams.get('sslaccept') || url.searchParams.get('ssl');
const ssl = sslaccept === 'strict' ? { rejectUnauthorized: true } : { rejectUnauthorized: true };

const pool = mysql.createPool({
  host: url.hostname,
  port: url.port ? Number(url.port) : 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
  ssl,
  multipleStatements: false
});

let ensureMysqlSchemaPromise = null;
const ensureMysqlSchemaReady = async () => {
  if (!ensureMysqlSchemaPromise) {
    ensureMysqlSchemaPromise = Promise.resolve();
  }

  return ensureMysqlSchemaPromise;
};

const getRows = async (sql, params = []) => {
  await ensureMysqlSchemaReady();
  const safeParams = Array.isArray(params) ? params.map(normalizeBindValue) : params;
  const [rows] = await pool.query(normalizeSql(sql), safeParams);
  return rows;
};

const runStatement = async (sql, params = []) => {
  await ensureMysqlSchemaReady();
  const safeParams = Array.isArray(params) ? params.map(normalizeBindValue) : params;
  const [result] = await pool.execute(normalizeSql(sql), safeParams);
  return {
    lastID: result?.insertId || 0,
    changes: result?.affectedRows || 0
  };
};

const db = {
  get(sql, params, callback) {
    const normalized = normalizeParams(params, callback);
    const promise = getRows(sql, normalized.params).then((rows) => rows[0] || null);

    if (typeof normalized.callback === 'function') {
      promise.then((row) => normalized.callback(null, row)).catch((err) => normalized.callback(err));
      return;
    }

    return promise;
  },

  all(sql, params, callback) {
    const normalized = normalizeParams(params, callback);
    const promise = getRows(sql, normalized.params);

    if (typeof normalized.callback === 'function') {
      promise.then((rows) => normalized.callback(null, rows)).catch((err) => normalized.callback(err));
      return;
    }

    return promise;
  },

  run(sql, params, callback) {
    const normalized = normalizeParams(params, callback);
    const promise = runStatement(sql, normalized.params);

    if (typeof normalized.callback === 'function') {
      promise
        .then((result) => normalized.callback.call(result, null))
        .catch((err) => normalized.callback(err));
      return;
    }

    return promise;
  },

  serialize(fn) {
    if (typeof fn === 'function') fn();
  },

  close() {
    return undefined;
  }
};

module.exports = db;