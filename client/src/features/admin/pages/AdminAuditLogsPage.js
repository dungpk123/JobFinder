import React, { useEffect, useMemo, useState } from 'react';
import { History, RefreshCcw, Search } from 'lucide-react';

const LIMIT_OPTIONS = [20, 30, 50, 100];

const createInitialFilters = () => ({
    keyword: '',
    action: '',
    object: '',
    adminId: '',
    fromDate: '',
    toDate: '',
    limit: 30
});

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('vi-VN');
};

const formatAdminLabel = (row) => {
    const name = String(row?.TenQuanTri || '').trim();
    if (name) return name;

    const email = String(row?.EmailQuanTri || '').trim();
    if (email) return email;

    if (row?.MaQuanTri != null) return `Admin #${row.MaQuanTri}`;
    return 'Hệ thống';
};

const formatObjectRef = (row) => {
    const object = String(row?.DoiTuong || '').trim();
    const objectId = row?.MaDoiTuong != null ? String(row.MaDoiTuong).trim() : '';
    if (!object && !objectId) return '-';
    if (!objectId) return object || '-';
    return `${object || 'Đối tượng'} #${objectId}`;
};

const formatNote = (value) => {
    const text = String(value || '').trim();
    if (!text) return '-';
    if (text.length <= 180) return text;
    return `${text.slice(0, 180)}...`;
};

