import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNotification } from '../../../components/NotificationProvider';

const PROVINCE_FALLBACKS = [
    'An Giang',
    'Bà Rịa - Vũng Tàu',
    'Bắc Giang',
    'Bắc Kạn',
    'Bạc Liêu',
    'Bắc Ninh',
    'Bến Tre',
    'Bình Định',
    'Bình Dương',
    'Bình Phước',
    'Bình Thuận',
    'Cà Mau',
    'Cần Thơ',
    'Cao Bằng',
    'Đà Nẵng',
    'Đắk Lắk',
    'Đắk Nông',
    'Điện Biên',
    'Đồng Nai',
    'Đồng Tháp',
    'Gia Lai',
    'Hà Giang',
    'Hà Nam',
    'Hà Nội',
    'Hà Tĩnh',
    'Hải Dương',
    'Hải Phòng',
    'Hậu Giang',
    'Hòa Bình',
    'Hồ Chí Minh',
    'Hưng Yên',
    'Khánh Hòa',
    'Kiên Giang',
    'Kon Tum',
    'Lai Châu',
    'Lâm Đồng',
    'Lạng Sơn',
    'Lào Cai',
    'Long An',
    'Nam Định',
    'Nghệ An',
    'Ninh Bình',
    'Ninh Thuận',
    'Phú Thọ',
    'Phú Yên',
    'Quảng Bình',
    'Quảng Nam',
    'Quảng Ngãi',
    'Quảng Ninh',
    'Quảng Trị',
    'Sóc Trăng',
    'Sơn La',
    'Tây Ninh',
    'Thái Bình',
    'Thái Nguyên',
    'Thanh Hóa',
    'Thừa Thiên Huế',
    'Tiền Giang',
    'Trà Vinh',
    'Tuyên Quang',
    'Vĩnh Long',
    'Vĩnh Phúc',
    'Yên Bái'
].sort((a, b) => a.localeCompare(b, 'vi'));

