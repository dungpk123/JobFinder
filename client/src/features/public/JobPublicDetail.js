import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';

const formatCurrency = (value) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return new Intl.NumberFormat('vi-VN').format(num);
};

const RichBlock = ({ html }) => (
    <div
        className="p-3 rounded border bg-light"
        style={{ minHeight: 80 }}
        dangerouslySetInnerHTML={{ __html: html || '<em>Chưa cập nhật</em>' }}
    />
);

const buildMapUrl = (query) => {
    if (!query) return '';
    const key = process.env.REACT_APP_MAPS_EMBED_KEY;
    const encoded = encodeURIComponent(query);
    if (key) return `https://www.google.com/maps/embed/v1/place?key=${key}&q=${encoded}`;
    // Fallback to public maps embed (no API key required)
    return `https://www.google.com/maps?q=${encoded}&output=embed`;
};

const JobPublicDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = useMemo(() => localStorage.getItem('token') || '', []);
    const { notify } = useNotification();

    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch {
            return null;
        }
    }, []);

    const userId = useMemo(() => {
        const u = user;
        return u?.id || u?.MaNguoiDung || u?.maNguoiDung || u?.userId || u?.userID || null;
    }, [user]);

    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [showApplyModal, setShowApplyModal] = useState(false);
    const [cvs, setCvs] = useState([]);
    const [cvsLoading, setCvsLoading] = useState(false);
    const [selectedCvId, setSelectedCvId] = useState(null);
    const [applySubmitting, setApplySubmitting] = useState(false);

    const [appliedLoading, setAppliedLoading] = useState(false);
    const [isApplied, setIsApplied] = useState(false);

    const [companyInfo, setCompanyInfo] = useState(null);
    const [companyLoading, setCompanyLoading] = useState(false);
    const [companyRating, setCompanyRating] = useState({ avgRating: 0, ratingCount: 0, userRating: null });
    const [ratingSubmitting, setRatingSubmitting] = useState(false);

    const [companyComments, setCompanyComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [commentSubmitting, setCommentSubmitting] = useState(false);

    const [reportReason, setReportReason] = useState('');
    const [reportDetail, setReportDetail] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);

    const isCandidate = user?.role === 'Ứng viên';
    const [candidateAction, setCandidateAction] = useState(null); // 'review' | 'report' | null

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`/jobs/${id}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Không tải được tin tuyển dụng');
                if (!cancelled) setJob(data);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Có lỗi xảy ra.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [id, token]);

    useEffect(() => {
        let cancelled = false;
        const loadAppliedStatus = async () => {
            const jobId = job?.MaTin;
            if (!jobId) return;
            if (!token || !userId) return;
            if (user?.role && user.role !== 'Ứng viên') return;

            setAppliedLoading(true);
            try {
                const res = await fetch(`/applications/status?jobId=${encodeURIComponent(jobId)}` , {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Không kiểm tra được trạng thái ứng tuyển');
                if (cancelled) return;
                setIsApplied(Boolean(data.applied));
            } catch {
                if (!cancelled) setIsApplied(false);
            } finally {
                if (!cancelled) setAppliedLoading(false);
            }
        };
        loadAppliedStatus();
        return () => { cancelled = true; };
    }, [job?.MaTin, token, userId]);

    useEffect(() => {
        let cancelled = false;
        const loadCompany = async () => {
            const employerId = job?.MaNhaTuyenDung;
            if (!employerId) return;
            setCompanyLoading(true);
            try {
                const res = await fetch(`/api/companies/${employerId}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success) throw new Error(data.error || 'Không tải được thông tin công ty');
                if (cancelled) return;
                setCompanyInfo(data.company || null);
                setCompanyRating(data.rating || { avgRating: 0, ratingCount: 0, userRating: null });
            } catch {
                if (!cancelled) {
                    setCompanyInfo(null);
                    setCompanyRating({ avgRating: 0, ratingCount: 0, userRating: null });
                }
            } finally {
                if (!cancelled) setCompanyLoading(false);
            }
        };
        loadCompany();
        return () => {
            cancelled = true;
        };
    }, [job?.MaNhaTuyenDung]);

    useEffect(() => {
        let cancelled = false;
        const loadComments = async () => {
            const employerId = job?.MaNhaTuyenDung;
            if (!employerId) return;
            setCommentsLoading(true);
            try {
                const res = await fetch(`/api/companies/${employerId}/comments`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success) throw new Error(data.error || 'Không tải được bình luận');
                if (cancelled) return;
                setCompanyComments(Array.isArray(data.comments) ? data.comments : []);
            } catch {
                if (!cancelled) setCompanyComments([]);
            } finally {
                if (!cancelled) setCommentsLoading(false);
            }
        };
        loadComments();
        return () => { cancelled = true; };
    }, [job?.MaNhaTuyenDung]);

    const ensureCvsLoaded = async () => {
        if (!userId) return;
        setCvsLoading(true);
        try {
            const res = await fetch(`/api/cvs?userId=${encodeURIComponent(userId)}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Không tải được danh sách CV');
            const list = Array.isArray(data.cvs) ? data.cvs : [];
            setCvs(list);
            const preferred = list.find((x) => x?.isDefault) || list[0];
            setSelectedCvId(preferred?.id ?? null);
        } catch (err) {
            setCvs([]);
            setSelectedCvId(null);
            notify({ type: 'error', message: err.message || 'Không tải được danh sách CV' });
        } finally {
            setCvsLoading(false);
        }
    };

    const onClickApply = async () => {
        if (!token || !userId) {
            notify({ type: 'error', message: 'Bạn phải đăng nhập để ứng tuyển.' });
            navigate('/login');
            return;
        }
        if (user?.role && user.role !== 'Ứng viên') {
            notify({ type: 'error', message: 'Chỉ tài khoản Ứng viên mới có thể ứng tuyển.' });
            return;
        }
        if (appliedLoading) return;
        if (isApplied) {
            notify({ type: 'info', message: 'Bạn đã ứng tuyển công việc này.' });
            return;
        }
        setShowApplyModal(true);
        await ensureCvsLoaded();
    };

    const submitApplication = async () => {
        if (!job?.MaTin) return;
        if (applySubmitting) return;
        if (!selectedCvId) {
            notify({ type: 'error', message: 'Vui lòng chọn CV để ứng tuyển.' });
            return;
        }
        setApplySubmitting(true);
        try {
            const res = await fetch('/applications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ jobId: job.MaTin, cvId: selectedCvId })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 409 && data?.applied) {
                    setIsApplied(true);
                    setShowApplyModal(false);
                    notify({ type: 'info', message: data.error || 'Bạn đã ứng tuyển công việc này.' });
                    return;
                }
                throw new Error(data.error || 'Ứng tuyển thất bại');
            }

            notify({ type: 'success', message: data.message || 'Nộp hồ sơ thành công' });
            setIsApplied(true);
            setShowApplyModal(false);
        } catch (err) {
            notify({ type: 'error', message: err.message || 'Ứng tuyển thất bại' });
        } finally {
            setApplySubmitting(false);
        }
    };

    const submitComment = async () => {
        const employerId = job?.MaNhaTuyenDung;
        if (!employerId) return;
        if (!token || !userId) {
            notify({ type: 'error', message: 'Bạn phải đăng nhập để bình luận.' });
            navigate('/login');
            return;
        }
        if (user?.role && user.role !== 'Ứng viên') {
            notify({ type: 'error', message: 'Chỉ tài khoản Ứng viên mới có thể bình luận.' });
            return;
        }
        const content = String(commentText || '').trim();
        if (!content) {
            notify({ type: 'error', message: 'Vui lòng nhập nội dung bình luận.' });
            return;
        }
        if (commentSubmitting) return;
        setCommentSubmitting(true);
        try {
            const res = await fetch(`/api/companies/${employerId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ content })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Không thể gửi bình luận');
            setCompanyComments(Array.isArray(data.comments) ? data.comments : []);
            setCommentText('');
            notify({ type: 'success', message: 'Đã gửi bình luận.' });
        } catch (err) {
            notify({ type: 'error', message: err.message || 'Không thể gửi bình luận' });
        } finally {
            setCommentSubmitting(false);
        }
    };

    const submitRating = async (stars) => {
        const employerId = job?.MaNhaTuyenDung;
        if (!employerId) return;
        if (!token || !userId) {
            notify({ type: 'error', message: 'Bạn phải đăng nhập để đánh giá công ty.' });
            navigate('/login');
            return;
        }
        if (ratingSubmitting) return;
        setRatingSubmitting(true);
        try {
            const res = await fetch(`/api/companies/${employerId}/ratings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ stars })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Không thể gửi đánh giá');
            setCompanyRating(data.rating || { avgRating: 0, ratingCount: 0, userRating: stars });
            notify({ type: 'success', message: 'Đã ghi nhận đánh giá của bạn.' });
        } catch (err) {
            notify({ type: 'error', message: err.message || 'Không thể gửi đánh giá' });
        } finally {
            setRatingSubmitting(false);
        }
    };

    const submitReport = async () => {
        const employerId = job?.MaNhaTuyenDung;
        if (!employerId) return;
        if (!token || !userId) {
            notify({ type: 'error', message: 'Bạn phải đăng nhập để báo cáo.' });
            navigate('/login');
            return;
        }
        if (user?.role && user.role !== 'Ứng viên') {
            notify({ type: 'error', message: 'Chỉ tài khoản Ứng viên mới có thể báo cáo công ty.' });
            return;
        }

        const reason = String(reportReason || '').trim();
        const detail = String(reportDetail || '').trim();
        if (!reason) {
            notify({ type: 'error', message: 'Vui lòng chọn lý do báo cáo.' });
            return;
        }
        if (reportSubmitting) return;
        setReportSubmitting(true);
        try {
            const res = await fetch(`/api/companies/${employerId}/reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ reason, detail })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) throw new Error(data.error || 'Không thể gửi báo cáo');
            notify({ type: 'success', message: data.message || 'Đã gửi báo cáo.' });
            setReportDetail('');
            setReportReason('');
        } catch (err) {
            notify({ type: 'error', message: err.message || 'Không thể gửi báo cáo' });
        } finally {
            setReportSubmitting(false);
        }
    };

    const renderStars = (value, { interactive = false, onSelect } = {}) => {
        const v = Math.max(0, Math.min(5, Number(value) || 0));
        const rounded = interactive ? Math.round(v) : Math.round(v);
        return (
            <div className="d-inline-flex align-items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => {
                    const filled = s <= rounded;
                    const cls = filled ? 'bi bi-star-fill text-warning' : 'bi bi-star text-secondary';
                    if (!interactive) {
                        return <i key={s} className={cls} />;
                    }
                    return (
                        <button
                            key={s}
                            type="button"
                            className="btn btn-link p-0"
                            style={{ lineHeight: 1 }}
                            disabled={ratingSubmitting}
                            onClick={() => onSelect?.(s)}
                            aria-label={`${s} sao`}
                            title={`${s} sao`}
                        >
                            <i className={cls} />
                        </button>
                    );
                })}
            </div>
        );
    };

    const salaryText = (() => {
        if (!job) return '';
        const type = job.KieuLuong || 'Thỏa thuận';
        if (type === 'Thỏa thuận' || (job.LuongTu == null && job.LuongDen == null)) return 'Thỏa thuận';
        const from = formatCurrency(job.LuongTu);
        const to = formatCurrency(job.LuongDen);
        const unit = String(type).toLowerCase();
        if (from && to) return `${from} - ${to} VND/${unit}`;
        if (from) return `Từ ${from} VND/${unit}`;
        if (to) return `Đến ${to} VND/${unit}`;
        return 'Thỏa thuận';
    })();

    const fallbackAddress = '285 Cách Mạng Tháng Tám, Quận 10, TP Hồ Chí Minh';
    const displayAddress = [job?.DiaDiem, job?.ThanhPho].filter(Boolean).join(', ') || fallbackAddress;

    return (
        <div className="job-detail-page">
            <div className="job-detail-hero">
                <div className="job-detail-hero__content container">
                    <div className="d-flex gap-3 align-items-center flex-wrap">
                        <div className="job-detail-logo">
                            <img
                                src={job?.Logo || '/images/logo.png'}
                                alt={job?.TenCongTy || 'Logo'}
                                onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = '/images/logo.png';
                                }}
                            />
                        </div>
                        <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <span className="badge rounded-pill bg-success-subtle text-success fw-semibold">Tuyển dụng</span>
                                {job?.TrangThai && (
                                    <span className={`badge rounded-pill ${job.TrangThai === 'Đã đăng' ? 'bg-success' : 'bg-secondary'}`}>{job.TrangThai}</span>
                                )}
                            </div>
                            <h2 className="fw-bold mt-2 mb-1 job-detail-title">{job?.TieuDe || 'Chi tiết việc làm'}</h2>
                            <div className="text-muted fw-semibold d-flex gap-3 flex-wrap">
                                <span><i className="bi bi-building me-1"></i>{job?.TenCongTy || 'Nhà tuyển dụng'}</span>
                                <span><i className="bi bi-geo-alt me-1"></i>{displayAddress}</span>
                            </div>
                            <div className="d-flex gap-2 flex-wrap mt-3">
                                <span className="pill pill-strong"><i className="bi bi-cash-coin me-1"></i>{salaryText || 'Thỏa thuận'}</span>
                                <span className="pill"><i className="bi bi-briefcase me-1"></i>{job?.HinhThuc || 'Chưa cập nhật'}</span>
                                <span className="pill"><i className="bi bi-clock me-1"></i>Hạn nộp: {job?.HanNopHoSo || 'Chưa cập nhật'}</span>
                            </div>
                        </div>
                        <div className="d-flex flex-column gap-2">
                            <button
                                className={`btn px-4 ${isApplied ? 'btn-success' : 'btn-danger'}`}
                                onClick={onClickApply}
                                disabled={appliedLoading || isApplied}
                            >
                                {appliedLoading ? 'Đang kiểm tra...' : (isApplied ? 'Đã ứng tuyển' : 'Ứng tuyển ngay')}
                            </button>
                            <button className="btn btn-outline-secondary px-4" onClick={() => navigate(-1)}>Quay lại</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container job-detail-body">
                {error && <div className="alert alert-danger">{error}</div>}
                {loading && <p className="text-muted">Đang tải...</p>}

                {!loading && job && (
                    <div className="row g-4">
                        <div className="col-lg-8">
                            <section className="card border-0 shadow-sm mb-4">
                                <div className="card-body">
                                    <h5 className="fw-bold mb-3">Giới thiệu công việc</h5>
                                    <RichBlock html={job.MoTa} />

                                    <h5 className="fw-bold mt-4 mb-3">Yêu cầu công việc</h5>
                                    <RichBlock html={job.YeuCau} />

                                    <h5 className="fw-bold mt-4 mb-3">Quyền lợi</h5>
                                    <RichBlock html={job.QuyenLoi} />
                                </div>
                            </section>

                            <section className="card border-0 shadow-sm mb-4">
                                <div className="card-body">
                                    <h5 className="fw-bold mb-3">Địa điểm làm việc</h5>
                                    <div className="row g-3">
                                        <div className="col-12 col-md-4">
                                            <div className="small text-muted">Địa chỉ</div>
                                            <div className="fw-semibold">{displayAddress}</div>
                                        </div>
                                        <div className="col-12 col-md-8">
                                            {(() => {
                                                const mapSrc = buildMapUrl(displayAddress);
                                                if (!mapSrc) return <div className="text-muted small">Địa chỉ trống.</div>;
                                                return (
                                                    <div className="map-embed-wrapper">
                                                        <iframe
                                                            title="Bản đồ"
                                                            src={mapSrc}
                                                            width="100%"
                                                            height="380"
                                                            style={{ border: 0, borderRadius: 12 }}
                                                            allowFullScreen=""
                                                            loading="lazy"
                                                            referrerPolicy="no-referrer-when-downgrade"
                                                        />
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <div className="col-lg-4">
                            <section className="card border-0 shadow-sm mb-3">
                                <div className="card-body">
                                    <h5 className="fw-bold mb-3">Thông tin chung</h5>
                                    <ul className="list-unstyled mb-0 small text-muted">
                                        <li className="mb-2"><i className="bi bi-cash-coin me-2"></i>{salaryText}</li>
                                        <li className="mb-2"><i className="bi bi-geo-alt me-2"></i>{displayAddress}</li>
                                        <li className="mb-2"><i className="bi bi-briefcase me-2"></i>{job.HinhThuc || 'Chưa cập nhật'}</li>
                                        <li className="mb-2"><i className="bi bi-clock me-2"></i>Hạn nộp: {job.HanNopHoSo || 'Chưa cập nhật'}</li>
                                        <li className="mb-2"><i className="bi bi-building me-2"></i>{job.TenCongTy || 'Nhà tuyển dụng'}</li>
                                    </ul>
                                </div>
                            </section>

                            <section className="card border-0 shadow-sm">
                                <div className="card-body d-flex gap-3 align-items-center">
                                    <img
                                        src={(companyInfo?.Logo || job.Logo) || '/images/logo.png'}
                                        alt={(companyInfo?.TenCongTy || job.TenCongTy) || 'Logo'}
                                        style={{ width: 86, height: 86, objectFit: 'cover', borderRadius: 18, border: '1px solid #e5e7eb' }}
                                        onError={(e) => {
                                            e.currentTarget.onerror = null;
                                            e.currentTarget.src = '/images/logo.png';
                                        }}
                                    />
                                    <div>
                                        <div className="fw-semibold">{companyInfo?.TenCongTy || job.TenCongTy || 'Nhà tuyển dụng'}</div>
                                        <div className="text-muted small">{companyInfo?.ThanhPho || job.ThanhPho || 'Địa điểm đang cập nhật'}</div>

                                        <div className="mt-2 d-flex align-items-center gap-2 flex-wrap">
                                            {renderStars(companyRating.avgRating)}
                                            <span className="small text-muted">{companyRating.avgRating || 0}/5 ({companyRating.ratingCount || 0})</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="card-body pt-0">
                                    <div className="small text-muted">Thông tin công ty</div>
                                    {companyLoading && <div className="small text-muted mt-1">Đang tải thông tin công ty...</div>}
                                    {!companyLoading && (
                                        <>
                                            {(companyInfo?.Website || '').trim() && (
                                                <div className="small mt-2">
                                                    <i className="bi bi-globe2 me-2" />
                                                    <a href={companyInfo.Website} target="_blank" rel="noreferrer">{companyInfo.Website}</a>
                                                </div>
                                            )}
                                            {((companyInfo?.DiaChi || companyInfo?.ThanhPho) ? (
                                                <div className="small mt-2">
                                                    <i className="bi bi-geo-alt me-2" />
                                                    {[companyInfo?.DiaChi, companyInfo?.ThanhPho].filter(Boolean).join(', ')}
                                                </div>
                                            ) : null)}
                                            {(companyInfo?.MoTa || '').trim() && (
                                                <div className="small mt-2 text-muted" style={{ lineHeight: 1.5 }}>
                                                    {companyInfo.MoTa}
                                                </div>
                                            )}

                                            {isCandidate && (
                                                <div className="mt-3">
                                                    <div className="d-flex justify-content-center gap-2 flex-wrap">
                                                        <button
                                                            type="button"
                                                            className={`btn btn-sm ${candidateAction === 'review' ? 'btn-primary' : 'btn-outline-primary'}`}
                                                            onClick={() => setCandidateAction('review')}
                                                        >
                                                            Viết đánh giá
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={`btn btn-sm ${candidateAction === 'report' ? 'btn-danger' : 'btn-outline-danger'}`}
                                                            onClick={() => setCandidateAction('report')}
                                                        >
                                                            Báo cáo
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {isCandidate && candidateAction === 'review' && (
                                                <div className="mt-3">
                                                    <div className="small text-muted mb-1">Đánh giá công ty (1-5 sao)</div>
                                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                                        {renderStars(companyRating.userRating || 0, {
                                                            interactive: true,
                                                            onSelect: submitRating
                                                        })}
                                                        <span className="small text-muted">
                                                            {companyRating.userRating ? `Bạn đã đánh giá: ${companyRating.userRating}/5` : 'Bạn chưa đánh giá'}
                                                        </span>
                                                    </div>

                                                    <div className="mt-3">
                                                        <div className="fw-semibold">Bình luận</div>

                                                        {commentsLoading && (
                                                            <div className="small text-muted mt-2">Đang tải bình luận...</div>
                                                        )}

                                                        {!commentsLoading && companyComments.length === 0 && (
                                                            <div className="small text-muted mt-2">Chưa có bình luận nào.</div>
                                                        )}

                                                        {!commentsLoading && companyComments.length > 0 && (
                                                            <div className="mt-2 d-flex flex-column gap-2">
                                                                {companyComments.map((c) => (
                                                                    <div key={c.id} className="border rounded p-2">
                                                                        <div className="d-flex align-items-center justify-content-between gap-2">
                                                                            <div className="fw-semibold small">
                                                                                {c.userName || 'Người dùng'}
                                                                            </div>
                                                                            <div className="text-muted small">
                                                                                {c.createdAt ? new Date(c.createdAt).toLocaleString('vi-VN') : ''}
                                                                            </div>
                                                                        </div>
                                                                        <div className="small text-muted" style={{ whiteSpace: 'pre-wrap' }}>{c.content}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        <div className="mt-3">
                                                            <textarea
                                                                className="form-control"
                                                                rows={3}
                                                                placeholder="Viết bình luận của bạn..."
                                                                value={commentText}
                                                                onChange={(e) => setCommentText(e.target.value)}
                                                                disabled={commentSubmitting}
                                                            />
                                                            <div className="d-flex justify-content-end mt-2">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-primary btn-sm"
                                                                    onClick={submitComment}
                                                                    disabled={commentSubmitting}
                                                                >
                                                                    {commentSubmitting ? 'Đang gửi...' : 'Gửi bình luận'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {isCandidate && candidateAction === 'report' && (
                                                <div className="mt-3 mb-3">
                                                    <div className="fw-semibold">Báo cáo công ty</div>
                                                    <select
                                                        className="form-select form-select-sm mb-2"
                                                        value={reportReason}
                                                        onChange={(e) => setReportReason(e.target.value)}
                                                        disabled={reportSubmitting}
                                                    >
                                                        <option value="">-- Chọn lý do --</option>
                                                        <option value="Nội dung lừa đảo">Nội dung lừa đảo</option>
                                                        <option value="Vi phạm pháp luật">Vi phạm pháp luật</option>
                                                        <option value="Thông tin sai sự thật">Thông tin sai sự thật</option>
                                                        <option value="Ứng xử không chuyên nghiệp">Ứng xử không chuyên nghiệp</option>
                                                        <option value="Khác">Khác</option>
                                                    </select>
                                                    <textarea
                                                        className="form-control"
                                                        rows={3}
                                                        placeholder="Mô tả chi tiết (không bắt buộc)"
                                                        value={reportDetail}
                                                        onChange={(e) => setReportDetail(e.target.value)}
                                                        disabled={reportSubmitting}
                                                    />
                                                    <div className="d-flex justify-content-end mt-2">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger btn-sm"
                                                            onClick={submitReport}
                                                            disabled={reportSubmitting}
                                                        >
                                                            {reportSubmitting ? 'Đang gửi...' : 'Gửi báo cáo'}
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {isCandidate ? null : (
                                                <div className="mt-3 small text-muted">
                                                    Chỉ tài khoản Ứng viên mới có thể đánh giá/báo cáo.
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </section>
                        </div>
                    </div>
                )}
            </div>

            {showApplyModal && (
                <>
                    <div className="modal-overlay" onClick={() => !applySubmitting && setShowApplyModal(false)} />
                    <div className="modal-dialog-custom">
                        <button
                            type="button"
                            className="btn-close modal-close"
                            aria-label="Đóng"
                            onClick={() => !applySubmitting && setShowApplyModal(false)}
                        />
                        <h5 className="modal-title text-center">Chọn CV để ứng tuyển</h5>

                        <div className="modal-body pt-0">
                            {cvsLoading && <div className="text-muted">Đang tải danh sách CV...</div>}

                            {!cvsLoading && cvs.length === 0 && (
                                <div className="alert alert-warning mb-3 text-center">
                                    Bạn chưa có CV để ứng tuyển.
                                    <div className="mt-3 d-flex justify-content-center">
                                        <button className="btn btn-primary btn-sm" onClick={() => { setShowApplyModal(false); navigate('/create-cv'); }}>
                                            Tạo CV
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!cvsLoading && cvs.length > 0 && (
                                <div className="d-flex flex-column gap-2 mb-3">
                                    {cvs.map((cv) => (
                                        <label key={cv.id} className="border rounded p-2 d-flex align-items-start gap-2" style={{ cursor: 'pointer' }}>
                                            <input
                                                type="radio"
                                                name="applyCv"
                                                className="form-check-input mt-1"
                                                checked={String(selectedCvId) === String(cv.id)}
                                                onChange={() => setSelectedCvId(cv.id)}
                                            />
                                            <div className="flex-grow-1">
                                                <div className="fw-semibold">{cv.name}</div>
                                                {cv.summary ? <div className="small text-muted">{cv.summary}</div> : null}
                                                <div className="small text-muted">{cv.size || ''}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}

                            <div className="d-flex gap-2 justify-content-end">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setShowApplyModal(false)}
                                    disabled={applySubmitting}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={submitApplication}
                                    disabled={applySubmitting || cvsLoading || !selectedCvId}
                                >
                                    {applySubmitting ? 'Đang nộp...' : 'Nộp hồ sơ'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default JobPublicDetail;

