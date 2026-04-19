import React, { useState } from 'react';
import { BriefcaseBusiness, ExternalLink, Trash2 } from 'lucide-react';

const getStatusBadgeClass = (status) => {
    const normalized = String(status || '').trim();

    if (normalized === 'Đã đăng') return 'bg-success-subtle text-success border border-success-subtle';
    if (normalized === 'Đã đóng') return 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
    if (normalized === 'Lưu trữ') return 'bg-dark-subtle text-secondary border border-secondary-subtle';
    return 'bg-secondary-subtle text-secondary border border-secondary-subtle';
};

const AdminJobRow = ({ job, onDelete, canDelete, requestConfirm, displayIndex }) => {
    const status = job.TrangThai || 'Nháp';
    const jobId = job?.MaTin != null ? String(job.MaTin).trim() : '';
    const publicJobUrl = jobId ? `/jobs/${encodeURIComponent(jobId)}` : '';
    const [deleting, setDeleting] = useState(false);
    const [err, setErr] = useState('');

    const handleDelete = async () => {
        if (!canDelete) return;
        const ok = await requestConfirm({
            title: 'Xác nhận xóa',
            message: 'Bạn có chắc muốn xóa tin tuyển dụng này?',
            confirmText: 'Xóa'
        });
        if (!ok) return;
        setDeleting(true);
        setErr('');
        try {
            await onDelete();
        } catch (e) {
            setErr(e?.message || 'Lỗi');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <tr>
            <td>{displayIndex}</td>
            <td className="fw-semibold">{job.TieuDe}</td>
            <td>{job.TenCongTy || '-'}</td>
            <td>{job.ThanhPho || '-'}</td>
            <td className="admin-status-col">
                <span className={`badge ${getStatusBadgeClass(status)}`}>{status}</span>
            </td>
            <td className="admin-action-col">
                <div className="admin-row-actions">
                    {publicJobUrl ? (
                        <a
                            className="btn btn-sm btn-outline-primary admin-action-icon-btn"
                            href={publicJobUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Xem tin đã đăng"
                            aria-label="Xem tin đã đăng"
                        >
                            <ExternalLink size={14} />
                        </a>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-primary admin-action-icon-btn"
                            disabled
                            title="Không tìm thấy mã tin"
                            aria-label="Không tìm thấy mã tin"
                        >
                            <ExternalLink size={14} />
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger admin-action-icon-btn"
                        disabled={!canDelete || deleting}
                        onClick={handleDelete}
                        title="Xóa tin tuyển dụng"
                        aria-label="Xóa tin tuyển dụng"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
                {err ? <div className="text-danger small mt-1">{err}</div> : null}
            </td>
        </tr>
    );
};

const AdminJobsPage = ({ jobs, loading, canDelete, requestConfirm, onDeleteJob }) => {
    return (
        <div className="card border-0 shadow-sm admin-module-card mb-4">
            <div className="card-header bg-white border-0 py-3">
                <h5 className="mb-0 d-flex align-items-center gap-2">
                    <BriefcaseBusiness size={18} />
                    <span>Kiểm duyệt tin tuyển dụng</span>
                </h5>
            </div>
            <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th style={{ width: 90 }}>ID</th>
                            <th>Tiêu đề</th>
                            <th style={{ width: 200 }}>Công ty</th>
                            <th style={{ width: 140 }}>Tỉnh/TP</th>
                            <th style={{ width: 170 }} className="admin-status-col">Trạng thái</th>
                            <th style={{ width: 220 }} className="admin-action-col">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.map((j, index) => (
                            <AdminJobRow
                                key={j.MaTin}
                                job={j}
                                displayIndex={index + 1}
                                requestConfirm={requestConfirm}
                                onDelete={() => onDeleteJob(j.MaTin)}
                                canDelete={canDelete}
                            />
                        ))}
                        {jobs.length === 0 && !loading && (
                            <tr><td colSpan={6} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminJobsPage;
