import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './DesiredJobForm.css';
import { useNotification } from '../../components/NotificationProvider';

const jobCategories = ['Front-end Developer', 'Back-end Developer', 'UI/UX Designer', 'Data Analyst', 'Product Manager'];
const experiences = ['Chưa có kinh nghiệm', 'Dưới 1 năm', '1-3 năm', '3-5 năm', 'Trên 5 năm'];
const locations = ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ'];

const DesiredJobForm = () => {
    const navigate = useNavigate();
    const { notify } = useNotification();
    const [formData, setFormData] = useState({
        primaryPosition: '',
        customPosition: '',
    salary: '',
        currency: 'VND / tháng',
        experience: '',
        location: '',
        readyToMove: false
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        notify({ type: 'success', message: 'Thông tin mong muốn đã được lưu (mock).' });
        navigate('/');
    };

    return (
        <div className="desired-job-wrapper">
            <form className="desired-job-card" onSubmit={handleSubmit}>
                <div className="desired-job-heading">
                    <h2>Mô tả công việc mong muốn của bạn</h2>
                    <p>Chúng tôi sẽ gợi ý việc làm, cá nhân hoá trải nghiệm dựa trên mong muốn của bạn!</p>
                </div>

                <div className="mb-4">
                        <label className="form-label">Vị trí chuyên môn *</label>
                    <select name="primaryPosition" className="form-select form-select-lg" value={formData.primaryPosition} onChange={handleChange} required>
                        <option value="">Chọn vị trí chuyên môn từ danh mục</option>
                        {jobCategories.map((category) => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
                    <small className="text-muted mt-2 d-block">Nhập vị trí chuyên môn không có trong danh mục</small>
                    <input
                        type="text"
                        name="customPosition"
                        className="form-control form-control-lg mt-2"
                        placeholder="Nhập tên vị trí chuyên môn"
                        value={formData.customPosition}
                        onChange={handleChange}
                    />
                </div>

                <div className="row g-3 mb-4">
                    <div className="col-md-6">
                        <label className="form-label">Mức lương mong muốn *</label>
                        <div className="input-group input-group-lg">
                            <input
                                type="number"
                                name="salary"
                                className="form-control"
                                placeholder="0"
                                value={formData.salary}
                                onChange={handleChange}
                                required
                            />
                            <span className="input-group-text">{formData.currency}</span>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <label className="form-label">Kinh nghiệm *</label>
                        <select name="experience" className="form-select form-select-lg" value={formData.experience} onChange={handleChange} required>
                            <option value="">Chọn kinh nghiệm</option>
                            {experiences.map((exp) => (
                                <option key={exp} value={exp}>{exp}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="form-label">Địa điểm làm việc *</label>
                    <select name="location" className="form-select form-select-lg" value={formData.location} onChange={handleChange} required>
                        <option value="">Chọn địa điểm</option>
                        {locations.map((loc) => (
                            <option key={loc} value={loc}>{loc}</option>
                        ))}
                    </select>
                </div>

                <div className="form-check mb-4">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="readyToMove"
                        name="readyToMove"
                        checked={formData.readyToMove}
                        onChange={handleChange}
                    />
                    <label className="form-check-label" htmlFor="readyToMove">
                        Sẵn sàng thay đổi địa điểm làm việc nếu có cơ hội phù hợp
                    </label>
                </div>

                <div className="d-flex flex-wrap gap-3 justify-content-center justify-content-md-end mt-4">
                    <button type="button" className="btn btn-outline-secondary btn-lg" onClick={() => navigate('/')}>Tôi sẽ hoàn thiện sau</button>
                    <button type="submit" className="btn btn-success btn-lg">Hoàn thành</button>
                </div>

                <p className="desired-job-footnote">(*) Thông tin bắt buộc</p>
            </form>
            <div className="desired-job-footer-actions">
                <button type="button" className="btn btn-link p-0" onClick={() => navigate('/login')}>Đã có tài khoản? Đăng nhập</button>
            </div>
        </div>
    );
};

export default DesiredJobForm;

