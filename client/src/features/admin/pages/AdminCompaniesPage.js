import React, { useEffect, useState } from 'react';
import { Ban, Building2, ShieldCheck, Trash2 } from 'lucide-react';

const AdminCompanyRow = ({ company, onSaveStatus, onDelete, canEdit, requestConfirm, displayIndex }) => {
    const initialStatus = Number(company.TrangThaiDaiDien ?? 1);
    const [status, setStatus] = useState(initialStatus);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        setStatus(initialStatus);
    }, [initialStatus]);

    const save = async (nextStatus = status) => {
        setSaving(true);
        setErr('');
        try {
            await onSaveStatus(nextStatus);
            setStatus(nextStatus);
        } catch (e) {
            setErr(e?.message || 'Lỗi');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!canEdit) return;
        const ok = await requestConfirm({
            title: 'Xác nhận xóa',
            message: 'Bạn có chắc muốn xóa công ty này?',
            confirmText: 'Xóa'
        });
        if (!ok) return;
        setSaving(true);
        setErr('');
        try {
            await onDelete();
        } catch (e) {
            setErr(e?.message || 'Lỗi');
        } finally {
            setSaving(false);
        }
    };

    return (
        <tr>
            <td>{displayIndex}</td>
            <td className="fw-semibold">{company.TenCongTy}</td>
            <td>{company.MaSoThue || '-'}</td>
            <td>{company.ThanhPho || '-'}</td>
            <td>
                {company.Website ? (
                    <a href={company.Website} target="_blank" rel="noreferrer">{company.Website}</a>
                ) : '-'}
            </td>
            <td>
                {status === 1 ? (
                    <span className="badge bg-success-subtle text-success">Hoạt động</span>
                ) : (
                    <span className="badge bg-danger-subtle text-danger">Đã chặn</span>
                )}
            </td>
            <td>
                <div className="d-flex flex-wrap gap-2">
                    {status === 1 ? (
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-warning admin-action-icon-btn"
                            disabled={!canEdit || saving}
                            onClick={() => save(0)}
                            title="Chặn công ty"
                            aria-label="Chặn công ty"
                        >
                            <Ban size={14} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-success admin-action-icon-btn"
                            disabled={!canEdit || saving}
                            onClick={() => save(1)}
                            title="Bỏ chặn công ty"
                            aria-label="Bỏ chặn công ty"
                        >
                            <ShieldCheck size={14} />
                        </button>
                    )}
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger admin-action-icon-btn"
                        disabled={!canEdit || saving}
                        onClick={handleDelete}
                        title="Xóa công ty"
                        aria-label="Xóa công ty"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
                {err ? <div className="text-danger small mt-1">{err}</div> : null}
            </td>
        </tr>
    );
};

const AdminCompaniesPage = ({ companies, loading, canEdit, requestConfirm, onSaveCompanyStatus, onDeleteCompany }) => {
    return (
        <div className="card border-0 shadow-sm admin-module-card mb-4">
            <div className="card-header bg-white border-0 py-3">
                <h5 className="mb-0 d-flex align-items-center gap-2">
                    <Building2 size={18} />
                    <span>Quản lý công ty</span>
                </h5>
            </div>
            <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th style={{ width: 90 }}>ID</th>
                            <th>Tên công ty</th>
                            <th style={{ width: 170 }}>Mã số thuế</th>
                            <th style={{ width: 140 }}>Tỉnh/TP</th>
                            <th style={{ width: 220 }}>Website</th>
                            <th style={{ width: 150 }}>Trạng thái</th>
                            <th style={{ width: 200 }}>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {companies.map((c, index) => (
                            <AdminCompanyRow
                                key={c.MaCongTy}
                                company={c}
                                displayIndex={index + 1}
                                canEdit={canEdit}
                                requestConfirm={requestConfirm}
                                onSaveStatus={(status) => onSaveCompanyStatus(c.MaCongTy, status)}
                                onDelete={() => onDeleteCompany(c.MaCongTy)}
                            />
                        ))}
                        {companies.length === 0 && !loading && (
                            <tr><td colSpan={7} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminCompaniesPage;
