import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './WelcomeIntro.css';

const WelcomeIntro = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const nameFromState = location.state?.name?.trim();
    const displayName = nameFromState && nameFromState.length > 0 ? nameFromState : 'bạn';

    return (
        <div className="welcome-wrapper">
            <div className="welcome-card">
                <div className="welcome-text">
                    <p className="welcome-subtitle">Tiếp lợi thế, nổi thành công</p>
                    <h1 className="welcome-title">
                        Chào mừng bạn đến với JobFinder,
                        <br />
                        <span className="welcome-name">{displayName}</span>
                    </h1>
                    <p className="welcome-description">
                        Hãy bắt đầu bằng cách cung cấp một số thông tin cơ bản để chúng tôi có thể hỗ trợ bạn tốt hơn:
                    </p>
                    <div className="welcome-badges">
                        <span className="welcome-badge">Trải nghiệm tìm việc cá nhân hoá</span>
                        <span className="welcome-badge">Gợi ý công việc phù hợp</span>
                        <span className="welcome-badge">Hỗ trợ bởi AI</span>
                    </div>
                    <div className="welcome-actions">
                        <button type="button" className="btn btn-outline-light btn-lg" onClick={() => navigate('/')}>Tôi sẽ hoàn thiện sau</button>
                        <button type="button" className="btn btn-warning btn-lg text-dark" onClick={() => navigate('/desired-job')}>Bắt đầu</button>
                    </div>
                </div>
                <div className="welcome-illustration" aria-hidden="true">
                    <div className="welcome-illustration-circle"></div>
                    <img src="/images/logo.png" alt="JobFinder" className="welcome-logo" />
                </div>
            </div>
        </div>
    );
};

export default WelcomeIntro;
