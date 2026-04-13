import React, { useEffect, useState } from 'react';
import { History, Trash2 } from 'lucide-react';
import SmartPagination from '../../../components/SmartPagination';

const PAGE_LIMIT = 30;

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('vi-VN');
};

const formatUserLabel = (row) => {
    const name = String(row?.user_name || '').trim();
    if (name) return name;

    const email = String(row?.user_email || '').trim();
    if (email) return email;

    if (row?.user_id != null) return `User #${row.user_id}`;
    return 'Hệ thống';
};

const formatObjectRef = (row) => {
    const object = String(row?.entity_type || '').trim();
    const objectId = row?.entity_id != null ? String(row.entity_id).trim() : '';
    if (!object && !objectId) return '-';
    if (!objectId) return object || '-';
    return `${object || 'Đối tượng'} #${objectId}`;
};

const AdminAuditLogsPage = ({ API_BASE, authHeaders }) => {
    const [offset, setOffset] = useState(0);
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState('');

    const page = Math.floor(offset / PAGE_LIMIT) + 1;
    const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / PAGE_LIMIT));
    const fromRecord = total === 0 ? 0 : offset + 1;
    const toRecord = total === 0 ? 0 : Math.min(offset + Math.max(1, logs.length), total);

    const fetchLogs = async () => {
        setLoading(true);
        setError('');

        try {
            const query = new URLSearchParams();
            query.set('limit', String(PAGE_LIMIT));
            query.set('offset', String(Math.max(0, offset)));

            const response = await fetch(`${API_BASE}/api/admin/audit-logs?${query.toString()}`, {
                headers: authHeaders
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Không tải được nhật ký quản trị');
            }

            setLogs(Array.isArray(data.logs) ? data.logs : []);
            setTotal(Number(data?.pagination?.total || 0));
        } catch (err) {
            setLogs([]);
            setTotal(0);
            setError(err?.message || 'Không tải được nhật ký quản trị');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!API_BASE) return;
        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [API_BASE, authHeaders, offset]);

    const handleDeleteLog = async (row) => {
        const targetId = Number(row?.id);
        if (!Number.isFinite(targetId)) return;
        if (!window.confirm(`Bạn có chắc muốn xóa audit-log #${targetId}?`)) return;

        setDeletingId(targetId);
        setError('');

        try {
            const response = await fetch(`${API_BASE}/api/admin/audit-logs/${targetId}`, {
                method: 'DELETE',
                headers: authHeaders
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Không thể xóa audit-log');
            }

            const isDeletingLastRowInPage = logs.length === 1 && offset > 0;
            if (isDeletingLastRowInPage) {
                setOffset((prev) => Math.max(0, prev - PAGE_LIMIT));
            } else {
                await fetchLogs();
            }
        } catch (err) {
            setError(err?.message || 'Không thể xóa audit-log');
        } finally {
            setDeletingId(null);
        }
    };

    const handlePageChange = (nextPage) => {
        const safePage = Math.max(1, Math.min(totalPages, Number(nextPage) || 1));
        setOffset((safePage - 1) * PAGE_LIMIT);
    };

    return (
        <div className="card border-0 shadow-sm admin-module-card mb-4">
            <div className="card-header bg-white border-0 py-3 d-flex align-items-center gap-2">
                <h5 className="mb-0 d-flex align-items-center gap-2">
                    <History size={18} />
                    <span>Nhật ký quản trị</span>
                </h5>
            </div>

            <div className="card-body pt-2 pb-3">
                <div className="admin-audit-meta">
                    <span>Tổng bản ghi: <strong>{total.toLocaleString('vi-VN')}</strong></span>
                    <span>Trang: <strong>{page}/{totalPages}</strong></span>
                </div>

                {error ? <div className="alert alert-danger mt-3 mb-0">{error}</div> : null}

                <div className="table-responsive mt-3">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th style={{ width: 90 }}>ID</th>
                                <th style={{ width: 220 }}>Người thực hiện</th>
                                <th style={{ width: 240 }}>Nội dung hành động</th>
                                <th style={{ width: 180 }}>Đối tượng</th>
                                <th style={{ width: 190 }}>Thời gian</th>
                                <th style={{ width: 130 }}>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center text-muted py-4">Chưa có nhật ký phù hợp</td>
                                </tr>
                            ) : null}

                            {logs.map((row, index) => (
                                <tr key={row.id}>
                                    <td>{offset + index + 1}</td>
                                    <td>
                                        <div className="fw-semibold">{formatUserLabel(row)}</div>
                                        {row.user_email ? <small className="text-muted">{row.user_email}</small> : null}
                                    </td>
                                    <td>{String(row.action || '-')}</td>
                                    <td>{formatObjectRef(row)}</td>
                                    <td>{formatDateTime(row.timestamp)}</td>
                                    <td>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-danger"
                                            onClick={() => handleDeleteLog(row)}
                                            disabled={loading || deletingId === row.id}
                                            title="Xóa audit-log"
                                            aria-label="Xóa audit-log"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="d-flex justify-content-between align-items-center gap-2 mt-3 flex-wrap">
                    <SmartPagination
                        from={fromRecord}
                        to={toRecord}
                        currentPage={page}
                        totalItems={total}
                        pageSize={PAGE_LIMIT}
                        onPageChange={handlePageChange}
                        loading={loading}
                    />
                </div>
            </div>
        </div>
    );
};

export default AdminAuditLogsPage;
