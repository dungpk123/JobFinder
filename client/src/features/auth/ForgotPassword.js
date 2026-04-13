import React, { useState, useEffect } from 'react';
import './ForgotPassword.css';
import { API_BASE as CLIENT_API_BASE } from '../../config/apiBase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const OTP_REGEX = /^\d{6}$/;
const PASSWORD_MIN_LENGTH = 8;

const ForgotPassword = ({ onClose, inline = false }) => {
    const apiBase = CLIENT_API_BASE;
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [resendTimer, setResendTimer] = useState(0);

    const normalizedEmail = email.trim();

    const clearAlerts = () => {
        setError('');
        setMessage('');
    };

    const closePanel = () => {
        if (typeof onClose === 'function') {
            onClose();
        }
    };

    const validateEmail = (value) => EMAIL_REGEX.test(String(value || '').trim().toLowerCase());

    const sendOtp = async ({ keepCurrentStep = false } = {}) => {
        if (!validateEmail(normalizedEmail)) {
            setError('Vui lòng nhập email hợp lệ.');
            return;
        }

        clearAlerts();
        setLoading(true);

        try {
            const res = await fetch(`${apiBase}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: normalizedEmail })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.error || 'Không thể gửi mã xác thực');
            }

            setMessage(data?.message || 'Đã gửi mã OTP. Vui lòng kiểm tra email của bạn.');
            setResendTimer(60);

            if (!keepCurrentStep) {
                setOtp('');
                setNewPassword('');
                setConfirmPassword('');
                setShowNewPassword(false);
                setShowConfirmPassword(false);
                setStep(2);
            }
        } catch (e) {
            setError(e.message || 'Không thể gửi mã xác thực');
        } finally {
            setLoading(false);
        }
    };

    const verifyOtp = async () => {
        clearAlerts();

        if (!OTP_REGEX.test(String(otp || '').trim())) {
            setError('Mã OTP gồm đúng 6 chữ số.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${apiBase}/auth/verify-reset-password-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: normalizedEmail,
                    otp: String(otp || '').trim()
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.error || 'Mã OTP không hợp lệ');
            }

            setMessage(data?.message || 'Xác thực OTP thành công. Vui lòng đặt mật khẩu mới.');
            setStep(3);
        } catch (e) {
            setError(e.message || 'Mã OTP không hợp lệ');
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async () => {
        clearAlerts();

        if (!OTP_REGEX.test(String(otp || '').trim())) {
            setError('Mã OTP không hợp lệ. Vui lòng xác thực lại.');
            setStep(2);
            return;
        }

        const password = String(newPassword || '');
        const confirm = String(confirmPassword || '');
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);

        if (password.length < PASSWORD_MIN_LENGTH) {
            setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
            return;
        }

        if (!hasLetter || !hasNumber) {
            setError('Mật khẩu mới phải bao gồm cả chữ và số.');
            return;
        }

        if (password !== confirm) {
            setError('Mật khẩu xác nhận không khớp.');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch(`${apiBase}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: normalizedEmail,
                    otp: String(otp || '').trim(),
                    newPassword: password
                })
            });

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.error || 'Đặt lại mật khẩu thất bại');
            }

            setMessage(data?.message || 'Đổi mật khẩu thành công');
            setNewPassword('');
            setConfirmPassword('');
            setShowNewPassword(false);
            setShowConfirmPassword(false);
            setStep(4);
        } catch (e) {
            setError(e.message || 'Đặt lại mật khẩu thất bại');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    const handleResend = async () => {
        if (resendTimer > 0 || loading) return;
        await sendOtp({ keepCurrentStep: true });
    };

    const handleChangeEmail = () => {
        clearAlerts();
        setOtp('');
        setNewPassword('');
        setConfirmPassword('');
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setStep(1);
    };

    const handleKeyDownEmail = (event) => {
        if (event.key === 'Enter' && validateEmail(normalizedEmail) && !loading) {
            sendOtp();
        }
    };

    const handleKeyDownOtp = (event) => {
        if (event.key === 'Enter' && OTP_REGEX.test(String(otp || '').trim()) && !loading) {
            verifyOtp();
        }
    };

    const handleKeyDownReset = (event) => {
        if (event.key === 'Enter' && newPassword && confirmPassword && !loading) {
            resetPassword();
        }
    };

    const bodyFields = (
        <>
            {error && <div className="alert alert-danger">{error}</div>}
            {message && <div className="alert alert-success">{message}</div>}

            <p className="forgot-step-meta">Bước {Math.min(step, 3)}/3</p>

            {step === 1 && (
                <>
                    <label className="forgot-field-label" htmlFor="forgot-email">Email đã đăng ký</label>
                    <input
                        id="forgot-email"
                        type="email"
                        className="form-control mb-2"
                        placeholder="Email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        onKeyDown={handleKeyDownEmail}
                        autoComplete="email"
                    />
                    <button className="btn btn-primary w-100" onClick={() => sendOtp()} disabled={loading || !validateEmail(normalizedEmail)}>
                        {loading ? 'Đang gửi...' : 'Gửi mã'}
                    </button>
                </>
            )}

            {step === 2 && (
                <>
                    <p className="forgot-step-title">Xác thực mã OTP</p>
                    <p className="forgot-help-text">Nhập mã gồm 6 số đã gửi tới {normalizedEmail}.</p>
                    <input
                        type="text"
                        className="form-control mb-2"
                        placeholder="Nhập mã OTP"
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={handleKeyDownOtp}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                    />
                    <div className="forgot-action-row">
                        <button className="btn btn-outline-secondary" style={{ flex: 1 }} onClick={handleResend} disabled={resendTimer > 0 || loading}>
                            {resendTimer > 0 ? `Gửi lại mã (${resendTimer}s)` : 'Gửi lại mã'}
                        </button>
                        <button className="btn btn-success" style={{ flex: 2 }} onClick={verifyOtp} disabled={loading || !OTP_REGEX.test(String(otp || '').trim())}>
                            {loading ? 'Đang xác thực...' : 'Xác thực mã'}
                        </button>
                    </div>
                    <button type="button" className="btn btn-link forgot-change-email" onClick={handleChangeEmail} disabled={loading}>
                        Đổi email
                    </button>
                </>
            )}

            {step === 3 && (
                <>
                    <p className="forgot-step-title">Đặt mật khẩu mới</p>
                    <p className="forgot-help-text">Mã OTP đã được xác thực. Nhập mật khẩu mới để hoàn tất.</p>
                    <div className="forgot-password-field mb-2">
                        <input
                            type={showNewPassword ? 'text' : 'password'}
                            className="form-control"
                            placeholder="Mật khẩu mới"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            onKeyDown={handleKeyDownReset}
                            autoComplete="new-password"
                        />
                        <button
                            type="button"
                            className="forgot-password-toggle"
                            onClick={() => setShowNewPassword((prev) => !prev)}
                            aria-label={showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                        >
                            <i className={`bi ${showNewPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                        </button>
                    </div>

                    <div className="forgot-password-field mb-2">
                        <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            className="form-control"
                            placeholder="Nhập lại mật khẩu mới"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            onKeyDown={handleKeyDownReset}
                            autoComplete="new-password"
                        />
                        <button
                            type="button"
                            className="forgot-password-toggle"
                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                            aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                        >
                            <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                        </button>
                    </div>
                    <button className="btn btn-success w-100" onClick={resetPassword} disabled={loading || !newPassword || !confirmPassword}>
                        {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
                    </button>
                </>
            )}

            {step === 4 && (
                <>
                    <p>Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập bằng mật khẩu mới.</p>
                    <button className="btn btn-primary w-100" onClick={closePanel}>Đăng nhập ngay</button>
                </>
            )}
        </>
    );

    if (inline) {
        return (
            <div className="forgot-modal forgot-modal-inline">
                <div className="modal-body">
                    {bodyFields}
                </div>
            </div>
        );
    }

    return (
        <div className="forgot-modal modal-backdrop show" style={{ display: 'block' }}>
            <div className="modal d-block" tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered forgot-modal-dialog">
                    <div className="forgot-modal-content modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Khôi phục mật khẩu</h5>
                            <button type="button" className="btn-close" aria-label="Close" onClick={closePanel}></button>
                        </div>
                        <div className="modal-body">
                            {bodyFields}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
