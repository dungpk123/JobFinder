import React, { useState } from 'react';
import { CheckCircle2, ClipboardList, EyeOff, Lock, Trash2, X } from 'lucide-react';

const formatDateTime = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString('vi-VN');
};

const toText = (value) => String(value || '').trim();

const shortText = (value, maxLen = 120) => {
    const text = toText(value);
    if (!text) return '-';
    if (text.length <= maxLen) return text;
    return `${text.slice(0, maxLen)}...`;
};

const formatCode = (prefix, value) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '-';
    return `${prefix}-${raw}`;
};

const normalizeStatusClass = (status) => {
    const text = toText(status).toLowerCase();
    if (!text) return 'neutral';
    if (text.includes('đã xử lý') || text.includes('duyệt')) return 'success';
    if (text.includes('đang')) return 'warning';
    if (text.includes('từ chối')) return 'danger';
    return 'neutral';
};

const AdminReportsPage = ({ reports, loading, onApproveReport, onDeleteReport, requestConfirm }) => {
    const [activeReport, setActiveReport] = useState(null);
    const [hideContent, setHideContent] = useState(true);
    const [lockEntity, setLockEntity] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [modalError, setModalError] = useState('');

    const openApproveModal = (report) => {
        setActiveReport(report);
        setHideContent(true);
        setLockEntity(false);
        setModalError('');
    };

    const closeApproveModal = () => {
        if (processing) return;
        setActiveReport(null);
        setHideContent(true);
        setLockEntity(false);
        setModalError('');
    };

    const confirmDeleteReport = async (report) => {
        const reportId = Number(report?.MaBaoCao);
        if (!Number.isFinite(reportId)) return;

        let approved = false;
        if (typeof requestConfirm === 'function') {
            approved = await requestConfirm({
                title: 'Xóa báo cáo',
                message: `Bạn có chắc muốn xóa báo cáo #${reportId}? Thao tác này không thể hoàn tác.`,
                confirmText: 'Xóa',
                cancelText: 'Hủy'
            });
        } else {
            approved = window.confirm(`Bạn có chắc muốn xóa báo cáo #${reportId}?`);
        }

        if (!approved) return;

        setDeletingId(reportId);
        try {
            await onDeleteReport(reportId);
        } finally {
            setDeletingId(null);
        }
    };

    const submitApproveReport = async () => {
        const reportId = Number(activeReport?.MaBaoCao);
        if (!Number.isFinite(reportId)) return;

        setProcessing(true);
        setModalError('');
        try {
            await onApproveReport(reportId, {
                hideContent,
                lockEntity
            });
            closeApproveModal();
        } catch (err) {
            setModalError(err?.message || 'Không thể phê duyệt báo cáo');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <>
            <div className="card border-0 shadow-sm admin-module-card">
                <div className="card-header bg-white border-0 py-3">
                    <h5 className="mb-0 d-flex align-items-center gap-2">
                        <ClipboardList size={18} />
                        <span>Báo cáo</span>
                    </h5>
                </div>
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th style={{ width: 90 }}>ID</th>
                                <th style={{ width: 125 }}>Người báo</th>
                                <th style={{ width: 180 }}>Loại đối tượng</th>
                                <th style={{ width: 125 }}>Đối tượng</th>
                                <th style={{ width: 210 }}>Lý do</th>
                                <th>Chi tiết</th>
                                <th style={{ width: 140 }}>Trạng thái</th>
                                <th style={{ width: 190 }}>Ngày báo cáo</th>
                                <th style={{ width: 110 }}>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((report, index) => (
                                <tr key={report.MaBaoCao}>
                                    <td>{index + 1}</td>
                                    <td><span className="admin-code-chip">{formatCode('NB', report.MaNguoiBaoCao)}</span></td>
                                    <td>{toText(report.LoaiDoiTuong) || '-'}</td>
                                    <td><span className="admin-code-chip">{formatCode('DT', report.MaDoiTuong)}</span></td>
                                    <td>{shortText(report.LyDo, 70)}</td>
                                    <td className="admin-report-detail-cell">{shortText(report.ChiTiet, 150)}</td>
                                    <td>
                                        <span className={`admin-report-status ${normalizeStatusClass(report.TrangThai)}`}>
                                            {toText(report.TrangThai) || 'Chưa xử lý'}
                                        </span>
                                    </td>
                                    <td>{formatDateTime(report.NgayBaoCao)}</td>
                                    <td>
                                        <div className="admin-report-row-actions">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary admin-icon-action-btn"
                                                title="Phê duyệt"
                                                aria-label="Phê duyệt"
                                                onClick={() => openApproveModal(report)}
                                                disabled={processing || deletingId === report.MaBaoCao}
                                            >
                                                <CheckCircle2 size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger admin-icon-action-btn"
                                                title="Xóa báo cáo"
                                                aria-label="Xóa báo cáo"
                                                onClick={() => confirmDeleteReport(report)}
                                                disabled={processing || deletingId === report.MaBaoCao}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {reports.length === 0 && !loading && (
                                <tr><td colSpan={9} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {activeReport ? (
                <div className="admin-confirm-backdrop" role="dialog" aria-modal="true">
                    <div className="admin-report-modal card border-0 shadow-sm">
                        <div className="admin-report-modal-header">
                            <h5 className="mb-0">Phê duyệt báo cáo #{activeReport.MaBaoCao}</h5>
                            <button
                                type="button"
                                className="admin-users-close-btn"
                                onClick={closeApproveModal}
                                aria-label="Đóng"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="card-body">
                            <div className="admin-report-detail-grid">
                                <div className="admin-report-detail-item">
                                    <span>Mã người báo cáo</span>
                                    <strong>{formatCode('NB', activeReport.MaNguoiBaoCao)}</strong>
                                </div>
                                <div className="admin-report-detail-item">
                                    <span>Email người báo cáo</span>
                                    <strong>{toText(activeReport.EmailNguoiBaoCao) || '-'}</strong>
                                </div>
                                <div className="admin-report-detail-item">
                                    <span>Loại đối tượng</span>
                                    <strong>{toText(activeReport.LoaiDoiTuong) || '-'}</strong>
                                </div>
                                <div className="admin-report-detail-item">
                                    <span>Mã đối tượng</span>
                                    <strong>{formatCode('DT', activeReport.MaDoiTuong)}</strong>
                                </div>
                                <div className="admin-report-detail-item">
                                    <span>Lý do</span>
                                    <strong>{toText(activeReport.LyDo) || '-'}</strong>
                                </div>
                                <div className="admin-report-detail-item">
                                    <span>Ngày báo cáo</span>
                                    <strong>{formatDateTime(activeReport.NgayBaoCao)}</strong>
                                </div>
                            </div>

                            <div className="admin-report-content-box mt-3">
                                <span>Chi tiết báo cáo</span>
                                <p>{toText(activeReport.ChiTiet) || 'Không có mô tả chi tiết.'}</p>
                            </div>

                            <div className="admin-report-toggle-grid mt-3">
                                <label className={`admin-report-toggle ${hideContent ? 'active' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={hideContent}
                                        onChange={(event) => setHideContent(event.target.checked)}
                                        disabled={processing}
                                    />
                                    <EyeOff size={15} />
                                    <span>Ẩn nội dung đối tượng</span>
                                </label>

                                <label className={`admin-report-toggle ${lockEntity ? 'active' : ''}`}>
                                    <input
                                        type="checkbox"
                                        checked={lockEntity}
                                        onChange={(event) => setLockEntity(event.target.checked)}
                                        disabled={processing}
                                    />
                                    <Lock size={15} />
                                    <span>Khóa đối tượng</span>
                                </label>
                            </div>

                            {modalError ? <div className="alert alert-danger mt-3 mb-0">{modalError}</div> : null}

                            <div className="d-flex justify-content-end gap-2 mt-4">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={closeApproveModal}
                                    disabled={processing}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={submitApproveReport}
                                    disabled={processing}
                                >
                                    {processing ? 'Đang xử lý...' : 'Phê duyệt'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
};

export default AdminReportsPage;
