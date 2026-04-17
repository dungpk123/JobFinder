Hướng dẫn viết và chạy migration cho SQLite

1) Tạo file .sql trong thư mục này, ví dụ: 001_add_quymo_congty.sql
   Nội dung mẫu:

   -- Thêm cột QuyMo cho bảng CongTy
   ALTER TABLE CongTy ADD COLUMN QuyMo TEXT;

   -- Ví dụ cập nhật dữ liệu mặc định (tùy chọn)
   -- UPDATE CongTy SET QuyMo = '50-100' WHERE QuyMo IS NULL;

2) Chạy migration:
   Từ thư mục server:
     node tools\run-sql.js tools\migrations\001_add_quymo_congty.sql
   (Mặc định áp vào .\data\timkiemvieclam.db. Bạn có thể truyền DB khác ở tham số 2.)

3) Kiểm tra kết quả:
     node tools\dump-db.js .\data\timkiemvieclam.db

Ghi chú:
- SQLite không hỗ trợ DROP COLUMN trực tiếp. Nếu cần xóa cột, hãy tạo bảng tạm với schema mới, copy dữ liệu, xóa bảng cũ và đổi tên:

   BEGIN TRANSACTION;
   CREATE TABLE CongTy_new AS SELECT MaCongTy, TenCongTy, MaSoThue, DiaChi, ThanhPho, Website, MoTa, Logo, NguoiDaiDien, NgayTao, NgayCapNhat FROM CongTy;
   DROP TABLE CongTy;
   ALTER TABLE CongTy_new RENAME TO CongTy;
   COMMIT;

- Hãy backup file DB trước khi chạy migration trên dữ liệu thật.

Migration đã thêm trong đợt này:
- 003_drop_unused_notifications_and_last_login.sql
   - Xóa cột không dùng: LanDangNhapCuoi (NguoiDung)
   - Xóa bảng không dùng runtime: ThongBao
