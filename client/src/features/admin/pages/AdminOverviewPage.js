import React from 'react';
import { ChevronRight, FileStack } from 'lucide-react';

const AdminOverviewPage = ({ statsCards, recentTemplateActivities, popularTemplates }) => {
    return (
        <>
            <section className="admin-hero-banner">
                <p className="admin-hero-chip">Admin Dashboard</p>
                <h1>Chào mừng trở lại, Admin</h1>
                <p>Tổng quan hoạt động hệ thống của bạn</p>
            </section>

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
