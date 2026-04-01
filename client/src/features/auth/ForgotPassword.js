import React, { useState, useEffect } from 'react';
import './ForgotPassword.css';

const ForgotPassword = ({ onClose, inline = false }) => {
    const apiBase = process.env.REACT_APP_API_BASE || '';
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const sendOtp = async () => {
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const payloadEmail = email.trim();
            const res = await fetch(`${apiBase}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: payloadEmail })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Không thể gửi mã');
            setMessage(data.message || 'Đã gửi mã tới email của bạn');
            setResendTimer(60);
            setStep(2);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async () => {
        setError('');
        setMessage('');
        setLoading(true);
        try {
            const res = await fetch(`${apiBase}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), otp: otp.trim(), newPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Đặt lại mật khẩu thất bại');
            setMessage(data.message || 'Đổi mật khẩu thành công');
            setStep(3);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // Simple email regex validation
    const validateEmail = (e) => {
        if (!e) return false;
        const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@\"]+\.)+[^<>()[\]\\.,;:\s@\"]{2,})$/i;
        return re.test(String(e).toLowerCase());
    };

    // Resend OTP cooldown
    const [resendTimer, setResendTimer] = useState(0);
    useEffect(() => {
        if (resendTimer <= 0) return;
        const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
        return () => clearTimeout(t);
    }, [resendTimer]);

    const handleResend = async () => {
        if (resendTimer > 0) return;
        await sendOtp();
    };

    const handleKeyDownEmail = (e) => {
        if (e.key === 'Enter' && validateEmail(email) && !loading) sendOtp();
    };

    const handleKeyDownReset = (e) => {
        if (e.key === 'Enter' && otp && newPassword && !loading) resetPassword();
    };

    // Build body fields (reused by inline and modal rendering)
    const bodyFields = (
        <>
            {error && <div className="alert alert-danger">{error}</div>}
            {message && <div className="alert alert-success">{message}</div>}

            {step === 1 && (
                <>
                    <p>Nhập email đã đăng ký để nhận mã đặt lại mật khẩu.</p>
                    <input type="email" className="form-control mb-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDownEmail} />
                    <button className="btn btn-primary w-100" onClick={sendOtp} disabled={loading || !validateEmail(email)}>
                        {loading ? 'Đang gửi...' : 'Gửi mã'}
                    </button>
                </>
            )}

            {step === 2 && (
                <>
                    <p>Nhập mã xác thực và mật khẩu mới.</p>
                    <input type="text" className="form-control mb-2" placeholder="Mã xác thực" value={otp} onChange={(e) => setOtp(e.target.value)} onKeyDown={handleKeyDownReset} />
                    <input type="password" className="form-control mb-2" placeholder="Mật khẩu mới" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={handleKeyDownReset} />
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <button className="btn btn-outline-secondary" style={{ flex: 1 }} onClick={handleResend} disabled={resendTimer > 0 || loading}>
                            {resendTimer > 0 ? `Gửi lại mã (${resendTimer}s)` : 'Gửi lại mã'}
                        </button>
                        <button className="btn btn-success" style={{ flex: 2 }} onClick={resetPassword} disabled={loading || !otp || !newPassword}>
                            {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
                        </button>
                    </div>
                </>
            )}

            {step === 3 && (
                <>
                    <p>Mật khẩu đã được đặt lại thành công. Bạn có thể đóng cửa sổ này và đăng nhập bằng mật khẩu mới.</p>
                    <button className="btn btn-primary w-100" onClick={onClose}>Đóng</button>
                </>
            )}
        </>
    );

    // Inline rendering: render as a card-like panel (used inside App modal body)
    if (inline) {
        // When inline, App.js provides the modal container and close button.
        // Render only header/body sections (no extra card) to avoid double-wrapping.
        return (
            <div className="forgot-modal">
                <div className="modal-header">
                    <h5 className="modal-title">Quên mật khẩu</h5>
                </div>
                <div className="modal-body">
                    {bodyFields}
                </div>
            </div>
        );
    }

    // Modal rendering (standalone)
    return (
        <div className="forgot-modal modal-backdrop show" style={{ display: 'block' }}>
            <div className="modal d-block" tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered forgot-modal-dialog">
                    <div className="forgot-modal-content modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Quên mật khẩu</h5>
                            <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
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
