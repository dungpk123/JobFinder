import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE as CLIENT_API_BASE } from '../../../config/apiBase';

const STATUS_FILTERS = [
    { key: 'all', label: 'Tất cả', icon: 'bi-collection' },
    { key: 'viewed', label: 'Đã xem', icon: 'bi-eye' },
    { key: 'contacted', label: 'Đã liên hệ', icon: 'bi-chat-dots' }
];

const STATUS_VALUE_BY_FILTER = {
    viewed: 'Đã xem',
    contacted: 'Đã liên hệ'
};

const STATUS_CLASS_BY_VALUE = {
    'N/A': 'na',
    'Đã xem': 'viewed',
    'Đã liên hệ': 'contacted'
};

const normalizeCvStatus = (status) => {
    const value = String(status || '').trim();
    if (value === 'Đã xem' || value === 'Đã liên hệ') return value;
    return 'N/A';
};

const CVManage = () => {
    const API_BASE = CLIENT_API_BASE;
    const navigate = useNavigate();
    const [savedCVs, setSavedCVs] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const token = localStorage.getItem('token');
    const authHeaders = useMemo(() => ({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
    }), [token]);

    const fetchSavedCVs = useCallback(async () => {
        setLoading(true);
        setError('');
        if (!token) {
            setError('Bạn cần đăng nhập.');
            setSavedCVs([]);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/cvs/saved`, { headers: authHeaders });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Không tải được danh sách CV đã lưu');
            setSavedCVs(Array.isArray(data?.saved) ? data.saved : []);
        } catch (err) {
            setError(err?.message || 'Có lỗi xảy ra');
            setSavedCVs([]);
        } finally {
            setLoading(false);
        }
    }, [API_BASE, authHeaders, token]);

    useEffect(() => {
        fetchSavedCVs();
    }, [fetchSavedCVs]);

    const setCvStatus = async (cvId, status, options = {}) => {
        const { silent = false } = options;
        if (!token) return;
        try {
            const res = await fetch(`${API_BASE}/api/cvs/saved/${cvId}`, {
                method: 'PATCH',
                headers: authHeaders,
                body: JSON.stringify({ status })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Không cập nhật được');

            setSavedCVs((prev) => prev.map((x) => (x.cvId === cvId ? { ...x, status } : x)));
            return true;
        } catch (err) {
            if (!silent) alert(err?.message || 'Có lỗi xảy ra');
            return false;
        }
    };

    const removeSavedCv = async (cvId) => {
        if (!token) return;
        const confirmed = window.confirm('Bạn có chắc chắn muốn xóa CV này khỏi danh sách đã lưu?');
        if (!confirmed) return;

        try {
            const res = await fetch(`${API_BASE}/api/cvs/saved/${cvId}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Không xóa được CV đã lưu');

            setSavedCVs((prev) => prev.filter((item) => item.cvId !== cvId));
        } catch (err) {
            alert(err?.message || 'Có lỗi xảy ra');
        }
    };

    const openCvPreview = async (cv) => {
        const fileUrl = String(cv?.cvFileAbsoluteUrl || cv?.cvFileUrl || '').trim();
        if (!fileUrl) {
            alert('Ứng viên chưa đính kèm file CV để xem.');
            return;
        }

        try {
            const response = await fetch(fileUrl, { method: 'HEAD' });
            if (!response.ok && response.status !== 405) {
                alert('File CV không còn tồn tại trên hệ thống. Vui lòng liên hệ ứng viên để cập nhật CV mới.');
                return;
            }
        } catch {
            // Keep opening behavior to avoid blocking when HEAD cannot be performed.
        }

        await setCvStatus(cv.cvId, 'Đã xem', { silent: true });
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
    };

    const openMessageBox = async (cv) => {
        const candidateUserId = Number.parseInt(String(cv?.candidateUserId || ''), 10);
        if (!Number.isFinite(candidateUserId)) {
            setError('Không xác định được ứng viên để nhắn tin.');
            return;
        }

        await setCvStatus(cv.cvId, 'Đã liên hệ', { silent: true });

        const params = new URLSearchParams({
            userId: String(candidateUserId),
            name: String(cv?.candidateName || ''),
            email: String(cv?.candidateEmail || ''),
            cvId: String(cv?.cvId || '')
        });

        navigate(`/employer/messages?${params.toString()}`);
    };

    const counts = useMemo(() => {
        const all = savedCVs.length;
        const viewed = savedCVs.filter((x) => normalizeCvStatus(x.status) === 'Đã xem').length;
        const contacted = savedCVs.filter((x) => normalizeCvStatus(x.status) === 'Đã liên hệ').length;
        return { all, viewed, contacted };
    }, [savedCVs]);

    const filteredSavedCVs = useMemo(() => {
        if (filter === 'all') return savedCVs;
        const statusValue = STATUS_VALUE_BY_FILTER[filter];
        return savedCVs.filter((item) => normalizeCvStatus(item.status) === statusValue);
    }, [filter, savedCVs]);

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0 employer-page-title">Quản lý CV</h2>
            </div>

            <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                    <div className="cv-manage-filter-wrap" role="tablist" aria-label="Lọc trạng thái CV">
                        {STATUS_FILTERS.map((item) => {
                            const isActive = filter === item.key;
                            const count = counts[item.key] || 0;

                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    className={`cv-manage-filter-btn ${isActive ? 'active' : ''}`}
                                    onClick={() => setFilter(item.key)}
                                >
                                    <span className="cv-manage-filter-icon"><i className={`bi ${item.icon}`}></i></span>
                                    <span className="cv-manage-filter-label">{item.label}</span>
                                    <span className="cv-manage-filter-count">{count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-body">
                    {error && <div className="alert alert-danger">{error}</div>}

                    {loading && (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    )}

                    {!loading && filteredSavedCVs.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="bi bi-file-earmark-x fs-1 text-muted"></i>
                            <p className="text-muted mt-3">
                                {filter === 'all'
                                    ? 'Bạn chưa lưu CV nào.'
                                    : 'Không có CV ở trạng thái lọc hiện tại.'}
                                <br />
                                Hãy tìm kiếm và lưu CV ứng viên phù hợp.
                            </p>
                        </div>
                    ) : (
                        !loading && (
                            <div className="table-responsive">
                                <table className="table table-hover align-middle">
                                    <thead>
                                        <tr>
                                            <th>Ứng viên</th>
                                            <th>Email</th>
                                            <th>Địa điểm</th>
                                            <th>Kinh nghiệm</th>
                                            <th>Trạng thái</th>
                                            <th className="text-end">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSavedCVs.map((cv) => {
                                            const statusLabel = normalizeCvStatus(cv.status);
                                            return (
                                                <tr key={`${cv.savedId}-${cv.cvId}`}>
                                                    <td className="fw-semibold">{cv.candidateName || 'N/A'}</td>
                                                    <td>{cv.candidateEmail || 'N/A'}</td>
                                                    <td>{cv.city || 'N/A'}</td>
                                                    <td>{cv.experience || 'N/A'}</td>
                                                    <td>
                                                        <span className={`cv-manage-status-pill ${STATUS_CLASS_BY_VALUE[statusLabel] || 'default'}`}>
                                                            {statusLabel}
                                                        </span>
                                                    </td>
                                                    <td className="text-end">
                                                        <div className="cv-manage-row-actions">
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-primary cv-manage-action-icon"
                                                                title="Xem CV"
                                                                aria-label="Xem CV"
                                                                onClick={() => openCvPreview(cv)}
                                                            >
                                                                <i className="bi bi-eye"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-info cv-manage-action-icon"
                                                                title="Nhắn tin"
                                                                aria-label="Nhắn tin"
                                                                onClick={() => openMessageBox(cv)}
                                                            >
                                                                <i className="bi bi-chat-dots"></i>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn btn-sm btn-outline-danger cv-manage-action-icon"
                                                                title="Xóa khỏi đã lưu"
                                                                aria-label="Xóa khỏi đã lưu"
                                                                onClick={() => removeSavedCv(cv.cvId)}
                                                            >
                                                                <i className="bi bi-trash"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default CVManage;