const normalizeProvinceEntry = (entry) => {
    if (!entry) return '';
    if (typeof entry === 'string') return entry.trim();
    return String(
        entry.TenTinh
        || entry.tenTinh
        || entry.ten_tinh
        || entry.city
        || entry.City
        || entry.ThanhPho
        || entry.thanhPho
        || entry.name
        || entry.ten
        || entry.province
        || entry.label
        || ''
    ).trim();
};

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
    const [provinces, setProvinces] = useState([]);
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [isCityOpen, setIsCityOpen] = useState(false);
    const [cityQuery, setCityQuery] = useState('');
    const [companyRating, setCompanyRating] = useState({ avgRating: 0, ratingCount: 0 });
    const [companyComments, setCompanyComments] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [reviewsError, setReviewsError] = useState('');

    const cityDropdownRef = useRef(null);
    const citySearchInputRef = useRef(null);

    useEffect(() => {
        fetchCompanyInfo();
        fetchProvinces();
        fetchCompanyReviews();
    }, []);

    useEffect(() => {
        if (!isCityOpen) return undefined;

        const closeIfOutside = (event) => {
            if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target)) {
                setIsCityOpen(false);
            }
        };

        document.addEventListener('mousedown', closeIfOutside);
        return () => document.removeEventListener('mousedown', closeIfOutside);
    }, [isCityOpen]);

    useEffect(() => {
        if (!isCityOpen) return;
        const id = window.setTimeout(() => {
            citySearchInputRef.current?.focus();
        }, 0);
        return () => window.clearTimeout(id);
    }, [isCityOpen]);

    useEffect(() => {
        if (!editing) {
            setIsCityOpen(false);
            setCityQuery('');
        }
    }, [editing]);

    const fetchProvinces = async () => {
        setLoadingProvinces(true);
        try {
            const res = await fetch('/api/provinces');
            const payload = await res.json().catch(() => []);

            if (!res.ok) {
                setProvinces(PROVINCE_FALLBACKS);
                return;
            }

            const source = Array.isArray(payload)
                ? payload
                : Array.isArray(payload?.data)
                    ? payload.data
                    : [];

            const normalized = Array.from(
                new Set(source.map(normalizeProvinceEntry).filter(Boolean))
            ).sort((a, b) => a.localeCompare(b, 'vi'));

            setProvinces(normalized.length > 0 ? normalized : PROVINCE_FALLBACKS);
        } catch (err) {
            setProvinces(PROVINCE_FALLBACKS);
        } finally {
            setLoadingProvinces(false);
        }
    };

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

    const handleCitySelect = (value) => {
        setCompany((prev) => ({
            ...prev,
            city: value
        }));
        setIsCityOpen(false);
    };

    const fetchCompanyReviews = async () => {
        if (!token) return;

        setLoadingReviews(true);
        setReviewsError('');

        try {
            const res = await fetch('/api/companies/me/reviews', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Không tải được dữ liệu đánh giá công ty');
            }

            const rating = data.rating || {};
            setCompanyRating({
                avgRating: Number(rating.avgRating || 0),
                ratingCount: Number(rating.ratingCount || 0)
            });
            setCompanyComments(Array.isArray(data.comments) ? data.comments : []);
        } catch (err) {
            setReviewsError(err.message || 'Không tải được dữ liệu đánh giá công ty');
            setCompanyComments([]);
            setCompanyRating({ avgRating: 0, ratingCount: 0 });
        } finally {
            setLoadingReviews(false);
        }
    };

    const renderRatingStars = (avgRating) => {
        const rounded = Math.round(Number(avgRating) || 0);
        return Array.from({ length: 5 }, (_, index) => (
            <i
                key={`rating-star-${index}`}
                className={`bi ${index < rounded ? 'bi-star-fill' : 'bi-star'}`}
                aria-hidden="true"
            ></i>
        ));
    };

    const formatReviewDate = (dateValue) => {
        if (!dateValue) return 'Không rõ thời gian';
        const date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return String(dateValue);

        return new Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        }).format(date);
    };

    const getDisplayInitial = (name) => {
        const normalized = String(name || '').trim();
        if (!normalized) return 'U';
        return normalized.charAt(0).toUpperCase();
    };

    const visibleProvinces = useMemo(() => {
        const keyword = String(cityQuery || '').trim().toLowerCase();
        if (!keyword) return provinces;
        return provinces.filter((item) => item.toLowerCase().includes(keyword));
    }, [provinces, cityQuery]);

    const selectedCityLabel = company.city || (loadingProvinces ? 'Đang tải tỉnh/thành...' : 'Chọn tỉnh/thành');

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
        <div className="employer-profile-page">
            <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
                <div className="text-start">
                    <h2 className="mb-1 employer-page-title">Thông tin công ty</h2>
                    <p className="employer-profile-subtitle mb-0">Cập nhật hồ sơ doanh nghiệp theo phong cách thống nhất với trang tìm kiếm việc làm.</p>
                </div>
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

            <div className="card border-0 shadow-sm employer-profile-card">
                <div className="card-body p-4 p-lg-4">
                    <form onSubmit={handleSubmit}>
                        <div className="row g-4 employer-profile-grid">
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

                            <div className="col-md-6 employer-profile-city">
                                <label className="form-label">Tỉnh / Thành phố</label>
                                <div className={`jf-jobs-select ${isCityOpen ? 'is-open' : ''}`} ref={cityDropdownRef}>
                                    <button
                                        type="button"
                                        className="jf-jobs-select-trigger"
                                        onClick={() => {
                                            if (!editing) {
                                                setEditing(true);
                                            }
                                            setIsCityOpen((prev) => !prev);
                                            setCityQuery('');
                                        }}
                                        aria-haspopup="listbox"
                                        aria-expanded={isCityOpen}
                                    >
                                        <span className="jf-jobs-select-text">{selectedCityLabel}</span>
                                        <i className="bi bi-chevron-down"></i>
                                    </button>

                                    {isCityOpen ? (
                                        <div className="jf-jobs-select-menu jf-jobs-select-menu--location" role="listbox" aria-label="Chọn tỉnh/thành">
                                            <div className="jf-jobs-select-search-wrap">
                                                <i className="bi bi-search"></i>
                                                <input
                                                    ref={citySearchInputRef}
                                                    type="text"
                                                    value={cityQuery}
                                                    onChange={(event) => setCityQuery(event.target.value)}
                                                    placeholder="Nhập để tìm tỉnh/thành"
                                                />
                                            </div>

                                            <div className="jf-jobs-select-scroll">
                                                {visibleProvinces.length === 0 ? (
                                                    <div className="jf-jobs-select-empty">Không tìm thấy tỉnh/thành phù hợp</div>
                                                ) : (
                                                    visibleProvinces.map((entry) => (
                                                        <button
                                                            key={entry}
                                                            type="button"
                                                            className={`jf-jobs-select-option ${company.city === entry ? 'is-active' : ''}`}
                                                            onClick={() => handleCitySelect(entry)}
                                                        >
                                                            {entry}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
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
                                <div className="col-md-12 d-flex justify-content-end gap-2 employer-profile-actions">
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

            <div className="card border-0 shadow-sm employer-profile-card employer-company-review-card">
                <div className="card-body p-4 p-lg-4">
                    <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3">
                        <div>
                            <h5 className="employer-company-review-title mb-1">Đánh giá và bình luận công ty</h5>
                            <p className="employer-company-review-subtitle mb-0">Tổng hợp phản hồi công khai từ ứng viên để bạn theo dõi chất lượng thương hiệu tuyển dụng.</p>
                        </div>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={fetchCompanyReviews}
                            disabled={loadingReviews}
                        >
                            <i className="bi bi-arrow-clockwise me-2"></i>
                            Làm mới
                        </button>
                    </div>

                    <div className="employer-company-review-summary">
                        <div className="employer-company-review-score">{companyRating.avgRating.toFixed(1)}</div>
                        <div>
                            <div className="employer-company-review-stars" aria-label={`Đánh giá trung bình ${companyRating.avgRating.toFixed(1)} trên 5`}>
                                {renderRatingStars(companyRating.avgRating)}
                            </div>
                            <p className="employer-company-review-meta mb-0">{companyRating.ratingCount} lượt đánh giá</p>
                        </div>
                    </div>

                    {reviewsError ? (
                        <div className="alert alert-warning mt-3 mb-0" role="alert">
                            <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                                <span>{reviewsError}</span>
                                <button type="button" className="btn btn-sm btn-outline-warning" onClick={fetchCompanyReviews}>
                                    Thử lại
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {loadingReviews ? (
                        <div className="employer-company-review-loading">
                            <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                            <span>Đang tải bình luận...</span>
                        </div>
                    ) : null}

                    {!loadingReviews && !reviewsError && companyComments.length === 0 ? (
                        <div className="employer-company-review-empty">
                            Chưa có bình luận nào cho công ty. Khi ứng viên bắt đầu phản hồi, danh sách sẽ hiển thị tại đây.
                        </div>
                    ) : null}

                    {!loadingReviews && companyComments.length > 0 ? (
                        <div className="employer-company-review-list">
                            {companyComments.map((comment) => (
                                <article className="employer-company-review-item" key={comment.id || `${comment.userId}-${comment.createdAt}`}>
                                    <div className="employer-company-review-item-head">
                                        <div className="employer-company-review-avatar">{getDisplayInitial(comment.userName)}</div>
                                        <div>
                                            <h6>{comment.userName || 'Ứng viên'}</h6>
                                            <p className="mb-0">{formatReviewDate(comment.createdAt)}</p>
                                        </div>
                                    </div>
                                    <p className="employer-company-review-content mb-0">{comment.content}</p>
                                </article>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

export default CompanyProfile;

