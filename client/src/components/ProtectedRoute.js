import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const userStr = localStorage.getItem('user');
    const token = String(localStorage.getItem('token') || '').trim();
    
    if (!userStr || !token) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        // Chưa đăng nhập -> chuyển về login
        return <Navigate to="/login" replace />;
    }

    const user = JSON.parse(userStr);
    
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Không có quyền truy cập -> chuyển về dashboard phù hợp
        switch(user.role) {
            case 'Quản trị':
            case 'Siêu quản trị viên':
                return <Navigate to="/admin/dashboard" replace />;
            case 'Nhà tuyển dụng':
                return <Navigate to="/employer" replace />;
            case 'Ứng viên':
            default:
                return <Navigate to="/candidate" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
