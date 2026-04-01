import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ForgotPassword from './ForgotPassword';
import { useNotification } from '../../components/NotificationProvider';

export const LoginForm = ({ onSuccess, onCreateAccount, onForgotPassword }) => {
    const navigate = useNavigate();
    const { notify } = useNotification();
    // Gọi API trực tiếp qua /id/auth/login vì backend và frontend cùng port
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Đăng nhập thất bại');
            }

            // Lưu token và thông tin user
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            notify({ type: 'success', message: `Đăng nhập thành công! Xin chào ${data.user.name}` });
            
            // Close modal if exists
            if (onSuccess) {
                onSuccess();
            }
            
            // Always redirect based on role
            switch(data.user.role) {
                case 'Quản trị':
                case 'Siêu quản trị viên':
                    navigate('/admin');
                    break;
                case 'Nhà tuyển dụng':
                    navigate('/employer');
                    break;
                case 'Ứng viên':
                default:
                    navigate('/'); // Chuyển về trang chủ
                    break;
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // If parent provided an onForgotPassword handler (App.js), the button will call it

    return (
        <form onSubmit={handleSubmit} className="login-panel">
            <div className="mb-3">
                <input
                    type="email"
                    className="form-control form-control-lg"
                    placeholder="Email hoặc số điện thoại"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>
            <div className="mb-3">
                <div className="input-group input-group-lg">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control"
                        placeholder="Mật khẩu"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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
            {error && <div className="alert alert-danger">{error}</div>}
            <button type="submit" className="btn btn-primary btn-lg w-100" disabled={loading}>
                {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
            <div className="text-center mt-3">
                <button
                    type="button"
                    className="btn btn-link p-0"
                    onClick={(e) => { e.preventDefault(); if (onForgotPassword) onForgotPassword(); }}
                    style={{ cursor: 'pointer', textDecoration: 'none' }}
                >
                    Quên mật khẩu?
                </button>
            </div>
            <hr />
            <button
                type="button"
                className="btn btn-success btn-lg w-100"
                onClick={() => {
                    if (onCreateAccount) {
                        onCreateAccount();
                    } else {
                        navigate('/register');
                    }
                }}
            >
                Tạo tài khoản mới
            </button>
        </form>
    );
};

const Login = () => (
    <div className="container my-5">
        <div className="row justify-content-center">
            <div className="col-md-6">
                <h2 className="text-center mb-4">Đăng nhập</h2>
                <LoginForm />
            </div>
        </div>
    </div>
);

export default Login;


