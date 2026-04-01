import React, { useEffect, useState } from 'react';

const ApplicationManagement = () => {
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');
    const [selectedApp, setSelectedApp] = useState(null);
    const [updating, setUpdating] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);

    useEffect(() => {
        loadApplications();
    }, []);

    const loadApplications = async () => {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        if (!token) {
            setError('Bạn cần đăng nhập.');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/applications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Không tải được hồ sơ');

            setApplications(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err?.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    const filteredApps = applications.filter((app) => {
        if (filter === 'all') return true;
        if (filter === 'new') return app.TrangThai === 'Đã nộp';
        if (filter === 'viewed') return app.TrangThai !== 'Đã nộp';
        if (filter === 'suitable') return app.TrangThai === 'Phỏng vấn';
        return true;
    });

    const countByStatus = (status) => {
        if (status === 'all') return applications.length;
        if (status === 'new') return applications.filter((a) => a.TrangThai === 'Đã nộp').length;
        if (status === 'viewed') return applications.filter((a) => a.TrangThai !== 'Đã nộp').length;
        if (status === 'suitable') return applications.filter((a) => a.TrangThai === 'Phỏng vấn').length;
        return 0;
    };

    const openDetails = async (app) => {
        setSelectedApp(app);
        setMessageText('');
        if (!app?.MaUngVien) return;

        const token = localStorage.getItem('token');
        if (!token) return;
        setMessagesLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/messages/conversation/${app.MaUngVien}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Không tải được tin nhắn');
            setMessages(Array.isArray(data?.messages) ? data.messages : []);
        } catch {
            setMessages([]);
        } finally {
            setMessagesLoading(false);
        }
    };

    const sendMessage = async () => {
        const token = localStorage.getItem('token');
        if (!token || !selectedApp?.MaUngVien) return;
        const content = String(messageText || '').trim();
        if (!content) return;

        try {
            const res = await fetch(`${API_BASE}/api/messages`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    toUserId: selectedApp.MaUngVien,
                    jobId: selectedApp.MaTin || null,
                    content
                })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Không gửi được tin nhắn');

            if (data?.message) setMessages((prev) => [...prev, data.message]);
            setMessageText('');
        } catch (err) {
            alert(err?.message || 'Có lỗi xảy ra');
        }
    };

    const updateApplicationStatus = async (appId, newStatus) => {
        setUpdating(true);
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API_BASE}/applications/${appId}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Không cập nhật được');

            setApplications((prev) =>
                prev.map((app) =>
                    app.MaUngTuyen === appId ? { ...app, TrangThai: newStatus } : app
                )
            );
            setSelectedApp(null);
            alert(`Đã ${newStatus === 'Phù hợp' ? 'chấp nhận' : 'từ chối'} ứng viên thành công!`);
        } catch (err) {
            alert(err?.message || 'Có lỗi xảy ra');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div>
            <h2 className="mb-4">Quản lý hồ sơ ứng tuyển</h2>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card border-0 shadow-sm">
                <div className="card-body">
                    <div className="mb-3">
                        <div className="btn-group" role="group">
                            <button
                                type="button"
                                className={`btn btn-outline-primary ${filter === 'all' ? 'active' : ''}`}
                                onClick={() => setFilter('all')}
                            >
                                Tất cả ({countByStatus('all')})
                            </button>
                            <button
                                type="button"
                                className={`btn btn-outline-primary ${filter === 'new' ? 'active' : ''}`}
                                onClick={() => setFilter('new')}
                            >
                                Chưa xem ({countByStatus('new')})
                            </button>
                            <button
                                type="button"
                                className={`btn btn-outline-primary ${filter === 'viewed' ? 'active' : ''}`}
                                onClick={() => setFilter('viewed')}
                            >
                                Đã xem ({countByStatus('viewed')})
                            </button>
                            <button
                                type="button"
                                className={`btn btn-outline-primary ${filter === 'suitable' ? 'active' : ''}`}
                                onClick={() => setFilter('suitable')}
                            >
                                Phỏng vấn ({countByStatus('suitable')})
                            </button>
                        </div>
                    </div>

                    {loading && <p className="text-center py-5">Đang tải...</p>}

                    {!loading && filteredApps.length === 0 && (
                        <p className="text-muted text-center py-5">
                            {filter === 'all' ? 'Chưa có hồ sơ ứng tuyển nào.' : 'Không có hồ sơ phù hợp.'}
                        </p>
                    )}

                    {!loading && filteredApps.length > 0 && (
                        <div className="table-responsive">
                            <table className="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Ứng viên</th>
                                        <th>Email</th>
                                        <th>Vị trí ứng tuyển</th>
                                        <th>Ngày nộp</th>
                                        <th>Trạng thái</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredApps.map((app) => (
                                        <tr key={app.MaUngTuyen}>
                                            <td className="fw-semibold">{app.TenUngVien || 'N/A'}</td>
                                            <td>{app.EmailUngVien || 'N/A'}</td>
                                            <td>{app.TieuDe || 'N/A'}</td>
                                            <td>{app.NgayNop ? new Date(app.NgayNop).toLocaleDateString('vi-VN') : 'N/A'}</td>
                                            <td>
                                                <span className={`badge bg-${app.TrangThai === 'Đã nộp' ? 'primary' : app.TrangThai === 'Phỏng vấn' ? 'success' : app.TrangThai === 'Từ chối' ? 'danger' : 'secondary'}`}>
                                                    {app.TrangThai || 'Đã nộp'}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="btn btn-sm btn-outline-primary me-1"
                                                    onClick={() => openDetails(app)}
                                                >
                                                    <i className="bi bi-eye"></i> Chi tiết
                                                </button>
                                                {app.TrangThai === 'Đã nộp' && (
                                                    <>
                                                        <button
                                                            className="btn btn-sm btn-success me-1"
                                                            onClick={() => updateApplicationStatus(app.MaUngTuyen, 'Phỏng vấn')}
                                                            disabled={updating}
                                                        >
                                                            <i className="bi bi-check-circle"></i> Chấp nhận
                                                        </button>
                                                        <button
                                                            className="btn btn-sm btn-danger"
                                                            onClick={() => updateApplicationStatus(app.MaUngTuyen, 'Từ chối')}
                                                            disabled={updating}
                                                        >
                                                            <i className="bi bi-x-circle"></i> Từ chối
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {selectedApp && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Chi tiết hồ sơ ứng tuyển</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setSelectedApp(null)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                <div className="row mb-3">
                                    <div className="col-md-6">
                                        <h6 className="text-muted">Ứng viên</h6>
                                        <p className="fw-bold mb-0">{selectedApp.TenUngVien || 'N/A'}</p>
                                    </div>
                                    <div className="col-md-6">
                                        <h6 className="text-muted">Email</h6>
                                        <p className="mb-0">{selectedApp.EmailUngVien || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="row mb-3">
                                    <div className="col-md-6">
                                        <h6 className="text-muted">Vị trí ứng tuyển</h6>
                                        <p className="mb-0">{selectedApp.TieuDe || 'N/A'}</p>
                                    </div>
                                    <div className="col-md-6">
                                        <h6 className="text-muted">Ngày nộp</h6>
                                        <p className="mb-0">
                                            {selectedApp.NgayNop
                                                ? new Date(selectedApp.NgayNop).toLocaleDateString('vi-VN')
                                                : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                <div className="row mb-3">
                                    <div className="col-md-6">
                                        <h6 className="text-muted">Trạng thái</h6>
                                        <span
                                            className={`badge bg-${
                                                selectedApp.TrangThai === 'Đã nộp'
                                                    ? 'primary'
                                                    : selectedApp.TrangThai === 'Phù hợp'
                                                    ? 'success'
                                                    : 'danger'
                                            }`}
                                        >
                                            {selectedApp.TrangThai || 'Đã nộp'}
                                        </span>
                                    </div>
                                    <div className="col-md-6">
                                        <h6 className="text-muted">Mã ứng tuyển</h6>
                                        <p className="mb-0">{selectedApp.MaUngTuyen}</p>
                                    </div>
                                </div>
                                {selectedApp.ThuGioiThieu && (
                                    <div className="mb-3">
                                        <h6 className="text-muted">Thư giới thiệu</h6>
                                        <p className="border rounded p-3 bg-light">
                                            {selectedApp.ThuGioiThieu}
                                        </p>
                                    </div>
                                )}
                                {selectedApp.MaCV && (
                                    <div className="mb-3">
                                        <h6 className="text-muted">CV đính kèm</h6>
                                        <div className="d-flex flex-wrap gap-2 align-items-center">
                                            <span className="text-muted">Mã CV: {selectedApp.MaCV}</span>
                                            {selectedApp.CvFileAbsoluteUrl ? (
                                                <>
                                                    <a className="btn btn-sm btn-outline-primary" href={selectedApp.CvFileAbsoluteUrl} target="_blank" rel="noreferrer">
                                                        <i className="bi bi-eye"></i> Xem CV
                                                    </a>
                                                    <a className="btn btn-sm btn-outline-secondary" href={selectedApp.CvFileAbsoluteUrl} download>
                                                        <i className="bi bi-download"></i> Tải CV
                                                    </a>
                                                </>
                                            ) : (
                                                <span className="text-danger">Không tìm thấy file CV</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4">
                                    <h6 className="text-muted">Nhắn tin cho ứng viên</h6>
                                    <div className="border rounded p-2 mb-2" style={{ maxHeight: 220, overflowY: 'auto', background: '#fafafa' }}>
                                        {messagesLoading ? (
                                            <div className="text-muted">Đang tải tin nhắn…</div>
                                        ) : messages.length === 0 ? (
                                            <div className="text-muted">Chưa có tin nhắn.</div>
                                        ) : (
                                            messages.map((m) => (
                                                <div key={m.id} className={`mb-2 ${m.fromUserId === selectedApp.MaUngVien ? '' : 'text-end'}`}>
                                                    <div className={`d-inline-block px-3 py-2 rounded ${m.fromUserId === selectedApp.MaUngVien ? 'bg-white border' : 'bg-primary text-white'}`} style={{ maxWidth: '85%' }}>
                                                        {m.content}
                                                    </div>
                                                    <div className="small text-muted mt-1">
                                                        {m.createdAt ? new Date(m.createdAt).toLocaleString('vi-VN') : ''}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="input-group">
                                        <input
                                            className="form-control"
                                            placeholder="Nhập tin nhắn…"
                                            value={messageText}
                                            onChange={(e) => setMessageText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') sendMessage();
                                            }}
                                        />
                                        <button className="btn btn-primary" onClick={sendMessage} disabled={!messageText.trim()}>
                                            Gửi
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                {selectedApp.TrangThai === 'Đã nộp' && (
                                    <>
                                        <button
                                            className="btn btn-success"
                                            onClick={() => updateApplicationStatus(selectedApp.MaUngTuyen, 'Phỏng vấn')}
                                            disabled={updating}
                                        >
                                            <i className="bi bi-check-circle"></i> Chấp nhận
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            onClick={() => updateApplicationStatus(selectedApp.MaUngTuyen, 'Từ chối')}
                                            disabled={updating}
                                        >
                                            <i className="bi bi-x-circle"></i> Từ chối
                                        </button>
                                    </>
                                )}
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setSelectedApp(null)}
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApplicationManagement;
