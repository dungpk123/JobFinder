import React, { useState, useEffect } from 'react';
import { useNotification } from '../../../components/NotificationProvider';

const CompanyProfile = () => {
    const { notify } = useNotification();
    const token = localStorage.getItem('token') || '';
    const [company, setCompany] = useState({
        name: '',
        taxCode: '',
        address: '',
        city: '',
        industry: '',
        website: '',
        description: '',
        logo: ''
    });
    const [editing, setEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [logoInputKey, setLogoInputKey] = useState(0);

    useEffect(() => {
        fetchCompanyInfo();
    }, []);

    const fetchCompanyInfo = async () => {
        if (!token) return;
        try {
            const res = await fetch('/jobs/company', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Không tải được thông tin công ty');
            }
            const c = data.company || {};
            setCompany({
                name: c.name || '',
                taxCode: c.taxCode || '',
                address: c.address || '',
                city: c.city || '',
                industry: c.industry || '',
                website: c.website || '',
                description: c.description || '',
                logo: c.logoAbsoluteUrl || c.logoUrl || ''
            });
        } catch (err) {
            notify({ type: 'error', message: err.message || 'Không tải được thông tin công ty' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!token) {
            notify({ type: 'error', message: 'Vui lòng đăng nhập lại.' });
            return;
        }
        setIsSaving(true);
        try {
            const res = await fetch('/jobs/company', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: company.name,
                    taxCode: company.taxCode,
                    address: company.address,
                    city: company.city,
                    industry: company.industry,
                    website: company.website,
                    description: company.description
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Không thể lưu thông tin công ty');
            }
            notify({ type: 'success', message: 'Cập nhật thông tin công ty thành công!' });
            setEditing(false);
            await fetchCompanyInfo();
        } catch (err) {
            notify({ type: 'error', message: err.message || 'Không thể lưu thông tin công ty' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (e) => {
        setCompany({
            ...company,
            [e.target.name]: e.target.value
        });
    };

    const handlePickLogo = () => {
        const input = document.getElementById('company-logo-input');
        if (input) input.click();
    };

    const handleLogoSelected = async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            notify({ type: 'error', message: 'Chỉ chấp nhận file ảnh.' });
            setLogoInputKey((k) => k + 1);
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            notify({ type: 'error', message: 'Kích thước ảnh không vượt quá 2MB.' });
            setLogoInputKey((k) => k + 1);
            return;
        }
        if (!token) {
            notify({ type: 'error', message: 'Vui lòng đăng nhập lại.' });
            setLogoInputKey((k) => k + 1);
            return;
        }

        setIsUploadingLogo(true);
        try {
            const form = new FormData();
            form.append('logo', file);
            const res = await fetch('/jobs/company/logo', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: form
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Không thể tải logo lên');
            }
            const url = data.logoAbsoluteUrl || data.logoUrl || '';
            setCompany((prev) => ({ ...prev, logo: url }));
            notify({ type: 'success', message: 'Tải logo lên thành công.' });
        } catch (err) {
            notify({ type: 'error', message: err.message || 'Không thể tải logo lên' });
        } finally {
            setIsUploadingLogo(false);
            setLogoInputKey((k) => k + 1);
        }
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Thông tin công ty</h2>
                {!editing && (
                    <button 
                        className="btn btn-primary"
                        onClick={() => setEditing(true)}
                    >
                        <i className="bi bi-pencil me-2"></i>
                        Chỉnh sửa
                    </button>
                )}
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        <div className="row g-4">
                            <div className="col-md-12">
                                <div className="text-center mb-4">
                                    <div className="mb-3">
                                        {company.logo ? (
                                            <img 
                                                src={company.logo} 
                                                alt="Company Logo" 
                                                className="img-thumbnail"
                                                style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div 
                                                className="bg-light d-inline-flex align-items-center justify-content-center"
                                                style={{ width: '150px', height: '150px', borderRadius: '8px' }}
                                            >
                                                <i className="bi bi-building fs-1 text-muted"></i>
                                            </div>
                                        )}
                                    </div>
                                    {editing && (
                                        <>
                                            <input
                                                key={logoInputKey}
                                                id="company-logo-input"
                                                type="file"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                onChange={handleLogoSelected}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary"
                                                onClick={handlePickLogo}
                                                disabled={isUploadingLogo}
                                            >
                                            <i className="bi bi-upload me-2"></i>
                                            {isUploadingLogo ? 'Đang tải...' : 'Tải lên logo'}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Tên công ty <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="name"
                                    value={company.name}
                                    onChange={handleChange}
                                    disabled={!editing}
                                    required
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Mã số thuế</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="taxCode"
                                    value={company.taxCode}
                                    onChange={handleChange}
                                    disabled={!editing}
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Địa chỉ</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="address"
                                    value={company.address}
                                    onChange={handleChange}
                                    disabled={!editing}
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Thành phố</label>
                                <select
                                    className="form-select"
                                    name="city"
                                    value={company.city}
                                    onChange={handleChange}
                                    disabled={!editing}
                                >
                                    <option value="">Chọn thành phố</option>
                                    <option value="Hà Nội">Hà Nội</option>
                                    <option value="Hồ Chí Minh">Hồ Chí Minh</option>
                                    <option value="Đà Nẵng">Đà Nẵng</option>
                                </select>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label">Lĩnh vực công ty</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="industry"
                                    value={company.industry}
                                    onChange={handleChange}
                                    disabled={!editing}
                                    placeholder="VD: CNTT, Marketing, Sản xuất..."
                                />
                            </div>

                            <div className="col-md-12">
                                <label className="form-label">Website</label>
                                <input
                                    type="url"
                                    className="form-control"
                                    name="website"
                                    value={company.website}
                                    onChange={handleChange}
                                    disabled={!editing}
                                    placeholder="https://"
                                />
                            </div>

                            <div className="col-md-12">
                                <label className="form-label">Mô tả công ty</label>
                                <textarea
                                    className="form-control"
                                    name="description"
                                    rows="5"
                                    value={company.description}
                                    onChange={handleChange}
                                    disabled={!editing}
                                    placeholder="Giới thiệu về công ty của bạn..."
                                />
                            </div>

                            {editing && (
                                <div className="col-md-12">
                                    <button type="submit" className="btn btn-primary me-2" disabled={isSaving || isUploadingLogo}>
                                        <i className="bi bi-check-lg me-2"></i>
                                        {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                                    </button>
                                    <button 
                                        type="button" 
                                        className="btn btn-outline-secondary"
                                        onClick={() => {
                                            setEditing(false);
                                            fetchCompanyInfo();
                                        }}
                                        disabled={isSaving || isUploadingLogo}
                                    >
                                        Hủy
                                    </button>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CompanyProfile;

