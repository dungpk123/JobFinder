const bcrypt = require('bcryptjs');
const db = require('../config/db');

const DEFAULT_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'superadmin@jobfinder.local';
const DEFAULT_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin123';

const ensureColumn = (sql) =>
  new Promise((resolve) => {
    db.run(sql, (err) => {
      if (err && !/duplicate column/i.test(String(err.message || ''))) {
        console.error('[bootstrap-super-admin] schema error:', err.message);
      }
      resolve();
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

async function bootstrapSuperAdmin() {
  // Add a super-admin flag without changing the existing VaiTro CHECK constraint.
  await ensureColumn('ALTER TABLE NguoiDung ADD COLUMN IsSuperAdmin INTEGER DEFAULT 0');

  const existing = await dbGet('SELECT MaNguoiDung, Email FROM NguoiDung WHERE IsSuperAdmin = 1 LIMIT 1').catch(() => null);
  if (existing?.MaNguoiDung) {
    await dbRun(
      `UPDATE NguoiDung
       SET VaiTro = 'Quản trị', TrangThai = 1, NgayCapNhat = datetime('now','localtime')
       WHERE MaNguoiDung = ?`,
      [existing.MaNguoiDung]
    ).catch((e) => console.error('[bootstrap-super-admin] align role error:', e.message));
    return;
  }

  const email = String(DEFAULT_EMAIL).trim().toLowerCase();
  const password = String(DEFAULT_PASSWORD);

  if (!email || !password) return;

  // If user exists, promote them.
  const user = await dbGet('SELECT MaNguoiDung FROM NguoiDung WHERE lower(Email) = ?', [email]).catch(() => null);
  if (user?.MaNguoiDung) {
    await dbRun(
      `UPDATE NguoiDung
      SET VaiTro = 'Siêu quản trị viên', TrangThai = 1, IsSuperAdmin = 1, NgayCapNhat = datetime('now','localtime')
       WHERE MaNguoiDung = ?`,
      [user.MaNguoiDung]
    ).catch((e) => console.error('[bootstrap-super-admin] promote error:', e.message));
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await dbRun(
    `INSERT INTO NguoiDung (Email, MatKhau, VaiTro, HoTen, TrangThai, IsSuperAdmin)
     VALUES (?, ?, 'Quản trị', ?, 1, 1)`,
    [email, hashed, 'Siêu quản trị viên']
  ).catch((e) => console.error('[bootstrap-super-admin] insert error:', e.message));
}

module.exports = { bootstrapSuperAdmin };
