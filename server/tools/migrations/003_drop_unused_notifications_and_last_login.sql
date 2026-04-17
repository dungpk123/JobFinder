-- SQLite migration: prune unused fields/tables.
-- Run from server folder:
-- node tools\run-sql.js tools\migrations\003_drop_unused_notifications_and_last_login.sql

-- Note: DROP COLUMN requires SQLite 3.35+.
ALTER TABLE NguoiDung DROP COLUMN LanDangNhapCuoi;
DROP TABLE IF EXISTS ThongBao;
