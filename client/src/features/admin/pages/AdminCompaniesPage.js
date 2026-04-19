import React, { useEffect, useState } from 'react';
import { Ban, Building2, Eye, ExternalLink, ShieldCheck, Trash2, X } from 'lucide-react';

const normalizeWebsiteUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
};

const getCompanyStatusLabel = (value) => {
    return Number(value) === 1 ? 'Hoạt động' : 'Đã chặn';
};

const AdminCompanyDetailModal = ({ company, onClose }) => {
    const websiteHref = normalizeWebsiteUrl(company?.Website);

    return (
        <div className="admin-confirm-backdrop" role="dialog" aria-modal="true" aria-label="Chi tiết công ty">
            <div className="admin-confirm-dialog admin-company-view-dialog card border-0 shadow-sm">
                <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-3">
                        <div>
                            <h5 className="mb-1">Thông tin công ty</h5>
                            <p className="text-muted mb-0">Chi tiết hồ sơ doanh nghiệp được quản lý trong hệ thống JobFinder.</p>
                        </div>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary admin-icon-action-btn"
                            onClick={onClose}
                            title="Đóng"
                            aria-label="Đóng"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    <div className="admin-company-view-grid">
                        <article className="admin-company-view-field">
                            <span>Mã công ty</span>
                            <strong>{company?.MaCongTy ?? '-'}</strong>
                        </article>
                        <article className="admin-company-view-field">
                            <span>Trạng thái</span>
                            <strong>{getCompanyStatusLabel(company?.TrangThaiDaiDien)}</strong>
                        </article>
                        <article className="admin-company-view-field admin-company-view-field-span-2">
                            <span>Tên công ty</span>
                            <strong>{company?.TenCongTy || '-'}</strong>
                        </article>
                        <article className="admin-company-view-field">
                            <span>Mã số thuế</span>
                            <strong>{company?.MaSoThue || '-'}</strong>
                        </article>
                        <article className="admin-company-view-field">
                            <span>Tỉnh/TP</span>
                            <strong>{company?.ThanhPho || '-'}</strong>
                        </article>
                        <article className="admin-company-view-field">
                            <span>Người đại diện</span>
                            <strong>{company?.TenNguoiDaiDien || '-'}</strong>
                        </article>
                        <article className="admin-company-view-field">
                            <span>Email đại diện</span>
                            <strong>{company?.EmailDaiDien || '-'}</strong>
                        </article>
                        <article className="admin-company-view-field admin-company-view-field-span-2">
                            <span>Website</span>
                            <strong>{company?.Website || '-'}</strong>
                        </article>
                    </div>

                    <div className="admin-company-view-actions">
                        {websiteHref ? (
                            <a
                                className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                                href={websiteHref}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <ExternalLink size={14} />
                                <span>Mở website công ty</span>
                            </a>
                        ) : null}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AdminCompanyRow = ({ company, onView, onSaveStatus, onDelete, canEdit, requestConfirm, displayIndex }) => {
    const initialStatus = Number(company.TrangThaiDaiDien ?? 1);
    const websiteHref = normalizeWebsiteUrl(company?.Website);
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
                {websiteHref ? (
                    <a href={websiteHref} target="_blank" rel="noreferrer">{company.Website}</a>
                ) : '-'}
            </td>
            <td className="admin-status-col">
                {status === 1 ? (
                    <span className="badge bg-success-subtle text-success">Hoạt động</span>
                ) : (
                    <span className="badge bg-danger-subtle text-danger">Đã chặn</span>
                )}
            </td>
            <td className="admin-action-col">
                <div className="admin-row-actions">
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-primary admin-action-icon-btn"
                        onClick={onView}
                        title="Xem thông tin công ty"
                        aria-label="Xem thông tin công ty"
                    >
                        <Eye size={14} />
                    </button>
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
    const [viewingCompany, setViewingCompany] = useState(null);

    return (
        <>
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
                                <th style={{ width: 150 }} className="admin-status-col">Trạng thái</th>
                                <th style={{ width: 240 }} className="admin-action-col">Thao tác</th>
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
                                    onView={() => setViewingCompany(c)}
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

            {viewingCompany ? (
                <AdminCompanyDetailModal
                    company={viewingCompany}
                    onClose={() => setViewingCompany(null)}
                />
            ) : null}
        </>
    );
};

export default AdminCompaniesPage;
