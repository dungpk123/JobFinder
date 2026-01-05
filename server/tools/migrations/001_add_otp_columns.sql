-- Add OTP columns used by auth routes
-- Backup your DB first: copy data/timkiemvieclam.db to a safe location

ALTER TABLE NguoiDung ADD COLUMN MaXacThuc TEXT;
ALTER TABLE NguoiDung ADD COLUMN ThoiGianMaXacThuc TEXT;

-- Optionally initialize values for existing users (uncomment if desired)
-- UPDATE NguoiDung SET MaXacThuc = NULL, ThoiGianMaXacThuc = NULL WHERE MaXacThuc IS NULL;
