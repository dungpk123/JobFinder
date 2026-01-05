const express = require('express');
const db = require('../config/sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const getCompanyWithOwner = async (id) => {
  return dbGet(
    `SELECT
        c.MaCongTy,
        c.TenCongTy,
        c.MaSoThue,
        c.ThanhPho,
        c.Website,
        c.NguoiDaiDien,
        nd.TrangThai AS TrangThaiDaiDien,
        nd.Email AS EmailDaiDien,
        nd.HoTen AS TenNguoiDaiDien
     FROM CongTy c
     LEFT JOIN NguoiDung nd ON nd.MaNguoiDung = c.NguoiDaiDien
     WHERE c.MaCongTy = ?`,
    [id]
  );
};

const toInt = (v, def) => {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : def;
};

router.use(authenticateToken, authorizeRole(['Quản trị', 'Siêu quản trị viên']));

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || !req.user.isSuperAdmin) {
    return res.status(403).json({ success: false, error: 'Chỉ Siêu quản trị viên mới có quyền thực hiện thao tác này' });
  }
  return next();
};

router.get('/overview', async (req, res) => {
  const tables = [
    'NguoiDung',
    'CongTy',
    'NhaTuyenDung',
    'TinTuyenDung',
    'HoSoUngVien',
    'HoSoCV',
    'UngTuyen',
    'LuuTin',
    'ThongBao',
    'BaoCao',
    'NhatKyQuanTri',
    'DanhMucCongViec',
    'KyNang'
  ];

  const counts = {};
  await Promise.all(
    tables.map(async (t) => {
      try {
        const row = await dbGet(`SELECT COUNT(*) AS c FROM ${t}`);
        counts[t] = row?.c != null ? Number(row.c) : 0;
      } catch {
        counts[t] = 0;
      }
    })
  );

  return res.json({ success: true, counts });
});

