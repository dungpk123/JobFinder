import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotification } from '../../../components/NotificationProvider';
import { API_BASE as CLIENT_API_BASE } from '../../../config/apiBase';

const EmployerRegisterForm = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const apiBase = CLIENT_API_BASE;

  const [formData, setFormData] = useState({
    companyName: '',
    taxCode: '',
    address: '',
    contactPerson: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Vui lòng nhập địa chỉ email hợp lệ');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (formData.password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    if (!hasLetter || !hasNumber) {
      setError('Mật khẩu phải bao gồm cả chữ và số');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${apiBase}/auth/register-employer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.contactPerson,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          companyName: formData.companyName,
          taxCode: formData.taxCode,
          address: formData.address
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Đăng ký thất bại');
      }

      if (data.requireVerification) {
        navigate('/verify-otp', {
          state: {
            email: formData.email,
            otpDeliveryFailed: Boolean(data.otpDeliveryFailed),
            verificationMessage: data.message || '',
            otp: String(data.otp || '')
          }
        });
      } else {
        notify({ type: 'success', message: 'Đăng ký nhà tuyển dụng thành công! Vui lòng đăng nhập.' });
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/login');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-grid-two">
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="companyName">Tên công ty</label>
          <input
            id="companyName"
            type="text"
            name="companyName"
            className="auth-input"
            placeholder="Công ty ABC"
            value={formData.companyName}
            onChange={handleChange}
            required
          />
        </div>
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="taxCode">Mã số thuế</label>
          <input
            id="taxCode"
            type="text"
            name="taxCode"
            className="auth-input"
            placeholder="0123456789"
            value={formData.taxCode}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-field-label" htmlFor="address">Địa chỉ công ty</label>
        <input
          id="address"
          type="text"
          name="address"
          className="auth-input"
          placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
          value={formData.address}
          onChange={handleChange}
          required
        />
      </div>

      <div className="auth-grid-two">
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="contactPerson">Người liên hệ</label>
          <input
            id="contactPerson"
            type="text"
            name="contactPerson"
            className="auth-input"
            placeholder="Nguyễn Văn B"
            value={formData.contactPerson}
            onChange={handleChange}
            required
          />
        </div>
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="employerPhone">Số điện thoại</label>
          <input
            id="employerPhone"
            type="tel"
            name="phone"
            className="auth-input"
            placeholder="09xxxxxxxx"
            value={formData.phone}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-field-label" htmlFor="employerEmail">Email</label>
        <input
          id="employerEmail"
          type="email"
          name="email"
          className="auth-input"
          placeholder="hr@company.com"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>

      <div className="auth-grid-two">
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="employerPassword">Mật khẩu</label>
          <div className="auth-input-wrap">
            <input
              id="employerPassword"
              type={showPassword ? 'text' : 'password'}
              name="password"
              className="auth-input auth-input--with-icon"
              placeholder="Tối thiểu 8 ký tự"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="auth-password-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
            </button>
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-field-label" htmlFor="employerConfirmPassword">Xác nhận mật khẩu</label>
          <div className="auth-input-wrap">
            <input
              id="employerConfirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              className="auth-input auth-input--with-icon"
              placeholder="Nhập lại mật khẩu"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
            <button
              type="button"
              className="auth-password-btn"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="auth-error-banner">{error}</div> : null}

      <button type="submit" className="auth-submit-btn" disabled={loading}>
        {loading ? 'Đang xử lý...' : 'Tạo tài khoản nhà tuyển dụng'}
        <i className="bi bi-arrow-right"></i>
      </button>

      <p className="auth-switch-inline">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </form>
  );
};

export default EmployerRegisterForm;
