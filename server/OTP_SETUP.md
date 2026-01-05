# Hệ thống xác thực email với OTP

## Đã hoàn tất

### Backend:
1. ✅ Cài đặt `nodemailer` để gửi email
2. ✅ Thêm cột `MaXacThuc`, `ThoiGianMaXacThuc` vào bảng `NguoiDung`
3. ✅ Thay đổi `TrangThai` mặc định = 0 (chưa xác thực)
4. ✅ Tạo file `server/config/email.js` với hàm gửi email
5. ✅ Cập nhật routes:
   - `/auth/register` - Gửi OTP qua email thay vì đăng ký trực tiếp
   - `/auth/register-employer` - Gửi OTP cho nhà tuyển dụng
   - `/auth/verify-otp` - Xác thực mã OTP
   - `/auth/resend-otp` - Gửi lại mã OTP
   - `/auth/login` - Kiểm tra tài khoản đã xác thực chưa

### Frontend:
1. ✅ Tạo component `VerifyOTP.js` - Trang nhập mã xác thực
2. ✅ Thêm route `/verify-otp` vào App.js
3. ✅ Cập nhật Register và EmployerRegister để chuyển đến trang OTP

## Cần làm để hoàn thiện:

### 1. Cấu hình Email (QUAN TRỌNG):
```bash
# Tạo file .env trong thư mục server
cd server
cp .env.example .env
```

Sau đó chỉnh sửa file `.env`:
```
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-password
```

**Hướng dẫn tạo App Password cho Gmail:**
1. Truy cập: https://myaccount.google.com/security
2. Bật "2-Step Verification" (nếu chưa bật)
3. Tìm "App passwords"
4. Tạo mật khẩu ứng dụng mới cho "Mail"
5. Copy mật khẩu 16 ký tự vào `EMAIL_PASSWORD`

### 2. Cài package dotenv:
```bash
cd server
npm install dotenv
```

### 3. Load biến môi trường trong server:
Thêm vào đầu file `server/app.js` hoặc `server/bin/www`:
```javascript
require('dotenv').config();
```

### 4. Khởi động lại database:
```bash
cd server
node config/sqlite.js
```

### 5. Test hệ thống:
1. Khởi động server: `cd server && node ./bin/www`
2. Khởi động client: `cd client && npm start`
3. Đăng ký tài khoản mới
4. Kiểm tra email để lấy mã OTP
5. Nhập mã OTP vào form xác thực
6. Đăng nhập bằng tài khoản đã xác thực

## Lưu ý:
- Mã OTP có hiệu lực 10 phút
- Tài khoản chưa xác thực không thể đăng nhập
- Có thể gửi lại mã OTP nếu không nhận được
- Email gửi từ Gmail có thể vào spam, kiểm tra thư mục spam

---

## Tùy chọn KHÔNG cần 2FA: Gmail OAuth2
Bạn có thể gửi email qua Gmail mà không cần bật 2FA bằng cách dùng OAuth2.

### Bước A: Bật Gmail API và tạo OAuth Client
1. Vào Google Cloud Console: https://console.cloud.google.com/
2. Tạo Project (nếu chưa có)
3. Vào APIs & Services → Library → bật "Gmail API"
4. Vào "Credentials" → "Create Credentials" → "OAuth client ID"
5. Application type: "Desktop app" → đặt tên → Create
6. Ghi lại Client ID và Client Secret

### Bước B: Lấy Refresh Token
1. Mở OAuth Playground: https://developers.google.com/oauthplayground/
2. Bên phải, bấm bánh răng → tick "Use your own OAuth credentials" → nhập Client ID/Secret
3. Ở Step 1, chọn scope: `https://mail.google.com/` → Authorize APIs → chọn đúng Gmail của bạn → Allow
4. Step 2 → Exchange authorization code for tokens → copy Refresh Token

### Bước C: Điền biến môi trường
Mở `server/.env` và thêm:
```
EMAIL_USER=your-gmail@gmail.com
EMAIL_OAUTH_CLIENT_ID=...
EMAIL_OAUTH_CLIENT_SECRET=...
EMAIL_OAUTH_REFRESH_TOKEN=...
```

Không cần `EMAIL_PASSWORD` khi dùng OAuth2.

### Bước D: Cài đặt phụ thuộc
```
cd server
npm install googleapis
```

Khởi động lại server để áp dụng.
