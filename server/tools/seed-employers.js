/* Seed 10 employer accounts (nhatuyendung1-10@gmail.com) with password 123456 and 2 jobs each. */
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

const employers = Array.from({ length: 10 }).map((_, idx) => {
  const n = idx + 1;
  return {
    email: `nhatuyendung${n}@gmail.com`,
    name: `Nhà tuyển dụng ${n}`,
    phone: `09000000${n.toString().padStart(2, '0')}`,
    address: `Số ${n} Đường Mẫu, Quận ${n}`,
    city: n % 2 === 0 ? 'Hà Nội' : 'Hồ Chí Minh',
    company: `Công ty ${n}`,
    website: `https://company${n}.example.com`,
    field: n % 2 === 0 ? 'CNTT' : 'Kinh doanh',
    description: 'Công ty demo được tạo bằng script seed.'
  };
});

const jobTemplates = [
  {
    title: 'Nhân viên Kinh doanh',
    city: 'Hà Nội',
    desc: 'Tìm kiếm khách hàng, chốt hợp đồng.',
    req: 'Có kinh nghiệm sale 1 năm.',
    ben: 'Lương cứng + % hoa hồng.',
    exp: '1 năm',
    level: 'Nhân viên',
    field: 'Kinh doanh',
    salaryFrom: 8000000,
    salaryTo: 15000000,
    type: 'Tháng',
    mode: 'Toàn thời gian'
  },
  {
    title: 'Backend Developer (NodeJS)',
    city: 'Hồ Chí Minh',
    desc: 'Phát triển API NodeJS, tối ưu hiệu năng.',
    req: 'Kinh nghiệm NodeJS 2 năm, biết SQL.',
    ben: 'Lương cạnh tranh, review 2 lần/năm.',
    exp: '2 năm',
    level: 'Nhân viên',
    field: 'CNTT',
    salaryFrom: 15000000,
    salaryTo: 25000000,
    type: 'Tháng',
    mode: 'Toàn thời gian'
  }
];

async function upsertEmployer(e) {
  // Create user
  await run(
    `INSERT OR IGNORE INTO NguoiDung (Email, MatKhau, HoTen, SoDienThoai, VaiTro, TrangThai, DiaChi)
     VALUES (?, ?, ?, ?, 'Nhà tuyển dụng', 1, ?)` ,
    [e.email, hash, e.name, e.phone, e.address]
  );

  const user = await get('SELECT MaNguoiDung FROM NguoiDung WHERE Email = ?', [e.email]);
  if (!user) throw new Error(`Không tìm thấy user cho ${e.email}`);

  // Create employer company profile
  await run(
    `INSERT OR IGNORE INTO NhaTuyenDung (MaNguoiDung, TenCongTy, MaSoThue, Website, DiaChi, ThanhPho, MoTa, Logo)
     VALUES (?, ?, NULL, ?, ?, ?, ?, NULL)`,
    [user.MaNguoiDung, e.company, e.website, e.address, e.city, e.description]
  );

  const employer = await get('SELECT MaNhaTuyenDung FROM NhaTuyenDung WHERE MaNguoiDung = ?', [user.MaNguoiDung]);
  if (!employer) throw new Error(`Không tạo được NhaTuyenDung cho ${e.email}`);

  // Upsert company table to keep consistency
  await run(
    `INSERT OR IGNORE INTO CongTy (TenCongTy, MaSoThue, DiaChi, ThanhPho, Website, LinhVuc, MoTa, Logo, NguoiDaiDien)
     VALUES (?, NULL, ?, ?, ?, ?, ?, NULL, ?)` ,
    [e.company, e.address, e.city, e.website, e.field, e.description, user.MaNguoiDung]
  );

  // Insert two jobs
  for (let j = 0; j < jobTemplates.length; j++) {
    const t = jobTemplates[j];
    const title = `${t.title} - ${e.company} #${j + 1}`;
    await run(
      `INSERT INTO TinTuyenDung (
        MaNhaTuyenDung, TieuDe, MoTa, YeuCau, QuyenLoi, KinhNghiem, CapBac, LinhVucCongViec,
        LuongTu, LuongDen, KieuLuong, DiaDiem, ThanhPho, HinhThuc, TrangThai, HanNopHoSo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Đã đăng', NULL)`,
      [
        employer.MaNhaTuyenDung,
        title,
        t.desc,
        t.req,
        t.ben,
        t.exp,
        t.level,
        t.field,
        t.salaryFrom,
        t.salaryTo,
        t.type,
        e.address,
        t.city,
        t.mode
      ]
    ).catch(() => {}); // ignore duplicates if re-run
  }
}

async function main() {
  for (const e of employers) {
    await upsertEmployer(e);
    console.log(`Seeded ${e.email}`);
  }
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
