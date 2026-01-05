// Usage: node tools/dump-db.js <relative-or-absolute-path-to-db>
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const dbArg = process.argv[2];
if (!dbArg) {
  console.error('Provide path to .db file. Example: node tools/dump-db.js ./data/timkiemvieclam.db');
  process.exit(1);
}

const dbPath = path.isAbsolute(dbArg) ? dbArg : path.join(process.cwd(), dbArg);
if (!fs.existsSync(dbPath)) {
  console.error('DB file not found:', dbPath);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

(async () => {
  try {
    console.log(`\n=== SCHEMA DUMP for ${dbPath} ===\n`);
    const tables = await run("SELECT name, type, sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name");
    if (tables.length === 0) {
      console.log('(No user tables found)');
    } else {
      for (const t of tables) {
        console.log(`-- ${t.type.toUpperCase()}: ${t.name}`);
        console.log(t.sql ? t.sql.trim() : '-- (no CREATE statement)');
        console.log('');
      }
    }

    // Also list indexes
    const indexes = await run("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name");
    if (indexes.length) {
      console.log('-- INDEXES --');
      for (const idx of indexes) {
        console.log(idx.sql.trim());
      }
      console.log('');
    }

    // Show a count per table
    console.log('-- ROW COUNTS --');
    for (const t of tables.filter(x => x.type === 'table')) {
      try {
        const rows = await run(`SELECT COUNT(*) AS c FROM "${t.name}"`);
        console.log(`${t.name}: ${rows[0].c}`);
      } catch (e) {
        console.log(`${t.name}: (count error: ${e.message})`);
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    db.close();
  }
})();
