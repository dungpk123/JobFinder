import React from 'react';
import { useNavigate } from 'react-router-dom';

const CandidateDashboard = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <div className="container mt-5">
            <div className="row">
                <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h2>Dashboard Ứng Viên</h2>
                        <button className="btn btn-outline-danger" onClick={handleLogout}>
                            Đăng xuất
                        </button>
                    </div>
                    <div className="alert alert-primary">
                        <h4>Xin chào, {user.name}!</h4>
                        <p>Vai trò: <strong>{user.role}</strong></p>
                    </div>
                </div>
            </div>
            
            <div className="row g-4 mt-3">
                <div className="col-md-3">
                    <div className="card text-center">
                        <div className="card-body">
                            <h5 className="card-title">Hồ sơ CV</h5>
                            <p className="card-text display-6">0</p>
                            <button className="btn btn-primary btn-sm">Tạo CV</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card text-center">
                        <div className="card-body">
                            <h5 className="card-title">Việc đã ứng tuyển</h5>
                            <p className="card-text display-6">0</p>
                            <button className="btn btn-info btn-sm text-white">Xem</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card text-center">
                        <div className="card-body">
                            <h5 className="card-title">Việc đã lưu</h5>
                            <p className="card-text display-6">0</p>
                            <button className="btn btn-warning btn-sm">Xem</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="card text-center">
                        <div className="card-body">
                            <h5 className="card-title">Thông báo</h5>
                            <p className="card-text display-6">0</p>
                            <button className="btn btn-secondary btn-sm">Xem</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row mt-4">
                <div className="col-12">
                    <div className="card">
                        <div className="card-header">
                            <h5>Việc làm phù hợp với bạn</h5>
                        </div>
                        <div className="card-body">
                            <p className="text-muted">Hãy hoàn thiện hồ sơ để nhận gợi ý việc làm phù hợp!</p>
                            <button className="btn btn-primary">Hoàn thiện hồ sơ</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row mt-4">
                <div className="col-md-6">
                    <div className="card">
                        <div className="card-header">
                            <h5>Hồ sơ ứng tuyển của tôi</h5>
                        </div>
                        <div className="card-body">
                            <p className="text-muted">Bạn chưa ứng tuyển công việc nào.</p>
                            <button className="btn btn-success">Tìm việc ngay</button>
                        </div>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="card">
                        <div className="card-header">
                            <h5>Việc làm đã lưu</h5>
                        </div>
                        <div className="card-body">
                            <p className="text-muted">Bạn chưa lưu công việc nào.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CandidateDashboard;
