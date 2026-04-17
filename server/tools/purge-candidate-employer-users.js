/*
  Purge all users with roles: Ứng viên, Nhà tuyển dụng
  and clean related data from dependent tables in one transaction.
*/

require('dotenv').config();
const mysql = require('mysql2/promise');

const TARGET_ROLES = ['Ứng viên', 'Nhà tuyển dụng'];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing in environment');
  }

  const url = new URL(databaseUrl);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\/+/, '')),
    ssl: { rejectUnauthorized: true }
  });

  const runDelete = async (label, sql, params = TARGET_ROLES) => {
    const [result] = await connection.query(sql, params);
    return { label, affected: Number(result?.affectedRows || 0) };
  };

  const [beforeRoles] = await connection.query(
    'SELECT VaiTro, COUNT(*) AS total FROM NguoiDung GROUP BY VaiTro ORDER BY total DESC'
  );

  console.log('Before purge (NguoiDung by role):');
  console.table(beforeRoles);

  await connection.beginTransaction();

  const report = [];

  try {
    report.push(
      await runDelete(
        'ChiTietCV_KyNang (candidate CV skills)',
        `DELETE ctk
         FROM ChiTietCV_KyNang ctk
         JOIN HoSoCV cv ON cv.MaCV = ctk.MaCV
         JOIN NguoiDung u ON u.MaNguoiDung = cv.MaNguoiDung
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'LuuCV (saved candidate CVs)',
        `DELETE lc
         FROM LuuCV lc
         JOIN HoSoCV cv ON cv.MaCV = lc.MaCV
         JOIN NguoiDung u ON u.MaNguoiDung = cv.MaNguoiDung
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'LuuCV (saved by employers)',
        `DELETE lc
         FROM LuuCV lc
         JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = lc.MaNhaTuyenDung
         JOIN NguoiDung u ON u.MaNguoiDung = ntd.MaNguoiDung
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'UngTuyen (applications by candidate)',
        `DELETE ut
         FROM UngTuyen ut
         JOIN NguoiDung u ON u.MaNguoiDung = ut.MaUngVien
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'UngTuyen (applications for employer jobs)',
        `DELETE ut
         FROM UngTuyen ut
         JOIN TinTuyenDung ttd ON ttd.MaTin = ut.MaTin
         JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
         JOIN NguoiDung u ON u.MaNguoiDung = ntd.MaNguoiDung
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'LuuTin (saved jobs)',
        `DELETE lt
         FROM LuuTin lt
         JOIN NguoiDung u ON u.MaNguoiDung = lt.MaNguoiDung
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'TinNhan (messages)',
        `DELETE tn
         FROM TinNhan tn
         JOIN NguoiDung u
           ON u.MaNguoiDung = tn.MaNguoiGui
           OR u.MaNguoiDung = tn.MaNguoiNhan
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'ThongKeCongViec (job stats)',
        `DELETE tk
         FROM ThongKeCongViec tk
         JOIN TinTuyenDung ttd ON ttd.MaTin = tk.MaTin
         JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
         JOIN NguoiDung u ON u.MaNguoiDung = ntd.MaNguoiDung
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'ChiTietTin_KyNang (job skills)',
        `DELETE ctt
         FROM ChiTietTin_KyNang ctt
         JOIN TinTuyenDung ttd ON ttd.MaTin = ctt.MaTin
         JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
         JOIN NguoiDung u ON u.MaNguoiDung = ntd.MaNguoiDung
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'BaoCao (reports by users)',
        `DELETE bc
         FROM BaoCao bc
         JOIN NguoiDung u ON u.MaNguoiDung = bc.MaNguoiBaoCao
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'BinhLuanCamNangNgheNghiep (comments)',
        `DELETE cgc
         FROM BinhLuanCamNangNgheNghiep cgc
         JOIN NguoiDung u ON u.MaNguoiDung = cgc.MaNguoiDung
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'CamNangNgheNghiep (posts)',
        `DELETE cg
         FROM CamNangNgheNghiep cg
         JOIN NguoiDung u ON u.MaNguoiDung = cg.MaTacGia
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'DanhGiaCongTy (ratings)',
        `DELETE dgc
         FROM DanhGiaCongTy dgc
         LEFT JOIN NguoiDung uv ON uv.MaNguoiDung = dgc.MaUngVien
         LEFT JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = dgc.MaNhaTuyenDung
         LEFT JOIN NguoiDung ntdUser ON ntdUser.MaNguoiDung = ntd.MaNguoiDung
         WHERE uv.VaiTro IN (?, ?) OR ntdUser.VaiTro IN (?, ?)`,
        [...TARGET_ROLES, ...TARGET_ROLES]
      )
    );

    report.push(
      await runDelete(
        'BinhLuanCongTy (company comments)',
        `DELETE bl
         FROM BinhLuanCongTy bl
         LEFT JOIN NguoiDung u ON u.MaNguoiDung = bl.MaNguoiDung
         LEFT JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = bl.MaNhaTuyenDung
         LEFT JOIN NguoiDung ntdUser ON ntdUser.MaNguoiDung = ntd.MaNguoiDung
         WHERE u.VaiTro IN (?, ?) OR ntdUser.VaiTro IN (?, ?)`,
        [...TARGET_ROLES, ...TARGET_ROLES]
      )
    );

    report.push(
      await runDelete(
        'TinTuyenDung (jobs)',
        `DELETE ttd
         FROM TinTuyenDung ttd
         JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
         JOIN NguoiDung u ON u.MaNguoiDung = ntd.MaNguoiDung
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'HoSoCV (CV profiles)',
        `DELETE hscv
         FROM HoSoCV hscv
         JOIN NguoiDung u ON u.MaNguoiDung = hscv.MaNguoiDung
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'HoSoUngVien (candidate profiles)',
        `DELETE hsuv
         FROM HoSoUngVien hsuv
         JOIN NguoiDung u ON u.MaNguoiDung = hsuv.MaNguoiDung
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'CongTy (company records by representative)',
        `DELETE ct
         FROM CongTy ct
         JOIN NguoiDung u ON u.MaNguoiDung = ct.NguoiDaiDien
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'NhaTuyenDung (employer records)',
        `DELETE ntd
         FROM NhaTuyenDung ntd
         JOIN NguoiDung u ON u.MaNguoiDung = ntd.MaNguoiDung
         WHERE u.VaiTro IN (?, ?)`
      )
    );

    report.push(
      await runDelete(
        'LuuCV (orphans by missing employer)',
        `DELETE lc
         FROM LuuCV lc
         LEFT JOIN NhaTuyenDung n ON n.MaNhaTuyenDung = lc.MaNhaTuyenDung
         LEFT JOIN NguoiDung u ON u.MaNguoiDung = n.MaNguoiDung
         WHERE u.MaNguoiDung IS NULL`,
        []
      )
    );

    report.push(
      await runDelete(
        'DanhGiaCongTy (orphans by missing employer)',
        `DELETE dgc
         FROM DanhGiaCongTy dgc
         LEFT JOIN NhaTuyenDung n ON n.MaNhaTuyenDung = dgc.MaNhaTuyenDung
         LEFT JOIN NguoiDung u ON u.MaNguoiDung = n.MaNguoiDung
         WHERE u.MaNguoiDung IS NULL`,
        []
      )
    );

    report.push(
      await runDelete(
        'BinhLuanCongTy (orphans by missing employer)',
        `DELETE bl
         FROM BinhLuanCongTy bl
         LEFT JOIN NhaTuyenDung n ON n.MaNhaTuyenDung = bl.MaNhaTuyenDung
         LEFT JOIN NguoiDung u ON u.MaNguoiDung = n.MaNguoiDung
         WHERE u.MaNguoiDung IS NULL`,
        []
      )
    );

    report.push(
      await runDelete(
        'ChiTietTin_KyNang (orphans by missing employer)',
        `DELETE ctt
         FROM ChiTietTin_KyNang ctt
         JOIN TinTuyenDung t ON t.MaTin = ctt.MaTin
         LEFT JOIN NhaTuyenDung n ON n.MaNhaTuyenDung = t.MaNhaTuyenDung
         LEFT JOIN NguoiDung u ON u.MaNguoiDung = n.MaNguoiDung
         WHERE u.MaNguoiDung IS NULL`,
        []
      )
    );

    report.push(
      await runDelete(
        'ThongKeCongViec (orphans by missing employer)',
        `DELETE tk
         FROM ThongKeCongViec tk
         JOIN TinTuyenDung t ON t.MaTin = tk.MaTin
         LEFT JOIN NhaTuyenDung n ON n.MaNhaTuyenDung = t.MaNhaTuyenDung
         LEFT JOIN NguoiDung u ON u.MaNguoiDung = n.MaNguoiDung
         WHERE u.MaNguoiDung IS NULL`,
        []
      )
    );

    report.push(
      await runDelete(
        'UngTuyen (orphans by missing employer job)',
        `DELETE ut
         FROM UngTuyen ut
         JOIN TinTuyenDung t ON t.MaTin = ut.MaTin
         LEFT JOIN NhaTuyenDung n ON n.MaNhaTuyenDung = t.MaNhaTuyenDung
         LEFT JOIN NguoiDung u ON u.MaNguoiDung = n.MaNguoiDung
         WHERE u.MaNguoiDung IS NULL`,
        []
      )
    );

    report.push(
      await runDelete(
        'TinTuyenDung (orphans by missing employer)',
        `DELETE t
         FROM TinTuyenDung t
         LEFT JOIN NhaTuyenDung n ON n.MaNhaTuyenDung = t.MaNhaTuyenDung
         LEFT JOIN NguoiDung u ON u.MaNguoiDung = n.MaNguoiDung
         WHERE u.MaNguoiDung IS NULL`,
        []
      )
    );

    report.push(
      await runDelete(
        'NhaTuyenDung (orphan records)',
        `DELETE n
         FROM NhaTuyenDung n
         LEFT JOIN NguoiDung u ON u.MaNguoiDung = n.MaNguoiDung
         WHERE u.MaNguoiDung IS NULL`,
        []
      )
    );

    report.push(
      await runDelete(
        'CongTy (orphan representatives)',
        `DELETE c
         FROM CongTy c
         LEFT JOIN NguoiDung u ON u.MaNguoiDung = c.NguoiDaiDien
         WHERE c.NguoiDaiDien IS NOT NULL AND u.MaNguoiDung IS NULL`,
        []
      )
    );

    report.push(
      await runDelete(
        'NguoiDung (target users)',
        `DELETE FROM NguoiDung WHERE VaiTro IN (?, ?)`
      )
    );

    await connection.commit();

    console.log('\nDeleted rows by table:');
    console.table(report);

    const [afterRoles] = await connection.query(
      'SELECT VaiTro, COUNT(*) AS total FROM NguoiDung GROUP BY VaiTro ORDER BY total DESC'
    );

    console.log('After purge (NguoiDung by role):');
    console.table(afterRoles);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('Purge failed:', err.message);
  process.exit(1);
});
