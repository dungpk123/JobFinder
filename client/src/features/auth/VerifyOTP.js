import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const VerifyOTP = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const email = location.state?.email || '';
    
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        if (otp.length !== 6) {
            setError('Mã xác thực phải có 6 số');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/auth/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, otp })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Xác thực thất bại');
            }

            setSuccess('Xác thực thành công! Đang chuyển đến trang đăng nhập...');
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setError('');
        setSuccess('');
        setResending(true);

        try {
            const response = await fetch('/auth/resend-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Không thể gửi lại mã');
            }

            setSuccess(data.message);
        } catch (err) {
            setError(err.message);
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="container my-5">
            <div className="row justify-content-center">
                <div className="col-md-6">
                    <div className="card shadow">
                        <div className="card-body p-5">
                            <div className="text-center mb-4">
                                <i className="bi bi-envelope-check" style={{ fontSize: '4rem', color: '#0d6efd' }}></i>
                                <h2 className="mt-3 mb-2">Xác thực tài khoản</h2>
                                <p className="text-muted">
                                    Chúng tôi đã gửi mã xác thực 6 số đến<br />
                                    <strong>{email}</strong>
                                </p>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="mb-4">
                                    <label className="form-label text-center w-100 fw-bold">
                                        Nhập mã xác thực
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control form-control-lg text-center"
                                        style={{ fontSize: '2rem', letterSpacing: '0.5rem' }}
                                        placeholder="000000"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        maxLength={6}
                                        required
                                        autoFocus
                                    />
                                    <small className="text-muted d-block text-center mt-2">
                                        Mã có hiệu lực trong 10 phút
                                    </small>
                                </div>

                                {error && (
                                    <div className="alert alert-danger" role="alert">
                                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                        {error}
                                    </div>
                                )}

                                {success && (
                                    <div className="alert alert-success" role="alert">
                                        <i className="bi bi-check-circle-fill me-2"></i>
                                        {success}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg w-100 mb-3"
                                    disabled={loading || otp.length !== 6}
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Đang xác thực...
                                        </>
                                    ) : (
                                        'Xác thực'
                                    )}
                                </button>

                                <div className="text-center">
                                    <p className="mb-2">Không nhận được mã?</p>
                                    <button
                                        type="button"
                                        className="btn btn-link"
                                        onClick={handleResendOTP}
                                        disabled={resending}
                                    >
                                        {resending ? 'Đang gửi...' : 'Gửi lại mã xác thực'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyOTP;
