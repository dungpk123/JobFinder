import React, { useState } from 'react';

const CVSearch = () => {
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
    const [searchParams, setSearchParams] = useState({
        keyword: '',
        city: '',
        experience: ''
    });
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searched, setSearched] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSearched(true);

        try {
            const params = new URLSearchParams();
            if (searchParams.keyword) params.append('keyword', searchParams.keyword);
            if (searchParams.city) params.append('city', searchParams.city);
            if (searchParams.experience) params.append('experience', searchParams.experience);

            const res = await fetch(`${API_BASE}/api/cvs/search?${params.toString()}`);
            const data = await res.json().catch(() => null);

            if (!res.ok) throw new Error(data?.error || 'Không tìm được CV');

            setSearchResults(data?.results || []);
        } catch (err) {
            setError(err?.message || 'Có lỗi xảy ra');
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    };

    const saveCv = async (cvId) => {
        const token = localStorage.getItem('token');
        if (!token) {
            setError('Bạn cần đăng nhập.');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/cvs/saved`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cvId })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Không lưu được CV');
            alert('Đã lưu CV vào Quản lý CV');
        } catch (err) {
            alert(err?.message || 'Có lỗi xảy ra');
        }
    };

    const handleChange = (e) => {
        setSearchParams({
            ...searchParams,
            [e.target.name]: e.target.value
        });
    };

    return (
        <div>
            <h2 className="mb-4">Tìm kiếm CV ứng viên</h2>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                    <form onSubmit={handleSearch}>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label">Từ khóa</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="keyword"
                                    placeholder="Vị trí, kỹ năng, kinh nghiệm..."
                                    value={searchParams.keyword}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-md-3">
                                <label className="form-label">Địa điểm</label>
                                <select
                                    className="form-select"
                                    name="city"
                                    value={searchParams.city}
                                    onChange={handleChange}
                                >
                                    <option value="">Tất cả</option>
                                    <option value="Hà Nội">Hà Nội</option>
                                    <option value="Hồ Chí Minh">Hồ Chí Minh</option>
                                    <option value="Đà Nẵng">Đà Nẵng</option>
                                </select>
                            </div>
                            <div className="col-md-3">
                                <label className="form-label">Kinh nghiệm</label>
                                <select
                                    className="form-select"
                                    name="experience"
                                    value={searchParams.experience}
                                    onChange={handleChange}
                                >
                                    <option value="">Tất cả</option>
                                    <option value="0-1">Dưới 1 năm</option>
                                    <option value="1-3">1-3 năm</option>
                                    <option value="3-5">3-5 năm</option>
                                    <option value="5+">Trên 5 năm</option>
                                </select>
                            </div>
                            <div className="col-md-12">
                                <button type="submit" className="btn btn-primary">
                                    <i className="bi bi-search me-2"></i>
                                    Tìm kiếm
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-body">
                    {error && <div className="alert alert-danger">{error}</div>}
                    
                    {loading && (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Đang tìm kiếm...</span>
                            </div>
                            <p className="mt-2">Đang tìm kiếm CV...</p>
                        </div>
                    )}

                    {!loading && !searched && (
                        <div className="text-center py-5">
                            <i className="bi bi-search fs-1 text-muted"></i>
                            <p className="text-muted mt-3">
                                Nhập từ khóa và tiêu chí để tìm kiếm CV ứng viên
                            </p>
                        </div>
                    )}

                    {!loading && searched && searchResults.length === 0 && (
                        <div className="text-center py-5">
                            <i className="bi bi-inbox fs-1 text-muted"></i>
                            <p className="text-muted mt-3">Không tìm thấy CV phù hợp</p>
                        </div>
                    )}

                    {!loading && searchResults.length > 0 && (
                        <div>
                            <div className="mb-3">
                                <h5>Tìm thấy {searchResults.length} CV</h5>
                            </div>
                            <div className="row g-3">
                                {searchResults.map((cv, idx) => (
                                    <div key={idx} className="col-12">
                                        <div className="card h-100 border">
                                            <div className="card-body">
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <div>
                                                        <h5 className="card-title mb-1">
                                                            {cv.candidateName}
                                                        </h5>
                                                        <p className="text-muted small mb-2">
                                                            <i className="bi bi-envelope me-1"></i>
                                                            {cv.candidateEmail}
                                                            {cv.candidatePhone && (
                                                                <>
                                                                    {' • '}
                                                                    <i className="bi bi-telephone me-1"></i>
                                                                    {cv.candidatePhone}
                                                                </>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <span className="badge bg-primary">{cv.title}</span>
                                                </div>
                                                
                                                {cv.summary && (
                                                    <p className="card-text mb-2">{cv.summary}</p>
                                                )}

                                                <div className="d-flex flex-wrap gap-2 mb-2">
                                                    {cv.industry && (
                                                        <span className="badge bg-secondary">
                                                            <i className="bi bi-briefcase me-1"></i>
                                                            {cv.industry}
                                                        </span>
                                                    )}
                                                    {cv.city && (
                                                        <span className="badge bg-info">
                                                            <i className="bi bi-geo-alt me-1"></i>
                                                            {cv.city}
                                                        </span>
                                                    )}
                                                    {cv.experience && (
                                                        <span className="badge bg-success">
                                                            <i className="bi bi-clock-history me-1"></i>
                                                            {cv.experience}
                                                        </span>
                                                    )}
                                                    {cv.level && (
                                                        <span className="badge bg-warning text-dark">
                                                            <i className="bi bi-star me-1"></i>
                                                            {cv.level}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="d-flex justify-content-between align-items-center">
                                                    <small className="text-muted">
                                                        Cập nhật: {cv.updatedAt ? new Date(cv.updatedAt).toLocaleDateString('vi-VN') : 'N/A'}
                                                    </small>
                                                    <button className="btn btn-sm btn-outline-primary" onClick={() => saveCv(cv.cvId)}>
                                                        <i className="bi bi-bookmark-plus me-1"></i>
                                                        Lưu CV
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CVSearch;
