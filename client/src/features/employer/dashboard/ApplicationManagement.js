import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE as CLIENT_API_BASE } from '../../../config/apiBase';
import SmartPagination from '../../../components/SmartPagination';

const PAGE_SIZE = 10;

const APPLICATION_FILTERS = [
    { key: 'all', label: 'Tất cả', icon: 'bi-collection' },
    { key: 'new', label: 'Chưa xem', icon: 'bi-envelope-paper' },
    { key: 'viewed', label: 'Đã xem', icon: 'bi-eye' },
    { key: 'interview', label: 'Phỏng vấn', icon: 'bi-calendar2-check' },
    { key: 'rejected', label: 'Từ chối', icon: 'bi-x-circle' }
];

const STATUS_CLASS_BY_VALUE = {
    'Đã nộp': 'viewed',
    'Đang xem xét': 'contacted',
    'Phỏng vấn': 'suitable',
    'Đề nghị': 'suitable',
    'Từ chối': 'rejected',
    'Đã nhận': 'suitable'
};

const getStatusValue = (app) => String(app?.TrangThai || 'Đã nộp').trim();

const ApplicationManagement = () => {
    const API_BASE = CLIENT_API_BASE;
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('all');
    const [selectedApp, setSelectedApp] = useState(null);
    const [updating, setUpdating] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const loadApplications = useCallback(async () => {
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
            if (!res.ok) throw new Error(data?.error || 'Không tải được hồ sơ ứng tuyển');

            setApplications(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err?.message || 'Có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    }, [API_BASE]);

    useEffect(() => {
        loadApplications();
    }, [loadApplications]);

    const counts = useMemo(() => {
        const all = applications.length;
        const newCount = applications.filter((app) => getStatusValue(app) === 'Đã nộp').length;
        const viewed = applications.filter((app) => getStatusValue(app) !== 'Đã nộp').length;
        const interview = applications.filter((app) => ['Phỏng vấn', 'Đề nghị'].includes(getStatusValue(app))).length;
        const rejected = applications.filter((app) => getStatusValue(app) === 'Từ chối').length;

        return {
            all,
            new: newCount,
            viewed,
            interview,
            rejected
        };
    }, [applications]);

    const filteredApps = useMemo(() => {
        if (filter === 'all') return applications;
        if (filter === 'new') return applications.filter((app) => getStatusValue(app) === 'Đã nộp');
        if (filter === 'viewed') return applications.filter((app) => getStatusValue(app) !== 'Đã nộp');
        if (filter === 'interview') return applications.filter((app) => ['Phỏng vấn', 'Đề nghị'].includes(getStatusValue(app)));
        if (filter === 'rejected') return applications.filter((app) => getStatusValue(app) === 'Từ chối');
        return applications;
    }, [applications, filter]);

    const totalFilteredApps = filteredApps.length;
    const totalPages = Math.max(1, Math.ceil(totalFilteredApps / PAGE_SIZE));
    const safeCurrentPage = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);

    const pagedFilteredApps = useMemo(() => {
        const offset = (safeCurrentPage - 1) * PAGE_SIZE;
        return filteredApps.slice(offset, offset + PAGE_SIZE);
    }, [filteredApps, safeCurrentPage]);

    const rangeFrom = totalFilteredApps === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
    const rangeTo = totalFilteredApps === 0 ? 0 : Math.min(safeCurrentPage * PAGE_SIZE, totalFilteredApps);

    useEffect(() => {
        setCurrentPage(1);
    }, [filter]);

    useEffect(() => {
        if (currentPage !== safeCurrentPage) {
            setCurrentPage(safeCurrentPage);
        }
    }, [currentPage, safeCurrentPage]);

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
            setSelectedApp((prev) => (prev?.MaUngTuyen === appId ? { ...prev, TrangThai: newStatus } : prev));
            alert(`Đã cập nhật trạng thái hồ sơ thành "${newStatus}".`);
        } catch (err) {
            alert(err?.message || 'Có lỗi xảy ra');
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div>
            <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-4">
                <div>
                    <h2 className="mb-1">Quản lý hồ sơ ứng tuyển</h2>
                    <p className="text-muted mb-0">Theo dõi nhanh hồ sơ mới, trạng thái xử lý và phản hồi ứng viên.</p>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card border-0 shadow-sm mb-3">
                <div className="card-body">
                    <div className="cv-manage-filter-wrap" role="tablist" aria-label="Lọc hồ sơ ứng tuyển">
                        {APPLICATION_FILTERS.map((item) => {
                            const active = filter === item.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={active}
                                    className={`cv-manage-filter-btn ${active ? 'active' : ''}`}
                                    onClick={() => setFilter(item.key)}
                                >
                                    <span className="cv-manage-filter-icon"><i className={`bi ${item.icon}`}></i></span>
                                    <span className="cv-manage-filter-label">{item.label}</span>
                                    <span className="cv-manage-filter-count">{counts[item.key] || 0}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="card-body">
                    {loading && <p className="text-center py-5 mb-0">Đang tải danh sách hồ sơ...</p>}

                    {!loading && filteredApps.length === 0 && (
                        <div className="text-muted text-center py-5">
                            <i className="bi bi-inbox fs-2 d-block mb-2"></i>
                            {filter === 'all' ? 'Chưa có hồ sơ ứng tuyển nào.' : 'Không có hồ sơ phù hợp bộ lọc.'}
                        </div>
                    )}

                    {!loading && filteredApps.length > 0 && (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle">
                                <thead>
                                    <tr>
                                        <th>Ứng viên</th>
                                        <th>Email</th>
                                        <th>Vị trí ứng tuyển</th>
                                        <th>Ngày nộp</th>
                                        <th>Trạng thái</th>
                                        <th className="text-end">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedFilteredApps.map((app) => {
                                        const statusValue = getStatusValue(app);
                                        return (
                                            <tr key={app.MaUngTuyen}>
                                                <td className="fw-semibold">{app.TenUngVien || 'N/A'}</td>
                                                <td>{app.EmailUngVien || 'N/A'}</td>
                                                <td>{app.TieuDe || 'N/A'}</td>
                                                <td>{app.NgayNop ? new Date(app.NgayNop).toLocaleDateString('vi-VN') : 'N/A'}</td>
                                                <td>
                                                    <span className={`cv-manage-status-pill ${STATUS_CLASS_BY_VALUE[statusValue] || 'default'}`}>
                                                        {statusValue}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <div className="cv-manage-row-actions">
                                                        <button
                                                            className="btn btn-sm btn-outline-primary"
                                                            onClick={() => openDetails(app)}
                                                        >
                                                            <i className="bi bi-eye me-1"></i>
                                                            Chi tiết
                                                        </button>

                                                        {(statusValue === 'Đã nộp' || statusValue === 'Đang xem xét') && (
                                                            <>
                                                                <button
                                                                    className="btn btn-sm btn-outline-success"
                                                                    onClick={() => updateApplicationStatus(app.MaUngTuyen, 'Phỏng vấn')}
                                                                    disabled={updating}
                                                                >
                                                                    <i className="bi bi-check2-circle me-1"></i>
                                                                    Mời phỏng vấn
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm btn-outline-danger"
                                                                    onClick={() => updateApplicationStatus(app.MaUngTuyen, 'Từ chối')}
                                                                    disabled={updating}
                                                                >
                                                                    <i className="bi bi-x-circle me-1"></i>
                                                                    Từ chối
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!loading && filteredApps.length > 0 && (
                        <div className="d-flex justify-content-end mt-3">
                            <SmartPagination
                                from={rangeFrom}
                                to={rangeTo}
                                totalItems={totalFilteredApps}
                                currentPage={safeCurrentPage}
                                pageSize={PAGE_SIZE}
                                onPageChange={setCurrentPage}
                            />
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
                                        <span className={`cv-manage-status-pill ${STATUS_CLASS_BY_VALUE[getStatusValue(selectedApp)] || 'default'}`}>
                                            {getStatusValue(selectedApp)}
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
                                        <p className="border rounded p-3 bg-light mb-0">
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
                                                        <i className="bi bi-eye me-1"></i> Xem CV
                                                    </a>
                                                    <a className="btn btn-sm btn-outline-secondary" href={selectedApp.CvFileAbsoluteUrl} download>
                                                        <i className="bi bi-download me-1"></i> Tải CV
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
                                {(getStatusValue(selectedApp) === 'Đã nộp' || getStatusValue(selectedApp) === 'Đang xem xét') && (
                                    <>
                                        <button
                                            className="btn btn-success"
                                            onClick={() => updateApplicationStatus(selectedApp.MaUngTuyen, 'Phỏng vấn')}
                                            disabled={updating}
                                        >
                                            <i className="bi bi-check-circle me-1"></i> Mời phỏng vấn
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            onClick={() => updateApplicationStatus(selectedApp.MaUngTuyen, 'Từ chối')}
                                            disabled={updating}
                                        >
                                            <i className="bi bi-x-circle me-1"></i> Từ chối
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
