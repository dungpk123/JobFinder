import React, { useEffect, useMemo, useState } from 'react';

const CVManage = () => {
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
    const [savedCVs, setSavedCVs] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const token = localStorage.getItem('token');
    const authHeaders = useMemo(() => ({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
    }), [token]);

    useEffect(() => {
        fetchSavedCVs();
    }, [filter]);

    const fetchSavedCVs = async () => {
        setLoading(true);
        setError('');
        if (!token) {
            setError('Bạn cần đăng nhập.');
            setSavedCVs([]);
            setLoading(false);
            return;
        }

        try {
            const statusMap = {
                all: '',
                viewed: 'Đã xem',
                suitable: 'Phù hợp',
                contacted: 'Đã liên hệ'
            };
            const status = statusMap[filter] || '';
            const qs = status ? `?status=${encodeURIComponent(status)}` : '';
            const res = await fetch(`${API_BASE}/api/cvs/saved${qs}`, { headers: authHeaders });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Không tải được danh sách CV đã lưu');
            setSavedCVs(Array.isArray(data?.saved) ? data.saved : []);
        } catch (err) {
            setError(err?.message || 'Có lỗi xảy ra');
            setSavedCVs([]);
        } finally {
            setLoading(false);
        }
    };

    const setCvStatus = async (cvId, status) => {
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
        } catch (err) {
            alert(err?.message || 'Có lỗi xảy ra');
        }
    };

    const counts = useMemo(() => {
        const all = savedCVs.length;
        const viewed = savedCVs.filter((x) => x.status === 'Đã xem').length;
        const suitable = savedCVs.filter((x) => x.status === 'Phù hợp').length;
        const contacted = savedCVs.filter((x) => x.status === 'Đã liên hệ').length;
        return { all, viewed, suitable, contacted };
    }, [savedCVs]);

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">Quản lý CV</h2>
            </div>

            <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                    <div className="btn-group" role="group">
                        <button 
                            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setFilter('all')}
                        >
                            Tất cả ({counts.all})
                        </button>
                        <button 
                            className={`btn ${filter === 'viewed' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setFilter('viewed')}
                        >
                            Đã xem ({counts.viewed})
                        </button>
                        <button 
                            className={`btn ${filter === 'suitable' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setFilter('suitable')}
                        >
                            Phù hợp ({counts.suitable})
                        </button>
                        <button 
                            className={`btn ${filter === 'contacted' ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setFilter('contacted')}
                        >
                            Đã liên hệ ({counts.contacted})
                        </button>
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

                    {!loading && savedCVs.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="bi bi-file-earmark-x fs-1 text-muted"></i>
                            <p className="text-muted mt-3">
                                Bạn chưa lưu CV nào. <br />
                                Hãy tìm kiếm và lưu CV ứng viên phù hợp!
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
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {savedCVs.map((cv) => (
                                            <tr key={`${cv.savedId}-${cv.cvId}`}>
                                                <td className="fw-semibold">{cv.candidateName || 'N/A'}</td>
                                                <td>{cv.candidateEmail || 'N/A'}</td>
                                                <td>{cv.city || 'N/A'}</td>
                                                <td>{cv.experience || 'N/A'}</td>
                                                <td>
                                                    <span className="badge bg-secondary">{cv.status || 'Đã lưu'}</span>
                                                </td>
                                                <td className="text-end">
                                                    <div className="btn-group">
                                                        <button className="btn btn-sm btn-outline-primary" onClick={() => setCvStatus(cv.cvId, 'Đã xem')}>Đã xem</button>
                                                        <button className="btn btn-sm btn-outline-success" onClick={() => setCvStatus(cv.cvId, 'Phù hợp')}>Phù hợp</button>
                                                        <button className="btn btn-sm btn-outline-warning" onClick={() => setCvStatus(cv.cvId, 'Đã liên hệ')}>Đã liên hệ</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
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
