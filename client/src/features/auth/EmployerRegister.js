import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';

export const EmployerRegisterForm = ({ onSuccess, onSwitchToLogin }) => {
    const navigate = useNavigate();
    const { notify } = useNotification();
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
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Vui lòng nhập địa chỉ email hợp lệ');
            return;
        }

        // Validation
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
            const response = await fetch('/id/auth/register-employer', {
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

            // Nếu cần xác thực, chuyển đến trang OTP
            if (data.requireVerification) {
                navigate('/verify-otp', { state: { email: formData.email } });
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
        <form onSubmit={handleSubmit} className="employer-register-form">
            <h3 className="text-center mb-4">Đăng ký Nhà tuyển dụng</h3>
            
            <div className="row">
                <div className="col-md-6 mb-3">
                    <label className="form-label">Tên công ty <span className="text-danger">*</span></label>
                    <input
                        type="text"
                        className="form-control"
                        name="companyName"
                        value={formData.companyName}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="col-md-6 mb-3">
                    <label className="form-label">Mã số thuế <span className="text-danger">*</span></label>
                    <input
                        type="text"
                        className="form-control"
                        name="taxCode"
                        value={formData.taxCode}
                        onChange={handleChange}
                        required
                    />
                </div>
            </div>

            <div className="mb-3">
                <label className="form-label">Địa chỉ công ty <span className="text-danger">*</span></label>
                <input
                    type="text"
                    className="form-control"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    required
                />
            </div>

            <div className="row">
                <div className="col-md-6 mb-3">
                    <label className="form-label">Người liên hệ <span className="text-danger">*</span></label>
                    <input
                        type="text"
                        className="form-control"
                        name="contactPerson"
                        value={formData.contactPerson}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="col-md-6 mb-3">
                    <label className="form-label">Số điện thoại <span className="text-danger">*</span></label>
                    <input
                        type="tel"
                        className="form-control"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                    />
                </div>
            </div>

            <div className="mb-3">
                <label className="form-label">Email <span className="text-danger">*</span></label>
                <input
                    type="email"
                    className="form-control"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                />
            </div>

            <div className="row">
                <div className="col-md-6 mb-3">
                    <label className="form-label">Mật khẩu <span className="text-danger">*</span></label>
                    <div className="input-group">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="form-control"
                            name="password"
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
                <div className="col-md-6 mb-3">
                    <label className="form-label">Xác nhận mật khẩu <span className="text-danger">*</span></label>
                    <div className="input-group">
                        <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            className="form-control"
                            name="confirmPassword"
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

            {error && <div className="alert alert-danger">{error}</div>}

            <button type="submit" className="btn btn-warning btn-lg w-100 mb-3" disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Đăng ký'}
            </button>

            <div className="text-center">
                <span>Đã có tài khoản? </span>
                <button
                    type="button"
                    className="btn btn-link p-0"
                    onClick={onSwitchToLogin || (() => navigate('/login'))}
                >
                    Đăng nhập ngay
                </button>
            </div>
        </form>
    );
};

const EmployerRegister = () => {
    return (
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-md-8">
                    <div className="card">
                        <div className="card-body p-4">
                            <EmployerRegisterForm />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployerRegister;

