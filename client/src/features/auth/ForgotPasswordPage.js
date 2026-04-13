import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from './components/AuthLayout';
import ForgotPassword from './ForgotPassword';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();

  return (
    <AuthLayout
      mode="forgot"
      title="Khôi phục mật khẩu"
      subtitle="Nhập email, xác thực OTP rồi đặt mật khẩu mới."
      switchText="Đã nhớ mật khẩu?"
      switchLabel="Đăng nhập"
      switchTo="/login"
      heroImage="/images/auth-career-hero.svg"
      heroTitle="Lấy lại quyền truy cập một cách an toàn."
      heroSubtitle="Hệ thống xác thực từng bước để bảo vệ tài khoản và dữ liệu hồ sơ của bạn."
    >
      <div className="auth-forgot-panel">
        <ForgotPassword inline={true} onClose={() => navigate('/login')} />
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
