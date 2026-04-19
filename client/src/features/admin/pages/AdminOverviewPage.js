import React, { useState } from 'react';
import { ChevronRight, Download, FileStack } from 'lucide-react';

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const buildFileToken = (date = new Date()) => {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
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

const styleSheetHeader = (row) => {
    row.eachCell((cell) => {
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
};

const AdminOverviewPage = ({ currentAdminName, statsCards, recentTemplateActivities, popularTemplates }) => {
    const [exporting, setExporting] = useState(false);
    const [exportError, setExportError] = useState('');

    const handleExportDashboardExcel = async () => {
        if (exporting) return;

        setExporting(true);
        setExportError('');

        try {
            const excelModule = await import('exceljs/dist/exceljs.min.js');
            const ExcelJS = excelModule?.default || excelModule;
            const workbook = new ExcelJS.Workbook();

            workbook.creator = 'JobFinder';
            workbook.lastModifiedBy = 'JobFinder Admin';
            workbook.created = new Date();
            workbook.modified = new Date();

            const summarySheet = workbook.addWorksheet('Tổng quan dashboard');
            summarySheet.columns = [
                { width: 34 },
                { width: 18 },
                { width: 52 }
            ];

            summarySheet.mergeCells('A1:C1');
            summarySheet.getCell('A1').value = 'JOBFINDER - BÁO CÁO DASHBOARD ADMIN';
            summarySheet.getCell('A1').font = { bold: true, size: 15, color: { argb: 'FF0F172A' } };
            summarySheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };

            summarySheet.addRow(['Quản trị viên', currentAdminName || 'Admin', '']);
            summarySheet.addRow(['Ngày xuất', new Date().toLocaleString('vi-VN'), '']);
            summarySheet.addRow([]);

            const summaryHeader = summarySheet.addRow(['Chỉ số', 'Giá trị', 'Ghi chú']);
            styleSheetHeader(summaryHeader);

            (statsCards || []).forEach((card) => {
                const valueNumber = Number(card?.value);
                summarySheet.addRow([
                    String(card?.title || '-'),
                    Number.isFinite(valueNumber) ? valueNumber : String(card?.value || 0),
                    String(card?.meta || '-')
                ]);
            });

            if ((statsCards || []).length === 0) {
                summarySheet.addRow(['Không có dữ liệu thống kê', '-', '-']);
            }

            const recentSheet = workbook.addWorksheet('Hoạt động gần đây');
            recentSheet.columns = [
                { width: 8 },
                { width: 34 },
                { width: 28 },
                { width: 24 }
            ];
            const recentHeader = recentSheet.addRow(['STT', 'Tên template', 'Thời gian', 'Mốc tương đối']);
            styleSheetHeader(recentHeader);

            if ((recentTemplateActivities || []).length > 0) {
                recentTemplateActivities.forEach((item, index) => {
                    recentSheet.addRow([
                        index + 1,
                        String(item?.name || '-'),
                        String(item?.exactTime || '-'),
                        String(item?.relativeTime || '-')
                    ]);
                });
            } else {
                recentSheet.addRow([1, 'Chưa có hoạt động', '-', '-']);
            }

            const popularSheet = workbook.addWorksheet('Template phổ biến');
            popularSheet.columns = [
                { width: 8 },
                { width: 34 },
                { width: 16 },
                { width: 16 }
            ];
            const popularHeader = popularSheet.addRow(['STT', 'Tên template', 'Lượt sử dụng', 'Tỉ lệ (%)']);
            styleSheetHeader(popularHeader);

            if ((popularTemplates || []).length > 0) {
                popularTemplates.forEach((item, index) => {
                    popularSheet.addRow([
                        index + 1,
                        String(item?.name || '-'),
                        Number(item?.usage || 0),
                        Number(item?.progress || 0)
                    ]);
                });
            } else {
                popularSheet.addRow([1, 'Chưa có dữ liệu', 0, 0]);
            }

            const fileName = `jobfinder-dashboard-${buildFileToken(new Date())}.xlsx`;
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE });
            downloadBlobFile(blob, fileName);
        } catch (error) {
            setExportError(error?.message || 'Không thể xuất file Excel Dashboard.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <>
            <section className="admin-hero-banner">
                <div className="admin-hero-banner-head">
                    <p className="admin-hero-chip">Admin Dashboard</p>
                    <button
                        type="button"
                        className="btn btn-light btn-sm admin-hero-export-btn"
                        onClick={handleExportDashboardExcel}
                        disabled={exporting}
                    >
                        <Download size={14} />
                        <span>{exporting ? 'Đang xuất...' : 'Tải Excel'}</span>
                    </button>
                </div>
                <h1>Chào mừng trở lại, Admin</h1>
                <p>Tổng quan hoạt động hệ thống của bạn</p>
            </section>

            {exportError ? <div className="alert alert-danger admin-feedback mb-0">{exportError}</div> : null}

            <section className="admin-stats-grid">
                {statsCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <article key={card.key} className="admin-stat-card">
                            <div className={`admin-stat-icon ${card.iconClass}`}>
                                <Icon size={18} />
                            </div>
                            <div className="admin-stat-content">
                                <div className="admin-stat-title">{card.title}</div>
                                <div className="admin-stat-value">{card.value.toLocaleString('vi-VN')}</div>
                                <div className="admin-stat-meta">{card.meta}</div>
                            </div>
                        </article>
                    );
                })}
            </section>

            <section className="admin-panels-grid">
                <article className="admin-panel-card">
                    <div className="admin-panel-head">
                        <h3>Hoạt động gần đây</h3>
                        <span>Template mới tạo</span>
                    </div>

                    {recentTemplateActivities.length > 0 ? (
                        <div className="admin-activity-list">
                            {recentTemplateActivities.map((item) => (
                                <div key={item.id} className="admin-activity-item">
                                    <div className="admin-activity-icon">
                                        <FileStack size={15} />
                                    </div>
                                    <div className="admin-activity-content">
                                        <div className="admin-activity-title">{item.name}</div>
                                        <div className="admin-activity-subtitle">{item.exactTime}</div>
                                    </div>
                                    <div className="admin-activity-tail">
                                        <span>{item.relativeTime}</span>
                                        <ChevronRight size={14} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="admin-empty-state">Chưa có template mới tạo.</div>
                    )}
                </article>

                <article className="admin-panel-card">
                    <div className="admin-panel-head">
                        <h3>Template phổ biến</h3>
                        <span>Dựa trên lượt sử dụng</span>
                    </div>

                    {popularTemplates.length > 0 ? (
                        <div className="admin-popular-list">
                            {popularTemplates.map((item) => (
                                <div key={item.id} className="admin-popular-item">
                                    <div className="admin-popular-row">
                                        <span className="admin-popular-name">{item.name}</span>
                                        <span className="admin-popular-usage">{item.usage} lượt</span>
                                    </div>
                                    <div className="admin-progress-track">
                                        <div
                                            className="admin-progress-fill"
                                            style={{ width: `${item.progress}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="admin-empty-state">Chưa có dữ liệu lượt sử dụng template.</div>
                    )}
                </article>
            </section>
        </>
    );
};

export default AdminOverviewPage;
