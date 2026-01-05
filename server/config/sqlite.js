const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '..', 'data', 'timkiemvieclam.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('SQLite connection error:', err);
    } else {
        console.log('✅ Connected to SQLite database');
    }
});

// Initialize database schema
db.serialize(() => {
    // NguoiDung table
    db.run(`
        CREATE TABLE IF NOT EXISTS NguoiDung (
            MaNguoiDung INTEGER PRIMARY KEY AUTOINCREMENT,
            Email TEXT NOT NULL UNIQUE,
            MatKhau TEXT NOT NULL,
            HoTen TEXT,
            SoDienThoai TEXT,
            VaiTro TEXT CHECK (VaiTro IN ('Ứng viên', 'Nhà tuyển dụng', 'Quản trị')) DEFAULT 'Ứng viên',
            TrangThai INTEGER DEFAULT 1,
            DiaChi TEXT,
            NgayTao TEXT DEFAULT (datetime('now', 'localtime')),
            NgayCapNhat TEXT DEFAULT (datetime('now', 'localtime')),
            LanDangNhapCuoi TEXT,
            SoLanDangNhapSai INTEGER DEFAULT 0,
            ThoiGianKhoaDangNhap TEXT DEFAULT NULL
        )
    `);

    // CongTy table
    db.run(`
        CREATE TABLE IF NOT EXISTS CongTy (
            MaCongTy INTEGER PRIMARY KEY AUTOINCREMENT,
            TenCongTy TEXT NOT NULL,
            MaSoThue TEXT,
            DiaChi TEXT,
            ThanhPho TEXT,
            Website TEXT,
            LinhVuc TEXT,
            MoTa TEXT,
            Logo TEXT,
            NguoiDaiDien INTEGER,
            NgayTao TEXT DEFAULT (datetime('now', 'localtime')),
            NgayCapNhat TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (NguoiDaiDien) REFERENCES NguoiDung(MaNguoiDung) ON DELETE SET NULL
        )
    `);

    // HoSoUngVien table
    db.run(`
        CREATE TABLE IF NOT EXISTS HoSoUngVien (
            MaHoSo INTEGER PRIMARY KEY AUTOINCREMENT,
            MaNguoiDung INTEGER NOT NULL UNIQUE,
            NgaySinh TEXT,
            GioiTinh TEXT CHECK (GioiTinh IN ('Nam', 'Nữ', 'Khác')),
            DiaChi TEXT,
            ThanhPho TEXT,
            QuanHuyen TEXT,
            GioiThieuBanThan TEXT,
            SoNamKinhNghiem INTEGER DEFAULT 0,
            TrinhDoHocVan TEXT,
            AnhDaiDien TEXT,
            ChucDanh TEXT,
            LinkCaNhan TEXT,
            EducationListJson TEXT,
            WorkListJson TEXT,
            LanguageListJson TEXT,
            NgayTao TEXT DEFAULT (datetime('now', 'localtime')),
            NgayCapNhat TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (MaNguoiDung) REFERENCES NguoiDung(MaNguoiDung) ON DELETE CASCADE
        )
    `);

    // NhaTuyenDung table
    db.run(`
        CREATE TABLE IF NOT EXISTS NhaTuyenDung (
            MaNhaTuyenDung INTEGER PRIMARY KEY AUTOINCREMENT,
            MaNguoiDung INTEGER NOT NULL UNIQUE,
            TenCongTy TEXT NOT NULL,
            MaSoThue TEXT,
            Website TEXT,
            DiaChi TEXT,
            ThanhPho TEXT,
            MoTa TEXT,
            Logo TEXT,
            NgayTao TEXT DEFAULT (datetime('now', 'localtime')),
            NgayCapNhat TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (MaNguoiDung) REFERENCES NguoiDung(MaNguoiDung) ON DELETE CASCADE
        )
    `);

    // DanhMucCongViec table
    db.run(`
        CREATE TABLE IF NOT EXISTS DanhMucCongViec (
            MaDanhMuc INTEGER PRIMARY KEY AUTOINCREMENT,
            TenDanhMuc TEXT UNIQUE NOT NULL,
            MaCha INTEGER NULL,
            FOREIGN KEY (MaCha) REFERENCES DanhMucCongViec(MaDanhMuc)
        )
    `);

    // TinTuyenDung table
    db.run(`
        CREATE TABLE IF NOT EXISTS TinTuyenDung (
            MaTin INTEGER PRIMARY KEY AUTOINCREMENT,
            MaNhaTuyenDung INTEGER NOT NULL,
            TieuDe TEXT NOT NULL,
            MoTa TEXT,
            YeuCau TEXT,
            QuyenLoi TEXT,
            KinhNghiem TEXT,
            CapBac TEXT,
            LuongTu INTEGER NULL,
            LuongDen INTEGER NULL,
            KieuLuong TEXT CHECK (KieuLuong IN ('Tháng', 'Năm', 'Thỏa thuận', 'Khoảng', 'Không xác định')) DEFAULT 'Thỏa thuận',
            DiaDiem TEXT,
            ThanhPho TEXT,
            LinhVucCongViec TEXT,
            MaDanhMuc INTEGER NULL,
            HinhThuc TEXT CHECK (HinhThuc IN ('Toàn thời gian', 'Bán thời gian', 'Thực tập', 'Từ xa', 'Hợp đồng')) DEFAULT 'Toàn thời gian',
            TrangThai TEXT CHECK (TrangThai IN ('Nháp', 'Đã đăng', 'Đã đóng', 'Lưu trữ')) DEFAULT 'Nháp',
            NgayDang TEXT DEFAULT (datetime('now', 'localtime')),
            HanNopHoSo TEXT NULL,
            LuotXem INTEGER DEFAULT 0,
            SoLuongUngTuyen INTEGER DEFAULT 0,
            FOREIGN KEY (MaNhaTuyenDung) REFERENCES NhaTuyenDung(MaNhaTuyenDung) ON DELETE CASCADE,
            FOREIGN KEY (MaDanhMuc) REFERENCES DanhMucCongViec(MaDanhMuc) ON DELETE SET NULL
        )
    `);

    // Saved CVs for employers
    db.run(`
        CREATE TABLE IF NOT EXISTS LuuCV (
            MaLuuCV INTEGER PRIMARY KEY AUTOINCREMENT,
            MaNhaTuyenDung INTEGER NOT NULL,
            MaCV INTEGER NOT NULL,
            TrangThai TEXT DEFAULT 'Đã lưu',
            NgayLuu TEXT DEFAULT (datetime('now', 'localtime')),
            UNIQUE (MaNhaTuyenDung, MaCV),
            FOREIGN KEY (MaNhaTuyenDung) REFERENCES NhaTuyenDung(MaNhaTuyenDung) ON DELETE CASCADE,
            FOREIGN KEY (MaCV) REFERENCES HoSoCV(MaCV) ON DELETE CASCADE
        )
    `);

    // Backfill new columns for existing databases (ignore errors if they already exist)
    db.run('ALTER TABLE TinTuyenDung ADD COLUMN KinhNghiem TEXT', (err) => {
        if (err && !String(err.message || '').includes('duplicate column name')) console.error(err);
    });
    db.run('ALTER TABLE TinTuyenDung ADD COLUMN CapBac TEXT', (err) => {
        if (err && !String(err.message || '').includes('duplicate column name')) console.error(err);
    });
    db.run('ALTER TABLE TinTuyenDung ADD COLUMN LinhVucCongViec TEXT', (err) => {
        if (err && !String(err.message || '').includes('duplicate column name')) console.error(err);
    });

    db.run('ALTER TABLE CongTy ADD COLUMN LinhVuc TEXT', (err) => {
        if (err && !String(err.message || '').includes('duplicate column name')) console.error(err);
    });

    db.run('ALTER TABLE HoSoUngVien ADD COLUMN EducationListJson TEXT', (err) => {
        if (err && !String(err.message || '').includes('duplicate column name')) console.error(err);
    });
    db.run('ALTER TABLE HoSoUngVien ADD COLUMN WorkListJson TEXT', (err) => {
        if (err && !String(err.message || '').includes('duplicate column name')) console.error(err);
    });
    db.run('ALTER TABLE HoSoUngVien ADD COLUMN LanguageListJson TEXT', (err) => {
        if (err && !String(err.message || '').includes('duplicate column name')) console.error(err);
    });

    // KyNang table
    db.run(`
        CREATE TABLE IF NOT EXISTS KyNang (
            MaKyNang INTEGER PRIMARY KEY AUTOINCREMENT,
            TenKyNang TEXT UNIQUE NOT NULL
        )
    `);

    // HoSoCV table
    db.run(`
        CREATE TABLE IF NOT EXISTS HoSoCV (
            MaCV INTEGER PRIMARY KEY AUTOINCREMENT,
            MaNguoiDung INTEGER NOT NULL,
            TieuDe TEXT,
            TomTat TEXT,
            TepCV TEXT,
            MacDinh INTEGER DEFAULT 0,
            LinhVuc TEXT,
            NgayTao TEXT DEFAULT (datetime('now', 'localtime')),
            NgayCapNhat TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (MaNguoiDung) REFERENCES NguoiDung(MaNguoiDung) ON DELETE CASCADE
        )
    `);

    // ChiTietCV_KyNang table
    db.run(`
        CREATE TABLE IF NOT EXISTS ChiTietCV_KyNang (
            MaCV INTEGER NOT NULL,
            MaKyNang INTEGER NOT NULL,
            MucDo TEXT CHECK (MucDo IN ('Cơ bản', 'Trung bình', 'Khá', 'Chuyên gia')) DEFAULT 'Trung bình',
            PRIMARY KEY (MaCV, MaKyNang),
            FOREIGN KEY (MaCV) REFERENCES HoSoCV(MaCV) ON DELETE CASCADE,
            FOREIGN KEY (MaKyNang) REFERENCES KyNang(MaKyNang) ON DELETE CASCADE
        )
    `);

    // ChiTietTin_KyNang table
    db.run(`
        CREATE TABLE IF NOT EXISTS ChiTietTin_KyNang (
            MaTin INTEGER NOT NULL,
            MaKyNang INTEGER NOT NULL,
            DoQuanTrong INTEGER DEFAULT 1,
            PRIMARY KEY (MaTin, MaKyNang),
            FOREIGN KEY (MaTin) REFERENCES TinTuyenDung(MaTin) ON DELETE CASCADE,
            FOREIGN KEY (MaKyNang) REFERENCES KyNang(MaKyNang) ON DELETE CASCADE
        )
    `);

    // UngTuyen table
    db.run(`
        CREATE TABLE IF NOT EXISTS UngTuyen (
            MaUngTuyen INTEGER PRIMARY KEY AUTOINCREMENT,
            MaTin INTEGER NOT NULL,
            MaCV INTEGER NULL,
            MaUngVien INTEGER NOT NULL,
            ThuGioiThieu TEXT,
            TrangThai TEXT CHECK (TrangThai IN ('Đã nộp', 'Đang xem xét', 'Phỏng vấn', 'Đề nghị', 'Từ chối', 'Rút hồ sơ', 'Đã nhận')) DEFAULT 'Đã nộp',
            NgayNop TEXT DEFAULT (datetime('now', 'localtime')),
            GhiChu TEXT,
            FOREIGN KEY (MaTin) REFERENCES TinTuyenDung(MaTin) ON DELETE CASCADE,
            FOREIGN KEY (MaCV) REFERENCES HoSoCV(MaCV),
            FOREIGN KEY (MaUngVien) REFERENCES NguoiDung(MaNguoiDung)
        )
    `);

    // LuuTin table
    db.run(`
        CREATE TABLE IF NOT EXISTS LuuTin (
            MaNguoiDung INTEGER NOT NULL,
            MaTin INTEGER NOT NULL,
            NgayLuu TEXT DEFAULT (datetime('now', 'localtime')),
            PRIMARY KEY (MaNguoiDung, MaTin),
            FOREIGN KEY (MaNguoiDung) REFERENCES NguoiDung(MaNguoiDung) ON DELETE CASCADE,
            FOREIGN KEY (MaTin) REFERENCES TinTuyenDung(MaTin)
        )
    `);

    // ThongBao table
    db.run(`
        CREATE TABLE IF NOT EXISTS ThongBao (
            MaThongBao INTEGER PRIMARY KEY AUTOINCREMENT,
            MaNguoiDung INTEGER NOT NULL,
            TieuDe TEXT,
            NoiDung TEXT,
            DaDoc INTEGER DEFAULT 0,
            Loai TEXT,
            MaLienQuan INTEGER NULL,
            NgayTao TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (MaNguoiDung) REFERENCES NguoiDung(MaNguoiDung) ON DELETE CASCADE
        )
    `);

    // BaoCao table
    db.run(`
        CREATE TABLE IF NOT EXISTS BaoCao (
            MaBaoCao INTEGER PRIMARY KEY AUTOINCREMENT,
            MaNguoiBaoCao INTEGER NULL,
            LoaiDoiTuong TEXT CHECK (LoaiDoiTuong IN ('Tin tuyển dụng', 'Người dùng', 'Công ty')) NOT NULL,
            MaDoiTuong INTEGER NOT NULL,
            LyDo TEXT,
            ChiTiet TEXT,
            TrangThai TEXT DEFAULT 'Chưa xử lý',
            NgayBaoCao TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (MaNguoiBaoCao) REFERENCES NguoiDung(MaNguoiDung) ON DELETE SET NULL
        )
    `);

    // NhatKyQuanTri table
    db.run(`
        CREATE TABLE IF NOT EXISTS NhatKyQuanTri (
            MaNhatKy INTEGER PRIMARY KEY AUTOINCREMENT,
            MaQuanTri INTEGER NULL,
            HanhDong TEXT,
            DoiTuong TEXT,
            MaDoiTuong INTEGER NULL,
            GhiChu TEXT,
            NgayThucHien TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (MaQuanTri) REFERENCES NguoiDung(MaNguoiDung) ON DELETE SET NULL
        )
    `);

    // ThongKeCongViec table
    db.run(`
        CREATE TABLE IF NOT EXISTS ThongKeCongViec (
            MaTin INTEGER PRIMARY KEY,
            LuotXem INTEGER DEFAULT 0,
            SoLuongUngTuyen INTEGER DEFAULT 0,
            LanXemCuoi TEXT,
            FOREIGN KEY (MaTin) REFERENCES TinTuyenDung(MaTin) ON DELETE CASCADE
        )
    `);

    // TinNhan table
    db.run(`
        CREATE TABLE IF NOT EXISTS TinNhan (
            MaTinNhan INTEGER PRIMARY KEY AUTOINCREMENT,
            MaNguoiGui INTEGER NOT NULL,
            MaNguoiNhan INTEGER NOT NULL,
            MaTin INTEGER NULL,
            NoiDung TEXT NOT NULL,
            DaDoc INTEGER DEFAULT 0,
            NgayGui TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (MaNguoiGui) REFERENCES NguoiDung(MaNguoiDung),
            FOREIGN KEY (MaNguoiNhan) REFERENCES NguoiDung(MaNguoiDung),
            FOREIGN KEY (MaTin) REFERENCES TinTuyenDung(MaTin) ON DELETE SET NULL
        )
    `);

    // Insert sample data (admin user with bcrypt hashed password for '123456')
    db.run(`
        INSERT OR REPLACE INTO NguoiDung (MaNguoiDung, Email, MatKhau, HoTen, SoDienThoai, VaiTro, TrangThai, DiaChi)
        VALUES (1, 'admin@example.com', '$2b$10$Y8kqYi/IB7LyWJmHZAypPekyevKpNWyDLPXidY3rFHfayN3oBbFAG', 'Lê Quản Trị', '0123456789', 'Quản trị', 1, 'Hà Nội')
    `);

    db.run(`
        INSERT OR REPLACE INTO NguoiDung (MaNguoiDung, Email, MatKhau, HoTen, SoDienThoai, VaiTro, TrangThai, DiaChi)
        VALUES (2, 'ungvien@example.com', '$2b$10$Y8kqYi/IB7LyWJmHZAypPekyevKpNWyDLPXidY3rFHfayN3oBbFAG', 'Nguyễn Văn A', '0987654321', 'Ứng viên', 1, 'Hồ Chí Minh')
    `);

    db.run(`
        INSERT OR REPLACE INTO NguoiDung (MaNguoiDung, Email, MatKhau, HoTen, SoDienThoai, VaiTro, TrangThai, DiaChi)
        VALUES (3, 'tuyendung@example.com', '$2b$10$Y8kqYi/IB7LyWJmHZAypPekyevKpNWyDLPXidY3rFHfayN3oBbFAG', 'Công ty ABC', '0901234567', 'Nhà tuyển dụng', 1, 'Đà Nẵng')
    `);
});

module.exports = db;
