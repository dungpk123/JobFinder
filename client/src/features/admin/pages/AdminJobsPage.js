import React, { useState } from 'react';
import { BriefcaseBusiness } from 'lucide-react';

const AdminJobRow = ({ job, onDelete, canDelete, requestConfirm }) => {
    const status = job.TrangThai || 'Nháp';
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
            <td>{job.MaTin}</td>
            <td className="fw-semibold">{job.TieuDe}</td>
            <td>{job.TenCongTy || '-'}</td>
            <td>{job.ThanhPho || '-'}</td>
            <td>
                <span className="badge bg-secondary-subtle text-secondary">{status}</span>
            </td>
            <td>
                <div className="d-flex flex-wrap gap-2">
                    <button className="btn btn-sm btn-outline-danger" disabled={!canDelete || deleting} onClick={handleDelete}>
                        Xóa
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
                    <span>Quản lý tin tuyển dụng</span>
                </h5>
            </div>
            <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th style={{ width: 90 }}>Mã tin</th>
                            <th>Tiêu đề</th>
                            <th style={{ width: 200 }}>Công ty</th>
                            <th style={{ width: 140 }}>Tỉnh/TP</th>
                            <th style={{ width: 170 }}>Trạng thái</th>
                            <th style={{ width: 180 }}>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.map((j) => (
                            <AdminJobRow
                                key={j.MaTin}
                                job={j}
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
