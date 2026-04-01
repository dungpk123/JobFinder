import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';

const days = Array.from({ length: 31 }, (_, idx) => idx + 1);
const years = Array.from({ length: 80 }, (_, idx) => new Date().getFullYear() - idx);
const months = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

export const RegisterForm = ({ onSuccess, onSwitchToLogin }) => {
    const navigate = useNavigate();
    const { notify } = useNotification();
    const apiBase = process.env.REACT_APP_API_BASE || '';
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        day: days[0],
        month: months[0],
        year: years[0],
        gender: 'Nữ',
        contact: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const fullName = `${formData.lastName} ${formData.firstName}`.trim();
        
        // Validate age (must be >= 16)
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
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.contact)) {
            setLoading(false);
            setError('Vui lòng nhập địa chỉ email hợp lệ');
            return;
        }
        
        // Validate password strength
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
        
        // Validate confirm password
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
                    email: formData.contact,
                    password: formData.password,
                    confirmPassword: formData.confirmPassword,
                    name: fullName,
                    phone: formData.contact.match(/^[0-9]+$/) ? formData.contact : '',
                    role: 'Ứng viên'
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Đăng ký thất bại');
            }

            if (data.requireVerification) {
                if (onSuccess) onSuccess();
                navigate('/verify-otp', { state: { email: formData.contact } });
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
        () => 'Những người sử dụng dịch vụ của chúng tôi có thể đã tải thông tin liên hệ của bạn lên JobFinder. Tìm hiểu thêm.',
        []
    );

    return (
        <div className="register-card">
            <div className="text-center mb-4">
                <h2 className="fw-bold">Tạo tài khoản mới</h2>
                <p className="text-muted mb-0">Nhanh chóng và dễ dàng.</p>
            </div>
            <form onSubmit={handleSubmit}>
                <div className="row g-3">
                    <div className="col-md-6">
                        <input
                            type="text"
                            name="firstName"
                            className="form-control"
                            placeholder="Tên"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="col-md-6">
                        <input
                            type="text"
                            name="lastName"
                            className="form-control"
                            placeholder="Họ"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="col-12">
                        <label className="form-label register-section-label">Ngày sinh</label>
                        <div className="row g-2">
                            <div className="col">
                                <select name="day" className="form-select" value={formData.day} onChange={handleChange}>
                                    {days.map((day) => (
                                        <option key={day} value={day}>{day}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col">
                                <select name="month" className="form-select" value={formData.month} onChange={handleChange}>
                                    {months.map((month) => (
                                        <option key={month} value={month}>{month}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col">
                                <select name="year" className="form-select" value={formData.year} onChange={handleChange}>
                                    {years.map((year) => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="col-12">
                        <label className="form-label register-section-label">Giới tính</label>
                        <div className="row g-2">
                            {['Nữ', 'Nam', 'Tùy chỉnh'].map((label) => (
                                <div className="col" key={label}>
                                    <div className="form-check register-gender-option">
                                        <label className="form-check-label w-100 d-flex justify-content-between align-items-center">
                                            <span>{label}</span>
                                            <input
                                                className="form-check-input"
                                                type="radio"
                                                name="gender"
                                                value={label}
                                                checked={formData.gender === label}
                                                onChange={handleChange}
                                            />
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="col-12">
                        <input
                            type="text"
                            name="contact"
                            className="form-control"
                            placeholder="Số điện thoại hoặc email"
                            value={formData.contact}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="col-12">
                        <div className="input-group">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                name="password"
                                className="form-control"
                                placeholder="Mật khẩu mới"
                                value={formData.password}
                                onChange={handleChange}
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle-btn input-group-text"
                                onClick={() => setShowPassword((s) => !s)}
                                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                            </button>
                        </div>
                    </div>
                    <div className="col-12">
                        <div className="input-group">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                name="confirmPassword"
                                className="form-control"
                                placeholder="Xác nhận mật khẩu"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                            />
                            <button
                                type="button"
                                className="password-toggle-btn input-group-text"
                                onClick={() => setShowConfirmPassword((s) => !s)}
                                aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            >
                                <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                            </button>
                        </div>
                    </div>
                </div>
                <p className="register-help-text mt-3 mb-2">{helpText}</p>
                <p className="register-terms">
                    Bằng cách nhấn Đăng ký, bạn đồng ý với <a href="#">Điều khoản</a>, <a href="#">Chính sách quyền riêng tư</a> và <a href="#">Chính sách cookie</a> của JobFinder.
                    Bạn cũng có thể nhận được thông báo SMS và có thể hủy bất kỳ lúc nào.
                </p>
                {error && <div className="alert alert-danger">{error}</div>}
                <button type="submit" className="btn btn-success btn-lg w-100" disabled={loading}>
                    {loading ? 'Đang xử lý...' : 'Đăng ký'}
                </button>
            </form>
            <div className="text-center mt-3">
                <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none"
                    onClick={() => {
                        if (onSwitchToLogin) {
                            onSwitchToLogin();
                        } else {
                            navigate('/login');
                        }
                    }}
                >
                    Đã có tài khoản?
                </button>
            </div>
        </div>
    );
};

const Register = () => (
    <div className="container my-5">
        <div className="row justify-content-center">
            <div className="col-lg-6">
                <RegisterForm />
            </div>
        </div>
    </div>
);

export default Register;

