/* Seed 10 candidate accounts (ungvien1-10@gmail.com) with password 123456 */
const bcrypt = require('bcryptjs');
const db = require('../config/sqlite');

const hash = bcrypt.hashSync('123456', 10);

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const candidates = Array.from({ length: 10 }).map((_, idx) => {
  const n = idx + 1;
  return {
    email: `ungvien${n}@gmail.com`,
    name: `Ứng viên ${n}`,
    phone: `09100000${n.toString().padStart(2, '0')}`,
    address: `Số ${n} Đường Ứng Viên`,
    city: n % 2 === 0 ? 'Hà Nội' : 'Hồ Chí Minh'
  };
});

async function upsertCandidate(c) {
  await run(
    `INSERT OR IGNORE INTO NguoiDung (Email, MatKhau, HoTen, SoDienThoai, VaiTro, TrangThai, DiaChi)
     VALUES (?, ?, ?, ?, 'Ứng viên', 1, ?)` ,
    [c.email, hash, c.name, c.phone, c.address]
  );

  const user = await get('SELECT MaNguoiDung FROM NguoiDung WHERE Email = ?', [c.email]);
  if (!user) throw new Error(`Không tìm thấy user cho ${c.email}`);

  await run(
    `INSERT OR IGNORE INTO HoSoUngVien (MaNguoiDung, ThanhPho, NgayTao, NgayCapNhat)
     VALUES (?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
    [user.MaNguoiDung, c.city]
  );
}

async function main() {
  for (const c of candidates) {
    await upsertCandidate(c);
    console.log(`Seeded ${c.email}`);
  }
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
