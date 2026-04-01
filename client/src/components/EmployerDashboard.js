import React from 'react';
import { useNavigate } from 'react-router-dom';

const EmployerDashboard = () => {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h2>Dashboard Nhà Tuyển Dụng</h2>
                        <button className="btn btn-outline-danger" onClick={handleLogout}>
                            Đăng xuất
                        </button>
                    </div>
                    <div className="alert alert-success">
                        <h4>Xin chào, {user.name}!</h4>
                        <p>Vai trò: <strong>{user.role}</strong></p>
                    </div>
                </div>
            </div>
            
            {/* Nội dung dashboard của bạn ở đây */}
        </div>
    );
};

export default EmployerDashboard;
