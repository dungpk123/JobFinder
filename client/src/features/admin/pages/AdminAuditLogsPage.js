import React, { useEffect, useState } from 'react';
import { Download, History, Trash2 } from 'lucide-react';
import SmartPagination from '../../../components/SmartPagination';

const PAGE_LIMIT = 30;
const EXPORT_BATCH_LIMIT = 200;
const JOBFINDER_LOGO_PATH = '/images/logo.png';
const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const buildExportFileToken = (date = new Date()) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
        if (typeof reader.result === 'string') {
            resolve(reader.result);
            return;
        }
        reject(new Error('Không thể chuyển logo sang định dạng base64.'));
    };
    reader.onerror = () => reject(reader.error || new Error('Không thể đọc logo JobFinder.'));
    reader.readAsDataURL(blob);
});

const loadJobFinderLogoAsset = async () => {
    try {
        const response = await fetch(JOBFINDER_LOGO_PATH, { cache: 'no-cache' });
        if (!response.ok) return null;

        const blob = await response.blob();
        const mimeType = String(blob.type || '').toLowerCase();
        const extension = mimeType.includes('png') ? 'png' : 'jpeg';
        const dataUrl = await blobToDataUrl(blob);
        return { extension, dataUrl };
    } catch {
        return null;
    }
};

const downloadBlobFile = (blob, fileName) => {
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
};

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

    if (row?.user_id != null) return `Người dùng #${row.user_id}`;
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
    const [exporting, setExporting] = useState(false);

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

    const fetchAllLogsForExport = async () => {
        const allLogs = [];
        let nextOffset = 0;
        let totalRows = null;

        while (true) {
            const query = new URLSearchParams();
            query.set('limit', String(EXPORT_BATCH_LIMIT));
            query.set('offset', String(Math.max(0, nextOffset)));

            const response = await fetch(`${API_BASE}/api/admin/audit-logs?${query.toString()}`, {
                headers: authHeaders
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data?.success) {
                throw new Error(data?.error || 'Không thể tải dữ liệu để xuất Excel.');
            }

            const rows = Array.isArray(data.logs) ? data.logs : [];
            const serverTotal = Number(data?.pagination?.total);
            if (Number.isFinite(serverTotal) && serverTotal >= 0) {
                totalRows = serverTotal;
            }

            allLogs.push(...rows);
            nextOffset += rows.length;

            const reachedEndByRows = rows.length === 0 || rows.length < EXPORT_BATCH_LIMIT;
            const reachedEndByTotal = Number.isFinite(totalRows) ? nextOffset >= totalRows : false;

            if (reachedEndByRows || reachedEndByTotal) {
                break;
            }
        }

        return allLogs;
    };

    const handleExportExcel = async () => {
        if (exporting) return;

        setExporting(true);
        setError('');

        try {
            const exportRows = await fetchAllLogsForExport();
            if (!exportRows.length) {
                throw new Error('Chưa có dữ liệu nhật ký quản trị để xuất Excel.');
            }

            const excelModule = await import('exceljs/dist/exceljs.min.js');
            const ExcelJS = excelModule?.default || excelModule;
            const workbook = new ExcelJS.Workbook();

            workbook.creator = 'JobFinder';
            workbook.lastModifiedBy = 'JobFinder Admin';
            workbook.created = new Date();
            workbook.modified = new Date();

            const sheet = workbook.addWorksheet('Nhật ký quản trị');
            sheet.views = [{ state: 'frozen', ySplit: 5 }];
            sheet.properties.defaultRowHeight = 22;
            sheet.columns = [
                { width: 8 },
                { width: 10 },
                { width: 26 },
                { width: 32 },
                { width: 34 },
                { width: 24 },
                { width: 22 }
            ];

            const logoAsset = await loadJobFinderLogoAsset();
            if (logoAsset) {
                const imageId = workbook.addImage({
                    base64: logoAsset.dataUrl,
                    extension: logoAsset.extension
                });
                sheet.addImage(imageId, {
                    tl: { col: 0, row: 0 },
                    ext: { width: 64, height: 64 }
                });
            } else {
                const fallbackCell = sheet.getCell('A1');
                fallbackCell.value = 'JobFinder';
                fallbackCell.font = { bold: true, color: { argb: 'FF1D4ED8' }, size: 12 };
            }

            sheet.mergeCells('B1:G1');
            sheet.mergeCells('B2:G2');
            sheet.mergeCells('B3:G3');

            const titleCell = sheet.getCell('B1');
            titleCell.value = 'JOBFINDER - NHẬT KÝ QUẢN TRỊ';
            titleCell.font = { bold: true, size: 16, color: { argb: 'FF0F172A' } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

            const subtitleCell = sheet.getCell('B2');
            subtitleCell.value = `Ngày xuất: ${new Date().toLocaleString('vi-VN')}`;
            subtitleCell.font = { size: 11, color: { argb: 'FF334155' } };
            subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

            const noteCell = sheet.getCell('B3');
            noteCell.value = `Tổng bản ghi: ${exportRows.length.toLocaleString('vi-VN')} | Nguồn dữ liệu: JobFinder Admin`;
            noteCell.font = { italic: true, size: 10, color: { argb: 'FF475569' } };
            noteCell.alignment = { vertical: 'middle', horizontal: 'left' };

            const headerRowIndex = 5;
            const headerRow = sheet.getRow(headerRowIndex);
            headerRow.values = ['STT', 'ID', 'Người thực hiện', 'Email', 'Nội dung hành động', 'Đối tượng', 'Thời gian'];
            headerRow.height = 26;

            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1E3A8A' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
            });

            exportRows.forEach((row, index) => {
                const excelRow = sheet.addRow([
                    index + 1,
                    row?.id ?? '-',
                    formatUserLabel(row),
                    row?.user_email || '-',
                    String(row?.action || '-'),
                    formatObjectRef(row),
                    formatDateTime(row?.timestamp)
                ]);

                excelRow.eachCell((cell, colNumber) => {
                    const isCenterColumn = colNumber === 1 || colNumber === 2 || colNumber === 7;
                    cell.alignment = {
                        vertical: 'middle',
                        horizontal: isCenterColumn ? 'center' : 'left',
                        wrapText: true
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                    };
                });
            });

            sheet.autoFilter = `A${headerRowIndex}:G${headerRowIndex}`;

            const footerRowIndex = sheet.lastRow.number + 2;
            sheet.mergeCells(`A${footerRowIndex}:G${footerRowIndex}`);
            const footerCell = sheet.getCell(`A${footerRowIndex}`);
            footerCell.value = 'Báo cáo được xuất từ hệ thống JobFinder. Vui lòng không chỉnh sửa dữ liệu gốc khi đối soát.';
            footerCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
            footerCell.alignment = { vertical: 'middle', horizontal: 'left' };

            const fileName = `jobfinder-audit-logs-${buildExportFileToken(new Date())}.xlsx`;
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE });
            downloadBlobFile(blob, fileName);
        } catch (err) {
            setError(err?.message || 'Không thể xuất file Excel nhật ký quản trị.');
        } finally {
            setExporting(false);
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
            <div className="card-header bg-white border-0 py-3 admin-audit-toolbar">
                <h5 className="mb-0 d-flex align-items-center gap-2">
                    <History size={18} />
                    <span>Nhật ký quản trị</span>
                </h5>
                <button
                    type="button"
                    className="btn btn-success btn-sm d-inline-flex align-items-center gap-1"
                    onClick={handleExportExcel}
                    disabled={loading || exporting}
                >
                    <Download size={14} />
                    <span>{exporting ? 'Đang xuất...' : 'Tải Excel'}</span>
                </button>
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
