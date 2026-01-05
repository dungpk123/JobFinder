// Usage:
//   node tools/run-sql.js path/to/file.sql [path/to/db]
// Defaults DB to ./data/timkiemvieclam.db when not provided
// Runs all statements in a single transaction and prints basic logs.

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const sqlFile = process.argv[2];
const dbArg = process.argv[3] || path.join(__dirname, '..', 'data', 'timkiemvieclam.db');

if (!sqlFile) {
  console.error('Thiếu đường dẫn file .sql. Ví dụ: node tools/run-sql.js tools/migrations/001_add_col.sql');
  process.exit(1);
}

const sqlPath = path.isAbsolute(sqlFile) ? sqlFile : path.join(process.cwd(), sqlFile);
const dbPath = path.isAbsolute(dbArg) ? dbArg : path.join(process.cwd(), dbArg);

if (!fs.existsSync(sqlPath)) {
  console.error('Không tìm thấy file SQL:', sqlPath);
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error('Không tìm thấy file DB:', dbPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');
const db = new sqlite3.Database(dbPath);

function exec(sql) {
  return new Promise((resolve, reject) => db.exec(sql, (err) => (err ? reject(err) : resolve())));
}

(async () => {
  console.log(`\n==> Áp dụng SQL: ${sqlPath}`);
  console.log(`==> Database: ${dbPath}\n`);
  try {
    await exec('BEGIN TRANSACTION;');
    await exec(sql);
    await exec('COMMIT;');
    console.log('✔ Hoàn tất.');
  } catch (e) {
    try { await exec('ROLLBACK;'); } catch {}
    console.error('✖ Lỗi:', e.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
