import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';

const AdminReportRow = ({ report, onSave }) => {
    const [status, setStatus] = useState(report.TrangThai || 'Chưa xử lý');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const dirty = status !== (report.TrangThai || 'Chưa xử lý');

    const save = async () => {
        setSaving(true);
        setErr('');
        try {
            await onSave({ status });
        } catch (e) {
            setErr(e?.message || 'Lỗi');
        } finally {
            setSaving(false);
        }
    };

    return (
        <tr>
            <td>{report.MaBaoCao}</td>
            <td>{report.EmailNguoiBaoCao || report.MaNguoiBaoCao || '-'}</td>
            <td>{report.LoaiDoiTuong} #{report.MaDoiTuong}</td>
            <td>
                <div className="fw-semibold">{report.LyDo || '-'}</div>
                {report.ChiTiet ? <div className="text-muted small">{String(report.ChiTiet).slice(0, 120)}{String(report.ChiTiet).length > 120 ? '...' : ''}</div> : null}
            </td>
            <td>
                <select className="form-select form-select-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="Chưa xử lý">Chưa xử lý</option>
                    <option value="Đang xử lý">Đang xử lý</option>
                    <option value="Đã xử lý">Đã xử lý</option>
                    <option value="Từ chối">Từ chối</option>
                </select>
            </td>
            <td>
                <button className="btn btn-sm btn-primary" disabled={!dirty || saving} onClick={save}>
                    Lưu
                </button>
                {err ? <div className="text-danger small mt-1">{err}</div> : null}
            </td>
        </tr>
    );
};

const AdminReportsPage = ({ reports, loading, onSaveReport }) => {
    return (
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
                            <th style={{ width: 90 }}>Mã</th>
                            <th style={{ width: 220 }}>Người báo cáo</th>
                            <th style={{ width: 170 }}>Đối tượng</th>
                            <th>Lý do</th>
                            <th style={{ width: 210 }}>Trạng thái</th>
                            <th style={{ width: 120 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map((r) => (
                            <AdminReportRow
                                key={r.MaBaoCao}
                                report={r}
                                onSave={(payload) => onSaveReport(r.MaBaoCao, payload)}
                            />
                        ))}
                        {reports.length === 0 && !loading && (
                            <tr><td colSpan={6} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminReportsPage;