const toSafeInt = (value, fallback = 0) => {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const AdminAuditLogsPage = ({ API_BASE, authHeaders }) => {
    const [filters, setFilters] = useState(createInitialFilters);
    const [appliedFilters, setAppliedFilters] = useState(createInitialFilters);
    const [offset, setOffset] = useState(0);

    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const limit = Math.max(1, toSafeInt(appliedFilters.limit, 30));
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / limit));

    const fetchLogs = async () => {
        setLoading(true);
        setError('');

        try {
            const query = new URLSearchParams();
            query.set('limit', String(limit));
            query.set('offset', String(Math.max(0, offset)));

            if (appliedFilters.keyword) query.set('keyword', appliedFilters.keyword);
            if (appliedFilters.action) query.set('action', appliedFilters.action);
            if (appliedFilters.object) query.set('object', appliedFilters.object);
            if (appliedFilters.adminId) query.set('adminId', appliedFilters.adminId);
            if (appliedFilters.fromDate) query.set('fromDate', appliedFilters.fromDate);
            if (appliedFilters.toDate) query.set('toDate', appliedFilters.toDate);

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
    }, [API_BASE, authHeaders, offset, limit, appliedFilters.keyword, appliedFilters.action, appliedFilters.object, appliedFilters.adminId, appliedFilters.fromDate, appliedFilters.toDate]);

    const actionOptions = useMemo(() => {
        const values = new Set();
        (logs || []).forEach((item) => {
            const value = String(item?.HanhDong || '').trim();
            if (value) values.add(value);
        });
        return Array.from(values);
    }, [logs]);

    const objectOptions = useMemo(() => {
        const values = new Set();
        (logs || []).forEach((item) => {
            const value = String(item?.DoiTuong || '').trim();
            if (value) values.add(value);
        });
        return Array.from(values);
    }, [logs]);

    const submitFilters = (event) => {
        event.preventDefault();
        setOffset(0);
        setAppliedFilters({
            keyword: String(filters.keyword || '').trim(),
            action: String(filters.action || '').trim(),
            object: String(filters.object || '').trim(),
            adminId: String(filters.adminId || '').trim(),
            fromDate: String(filters.fromDate || '').trim(),
            toDate: String(filters.toDate || '').trim(),
            limit: LIMIT_OPTIONS.includes(toSafeInt(filters.limit, 30)) ? toSafeInt(filters.limit, 30) : 30
        });
    };

    return (
        <div className="card border-0 shadow-sm admin-module-card mb-4">
            <div className="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center gap-2 flex-wrap">
                <h5 className="mb-0 d-flex align-items-center gap-2">
                    <History size={18} />
                    <span>Nhật ký quản trị</span>
                </h5>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={fetchLogs} disabled={loading}>
                    <RefreshCcw size={14} className="me-1" />
                    Làm mới
                </button>
            </div>

            <div className="card-body pt-2 pb-3">
                <form className="admin-audit-filter-grid" onSubmit={submitFilters}>
                    <div>
                        <label className="form-label mb-1">Từ khóa</label>
                        <div className="input-group input-group-sm">
                            <span className="input-group-text"><Search size={14} /></span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Tìm theo hành động, đối tượng, ghi chú..."
                                value={filters.keyword}
                                onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="form-label mb-1">Hành động</label>
                        <input
                            list="admin-audit-action-options"
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Ví dụ: Cập nhật người dùng"
                            value={filters.action}
                            onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))}
                        />
                        <datalist id="admin-audit-action-options">
                            {actionOptions.map((item) => (
                                <option key={item} value={item} />
                            ))}
                        </datalist>
                    </div>

                    <div>
                        <label className="form-label mb-1">Đối tượng</label>
                        <input
                            list="admin-audit-object-options"
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Ví dụ: NguoiDung"
                            value={filters.object}
                            onChange={(event) => setFilters((prev) => ({ ...prev, object: event.target.value }))}
                        />
                        <datalist id="admin-audit-object-options">
                            {objectOptions.map((item) => (
                                <option key={item} value={item} />
                            ))}
                        </datalist>
                    </div>

                    <div>
                        <label className="form-label mb-1">Mã quản trị</label>
                        <input
                            type="number"
                            min="1"
                            className="form-control form-control-sm"
                            placeholder="Ví dụ: 1"
                            value={filters.adminId}
                            onChange={(event) => setFilters((prev) => ({ ...prev, adminId: event.target.value }))}
                        />
                    </div>

                    <div>
                        <label className="form-label mb-1">Từ ngày</label>
                        <input
                            type="date"
                            className="form-control form-control-sm"
                            value={filters.fromDate}
                            onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value }))}
                        />
                    </div>

                    <div>
                        <label className="form-label mb-1">Đến ngày</label>
                        <input
                            type="date"
                            className="form-control form-control-sm"
                            value={filters.toDate}
                            onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value }))}
                        />
                    </div>

                    <div>
                        <label className="form-label mb-1">Số dòng/trang</label>
                        <select
                            className="form-select form-select-sm"
                            value={filters.limit}
                            onChange={(event) => setFilters((prev) => ({ ...prev, limit: toSafeInt(event.target.value, 30) }))}
                        >
                            {LIMIT_OPTIONS.map((item) => (
                                <option key={item} value={item}>{item}</option>
                            ))}
                        </select>
                    </div>

                    <div className="admin-audit-filter-actions">
                        <button type="submit" className="btn btn-sm btn-primary" disabled={loading}>
                            Áp dụng bộ lọc
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => {
                                const initial = createInitialFilters();
                                setFilters(initial);
                                setAppliedFilters(initial);
                                setOffset(0);
                            }}
                            disabled={loading}
                        >
                            Xóa lọc
                        </button>
                    </div>
                </form>

                <div className="admin-audit-meta mt-3">
                    <span>Tổng bản ghi: <strong>{total.toLocaleString('vi-VN')}</strong></span>
                    <span>Trang: <strong>{page}/{totalPages}</strong></span>
                </div>

                {error ? <div className="alert alert-danger mt-3 mb-0">{error}</div> : null}

                <div className="table-responsive mt-3">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th style={{ width: 90 }}>Mã</th>
                                <th style={{ width: 190 }}>Thời gian</th>
                                <th style={{ width: 200 }}>Quản trị viên</th>
                                <th style={{ width: 240 }}>Hành động</th>
                                <th style={{ width: 180 }}>Đối tượng</th>
                                <th>Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!loading && logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center text-muted py-4">Chưa có nhật ký phù hợp</td>
                                </tr>
                            ) : null}

                            {logs.map((row) => (
                                <tr key={row.MaNhatKy}>
                                    <td>{row.MaNhatKy}</td>
                                    <td>{formatDateTime(row.NgayThucHien)}</td>
                                    <td>
                                        <div className="fw-semibold">{formatAdminLabel(row)}</div>
                                        {row.EmailQuanTri ? <small className="text-muted">{row.EmailQuanTri}</small> : null}
                                    </td>
                                    <td>{String(row.HanhDong || '-')}</td>
                                    <td>{formatObjectRef(row)}</td>
                                    <td className="admin-audit-note">{formatNote(row.GhiChu)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="d-flex justify-content-between align-items-center gap-2 mt-3 flex-wrap">
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
                        disabled={loading || offset <= 0}
                    >
                        Trang trước
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => setOffset((prev) => prev + limit)}
                        disabled={loading || offset + limit >= total}
                    >
                        Trang sau
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminAuditLogsPage;
