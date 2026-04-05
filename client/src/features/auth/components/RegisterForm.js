import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotification } from '../../../components/NotificationProvider';
import { API_BASE as CLIENT_API_BASE } from '../../../config/apiBase';

const days = Array.from({ length: 31 }, (_, idx) => idx + 1);
const years = Array.from({ length: 80 }, (_, idx) => new Date().getFullYear() - idx);
const months = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

const RegisterForm = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { notify } = useNotification();
  const apiBase = CLIENT_API_BASE;

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    day: days[0],
    month: months[0],
    year: years[0],
    gender: 'Nữ',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const fullName = `${formData.lastName} ${formData.firstName}`.trim();

    const monthIndex = months.indexOf(formData.month) + 1;
    const birthDate = new Date(formData.year, monthIndex - 1, formData.day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 16) {
      setLoading(false);
      setError('Bạn phải đủ 16 tuổi để đăng ký tài khoản');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setLoading(false);
      setError('Vui lòng nhập địa chỉ email hợp lệ');
      return;
    }

    if (formData.phone && !/^[0-9]{9,12}$/.test(formData.phone.trim())) {
      setLoading(false);
      setError('Số điện thoại phải gồm 9 đến 12 chữ số');
      return;
    }

    if (formData.password.length < 8) {
      setLoading(false);
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }

    const hasLetter = /[a-zA-Z]/.test(formData.password);
    const hasNumber = /[0-9]/.test(formData.password);
    if (!hasLetter || !hasNumber) {
      setLoading(false);
      setError('Mật khẩu phải bao gồm cả chữ và số');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setLoading(false);
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      const response = await fetch(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          name: fullName,
          phone: formData.phone.trim(),
          role: 'Ứng viên'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Đăng ký thất bại');
      }

      if (data.requireVerification) {
        if (onSuccess) {
          onSuccess();
        }
        navigate('/verify-otp', {
          state: {
            email: formData.email,
            otpDeliveryFailed: Boolean(data.otpDeliveryFailed),
            verificationMessage: data.message || ''
          }
        });
      } else {
        notify({ type: 'success', message: 'Đăng ký thành công! Vui lòng đăng nhập.' });
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

  const helpText = useMemo(
    () => 'Hồ sơ được tối ưu sẽ giúp bạn tiếp cận cơ hội phù hợp nhanh hơn trên JobFinder.',
    []
  );

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="auth-grid-two">
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="registerLastName">Họ</label>
          <input
            id="registerLastName"
            type="text"
            name="lastName"
            className="auth-input"
            placeholder="Nguyễn"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
        </div>
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="registerFirstName">Tên</label>
          <input
            id="registerFirstName"
            type="text"
            name="firstName"
            className="auth-input"
            placeholder="Văn A"
            value={formData.firstName}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-field-label">Ngày sinh</label>
        <div className="auth-grid-two">
          <select name="day" className="auth-select" value={formData.day} onChange={handleChange}>
            {days.map((day) => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
          <select name="month" className="auth-select" value={formData.month} onChange={handleChange}>
            {months.map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </div>
        <select
          name="year"
          className="auth-select"
          value={formData.year}
          onChange={handleChange}
          style={{ marginTop: 10 }}
        >
          {years.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="auth-field">
        <label className="auth-field-label">Giới tính</label>
        <div className="auth-radio-group">
          {['Nữ', 'Nam', 'Tùy chỉnh'].map((label) => (
            <label key={label} className="auth-radio-chip">
              <input
                type="radio"
                name="gender"
                value={label}
                checked={formData.gender === label}
                onChange={handleChange}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="auth-grid-two">
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="registerEmail">Email</label>
          <input
            id="registerEmail"
            type="email"
            name="email"
            className="auth-input"
            placeholder="name@example.com"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="registerPhone">Số điện thoại</label>
          <input
            id="registerPhone"
            type="tel"
            name="phone"
            className="auth-input"
            placeholder="09xxxxxxxx"
            value={formData.phone}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="auth-grid-two">
        <div className="auth-field">
          <label className="auth-field-label" htmlFor="registerPassword">Mật khẩu</label>
          <div className="auth-input-wrap">
            <input
              id="registerPassword"
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
          <label className="auth-field-label" htmlFor="registerConfirmPassword">Xác nhận mật khẩu</label>
          <div className="auth-input-wrap">
            <input
              id="registerConfirmPassword"
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

      <p className="auth-help-note">{helpText}</p>

      <label className="auth-checkbox-wrap auth-checkbox-wrap--terms" style={{ marginBottom: 14 }} htmlFor="acceptedTerms">
        <input
          id="acceptedTerms"
          type="checkbox"
          name="acceptedTerms"
          checked={formData.acceptedTerms}
          onChange={handleChange}
        />
        <span>Tôi đồng ý với điều khoản sử dụng dịch vụ</span>
      </label>

      <p className="auth-terms-text">
        Bằng cách nhấn Đăng ký, bạn đồng ý với <a href="/#">Điều khoản</a>,
        {' '}<a href="/#">Chính sách quyền riêng tư</a> và <a href="/#">Chính sách cookie</a>.
      </p>

      {error ? <div className="auth-error-banner">{error}</div> : null}

      <button type="submit" className="auth-submit-btn" disabled={loading}>
        {loading ? 'Đang xử lý...' : 'Tạo tài khoản ngay'}
        <i className="bi bi-arrow-right"></i>
      </button>

      <p className="auth-switch-inline">
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </form>
  );
};

export default RegisterForm;