router.get('/users', async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
    const offset = Math.max(toInt(req.query.offset, 0), 0);

    const rows = await dbAll(
            `SELECT MaNguoiDung, Email, HoTen, SoDienThoai,
              CASE WHEN IFNULL(IsSuperAdmin, 0) = 1 THEN 'Siêu quản trị viên' ELSE VaiTro END AS VaiTro,
              TrangThai, NgayTao, IFNULL(IsSuperAdmin, 0) AS IsSuperAdmin
       FROM NguoiDung
       ORDER BY MaNguoiDung DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return res.json({ success: true, users: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const allowedRoles = ['Ứng viên', 'Nhà tuyển dụng', 'Quản trị'];
    const role = req.body?.role != null ? String(req.body.role) : null;
    const status = req.body?.status != null ? toInt(req.body.status, null) : null;

    if (role != null && !allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'VaiTro không hợp lệ' });
    }
    if (status != null && ![0, 1].includes(status)) {
      return res.status(400).json({ success: false, error: 'TrangThai không hợp lệ (0/1)' });
    }

    const target = await dbGet(
      'SELECT MaNguoiDung, VaiTro, IFNULL(IsSuperAdmin, 0) AS IsSuperAdmin FROM NguoiDung WHERE MaNguoiDung = ?',
      [id]
    );
    if (!target) return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });

    if (Number(target.IsSuperAdmin) === 1 || target.VaiTro === 'Quản trị') {
      return res.status(400).json({ success: false, error: 'Không thể chỉnh sửa tài khoản quản trị/siêu quản trị' });
    }

    const fields = [];
    const params = [];
    if (role != null) {
      fields.push('VaiTro = ?');
      params.push(role);
    }
    if (status != null) {
      fields.push('TrangThai = ?');
      params.push(status);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có dữ liệu cập nhật' });
    }

    fields.push('NgayCapNhat = datetime("now", "localtime")');

    await dbRun(`UPDATE NguoiDung SET ${fields.join(', ')} WHERE MaNguoiDung = ?`, [...params, id]);

    const user = await dbGet(
            `SELECT MaNguoiDung, Email, HoTen, SoDienThoai,
              CASE WHEN IFNULL(IsSuperAdmin, 0) = 1 THEN 'Siêu quản trị viên' ELSE VaiTro END AS VaiTro,
              TrangThai, NgayTao, IFNULL(IsSuperAdmin, 0) AS IsSuperAdmin
       FROM NguoiDung
       WHERE MaNguoiDung = ?`,
      [id]
    );

    return res.json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    if (req.user?.id === id) {
      return res.status(400).json({ success: false, error: 'Không thể tự xóa tài khoản của bạn' });
    }

    const target = await dbGet(
      'SELECT MaNguoiDung, Email, VaiTro, IFNULL(IsSuperAdmin, 0) AS IsSuperAdmin FROM NguoiDung WHERE MaNguoiDung = ?',
      [id]
    );
    if (!target) return res.status(404).json({ success: false, error: 'Không tìm thấy người dùng' });

    if (Number(target.IsSuperAdmin) === 1 || target.VaiTro === 'Quản trị') {
      return res.status(400).json({ success: false, error: 'Không thể xóa tài khoản quản trị/siêu quản trị' });
    }

    await dbRun('DELETE FROM NguoiDung WHERE MaNguoiDung = ?', [id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
    const offset = Math.max(toInt(req.query.offset, 0), 0);

    const rows = await dbAll(
      `SELECT
          ttd.MaTin,
          ttd.TieuDe,
          ttd.ThanhPho,
          ttd.TrangThai,
          ttd.NgayDang,
          ntd.MaNhaTuyenDung,
          ntd.TenCongTy
       FROM TinTuyenDung ttd
       LEFT JOIN NhaTuyenDung ntd ON ntd.MaNhaTuyenDung = ttd.MaNhaTuyenDung
       ORDER BY datetime(ttd.NgayDang) DESC, ttd.MaTin DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return res.json({ success: true, jobs: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.patch('/jobs/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const allowedStatuses = ['Nháp', 'Đã đăng', 'Đã đóng', 'Lưu trữ'];
    const status = String(req.body?.status || '').trim();
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'TrangThai không hợp lệ' });
    }

    const existing = await dbGet('SELECT MaTin FROM TinTuyenDung WHERE MaTin = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy tin tuyển dụng' });

    await dbRun(
      'UPDATE TinTuyenDung SET TrangThai = ? WHERE MaTin = ?',
      [status, id]
    );

    const job = await dbGet(
      `SELECT MaTin, TieuDe, ThanhPho, TrangThai, NgayDang, MaNhaTuyenDung
       FROM TinTuyenDung
       WHERE MaTin = ?`,
      [id]
    );

    return res.json({ success: true, job });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.delete('/jobs/:id', requireSuperAdmin, async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const existing = await dbGet('SELECT MaTin FROM TinTuyenDung WHERE MaTin = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy tin tuyển dụng' });

    await dbRun('DELETE FROM TinTuyenDung WHERE MaTin = ?', [id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.get('/companies', async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
    const offset = Math.max(toInt(req.query.offset, 0), 0);

    const rows = await dbAll(
      `SELECT
          c.MaCongTy,
          c.TenCongTy,
          c.MaSoThue,
          c.ThanhPho,
          c.Website,
          c.NguoiDaiDien,
          c.NgayTao,
          nd.TrangThai AS TrangThaiDaiDien,
          nd.Email AS EmailDaiDien,
          nd.HoTen AS TenNguoiDaiDien
       FROM CongTy c
       LEFT JOIN NguoiDung nd ON nd.MaNguoiDung = c.NguoiDaiDien
       ORDER BY c.MaCongTy DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return res.json({ success: true, companies: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.patch('/companies/:id', requireSuperAdmin, async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const status = req.body?.status != null ? toInt(req.body.status, null) : null;
    if (status == null || ![0, 1].includes(status)) {
      return res.status(400).json({ success: false, error: 'TrangThai không hợp lệ (0/1)' });
    }

    const company = await getCompanyWithOwner(id);
    if (!company) return res.status(404).json({ success: false, error: 'Không tìm thấy công ty' });

    if (company.NguoiDaiDien) {
      await dbRun(
        'UPDATE NguoiDung SET TrangThai = ?, NgayCapNhat = datetime("now", "localtime") WHERE MaNguoiDung = ?',
        [status, company.NguoiDaiDien]
      );
    }

    const updated = await getCompanyWithOwner(id);
    return res.json({ success: true, company: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.delete('/companies/:id', requireSuperAdmin, async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const company = await dbGet('SELECT MaCongTy FROM CongTy WHERE MaCongTy = ?', [id]);
    if (!company) return res.status(404).json({ success: false, error: 'Không tìm thấy công ty' });

    await dbRun('DELETE FROM CongTy WHERE MaCongTy = ?', [id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
    const offset = Math.max(toInt(req.query.offset, 0), 0);

    const rows = await dbAll(
      `SELECT
          bc.MaBaoCao,
          bc.MaNguoiBaoCao,
          nd.Email AS EmailNguoiBaoCao,
          bc.LoaiDoiTuong,
          bc.MaDoiTuong,
          bc.LyDo,
          bc.ChiTiet,
          bc.TrangThai,
          bc.NgayBaoCao
       FROM BaoCao bc
       LEFT JOIN NguoiDung nd ON nd.MaNguoiDung = bc.MaNguoiBaoCao
       ORDER BY datetime(bc.NgayBaoCao) DESC, bc.MaBaoCao DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return res.json({ success: true, reports: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const id = toInt(req.params.id, NaN);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, error: 'id không hợp lệ' });

    const status = String(req.body?.status || '').trim();
    if (!status) return res.status(400).json({ success: false, error: 'TrangThai không hợp lệ' });

    const existing = await dbGet('SELECT MaBaoCao FROM BaoCao WHERE MaBaoCao = ?', [id]);
    if (!existing) return res.status(404).json({ success: false, error: 'Không tìm thấy báo cáo' });

    await dbRun('UPDATE BaoCao SET TrangThai = ? WHERE MaBaoCao = ?', [status, id]);

    const report = await dbGet(
      `SELECT MaBaoCao, MaNguoiBaoCao, LoaiDoiTuong, MaDoiTuong, LyDo, ChiTiet, TrangThai, NgayBaoCao
       FROM BaoCao
       WHERE MaBaoCao = ?`,
      [id]
    );

    return res.json({ success: true, report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

module.exports = router;
