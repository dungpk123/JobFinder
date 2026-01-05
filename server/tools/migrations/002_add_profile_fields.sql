-- Add profile fields for candidate resume
-- ChucDanh: job title, LinkCaNhan: personal URL

ALTER TABLE HoSoUngVien ADD COLUMN ChucDanh TEXT;
ALTER TABLE HoSoUngVien ADD COLUMN LinkCaNhan TEXT;

-- Optional: initialize existing rows to empty strings
-- UPDATE HoSoUngVien SET ChucDanh = '' WHERE ChucDanh IS NULL;
-- UPDATE HoSoUngVien SET LinkCaNhan = '' WHERE LinkCaNhan IS NULL;
