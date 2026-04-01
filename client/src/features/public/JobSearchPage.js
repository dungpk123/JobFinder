import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../components/NotificationProvider';

const fmtVnd = new Intl.NumberFormat('vi-VN');

const formatSalary = (job) => {
    const type = job.KieuLuong || 'Thỏa thuận';
    const from = job.LuongTu == null ? null : Number(job.LuongTu);
    const to = job.LuongDen == null ? null : Number(job.LuongDen);

    if (type === 'Thỏa thuận' || (from == null && to == null)) return 'Thỏa thuận';
    const unit = String(type).toLowerCase();

    if (Number.isFinite(from) && Number.isFinite(to)) return `${fmtVnd.format(from)} - ${fmtVnd.format(to)} VND/${unit}`;
    if (Number.isFinite(from)) return `Từ ${fmtVnd.format(from)} VND/${unit}`;
    if (Number.isFinite(to)) return `Đến ${fmtVnd.format(to)} VND/${unit}`;
    return 'Thỏa thuận';
};

const extractPreviewBullets = (html, maxItems = 6) => {
    if (!html) return [];
    if (typeof window === 'undefined') return [];
    const wrap = document.createElement('div');
    wrap.innerHTML = String(html);
    const items = Array.from(wrap.querySelectorAll('li'))
        .map((li) => String(li.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    if (items.length > 0) return items.slice(0, maxItems);

    const text = String(wrap.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return [];
    const clipped = text.length > 220 ? `${text.slice(0, 220)}…` : text;
    return [clipped];
};

// Fallback mapping for mock jobs (server /api/mock-jobs)
const mapMockJob = (j) => {
    const salary = Number.isFinite(Number(j.salaryValue)) ? Number(j.salaryValue) * 1_000_000 : null;
    const employmentType = (() => {
        if (j.type === 'fulltime') return 'Toàn thời gian';
        if (j.type === 'parttime') return 'Bán thời gian';
        if (j.type === 'intern') return 'Thực tập';
        return 'Khác';
    })();

    return {
        MaTin: j.id,
        TieuDe: j.title,
        MoTa: null,
        YeuCau: null,
        QuyenLoi: null,
        KinhNghiem: j.experience || '',
        CapBac: '',
        LinhVucCongViec: j.career || '',
        LinhVucCongTy: j.career || '',
        LuongTu: salary,
        LuongDen: salary,
        KieuLuong: salary ? 'Tháng' : 'Thỏa thuận',
        DiaDiem: j.location || '',
        ThanhPho: j.province || '',
        HinhThuc: employmentType,
        TrangThai: 'Đã đăng',
        NgayDang: '',
        HanNopHoSo: '',
        TenCongTy: j.company || 'Nhà tuyển dụng',
        Logo: j.logo || '/images/logo.png'
    };
};

const JobSearchPage = () => {
    const navigate = useNavigate();
    const { notify } = useNotification();

    // Use explicit API base so the page works both with CRA proxy (dev)
    // and when serving a production build without proxy.
    const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001';

    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [savedIds, setSavedIds] = useState([]); // array of MaTin
    const savedSet = useMemo(() => new Set(savedIds.map((x) => String(x))), [savedIds]);

    const [provinces, setProvinces] = useState([]);

    const [keyword, setKeyword] = useState('');
    const [selectedProvince, setSelectedProvince] = useState('');

    // UI state
    const [selectedCategory, setSelectedCategory] = useState('');
    const [experience, setExperience] = useState('Tất cả kinh nghiệm');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`${API_BASE}/jobs`);
                const data = await res.json().catch(() => null);
                if (!res.ok) throw new Error((data && data.error) || 'Không tải được danh sách việc làm');

                // Fallback: nếu không có job thật, lấy mock để hiển thị
                if (!cancelled) {
                    if (Array.isArray(data) && data.length > 0) {
                        setJobs(data);
                        if (process.env.NODE_ENV !== 'production') {
                            // eslint-disable-next-line no-console
                            console.debug('[JobSearchPage] Loaded jobs from /jobs:', data.length, data[0]);
                        }
                    } else {
                        try {
                            const mockRes = await fetch(`${API_BASE}/api/mock-jobs`);
                            const mockData = await mockRes.json().catch(() => ([]));
                            if (Array.isArray(mockData) && mockData.length > 0) {
                                const mapped = mockData.map(mapMockJob);
                                setJobs(mapped);
                                if (process.env.NODE_ENV !== 'production') {
                                    // eslint-disable-next-line no-console
                                    console.debug('[JobSearchPage] Loaded jobs from /api/mock-jobs:', mapped.length, mapped[0]);
                                }
                            } else {
                                setJobs([]);
                            }
                        } catch {
                            setJobs([]);
                        }
                    }
                }
            } catch (err) {
                if (!cancelled) setError(err.message || 'Có lỗi xảy ra.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [API_BASE]);

    useEffect(() => {
        let cancelled = false;

        const loadSaved = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setSavedIds([]);
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/jobs/saved`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json().catch(() => null);
                if (!res.ok) throw new Error((data && data.error) || 'Không tải được việc làm đã lưu');
                if (!cancelled) setSavedIds(Array.isArray(data) ? data.map((j) => j.MaTin) : []);
            } catch {
                if (!cancelled) setSavedIds([]);
            }
        };

        loadSaved();
        return () => { cancelled = true; };
    }, [API_BASE]);

    const toggleSaveJob = async (jobId) => {
        const token = localStorage.getItem('token');
        if (!token) {
            notify({ type: 'error', message: 'Bạn cần đăng nhập để lưu công việc.' });
            return;
        }

        const idStr = String(jobId);
        const isSaved = savedSet.has(idStr);
        try {
            const res = await fetch(`${API_BASE}/jobs/saved/${encodeURIComponent(idStr)}`, {
                method: isSaved ? 'DELETE' : 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error((data && data.error) || 'Không thể cập nhật lưu việc');

            setSavedIds((prev) => {
                const next = new Set(prev.map((x) => String(x)));
                if (isSaved) next.delete(idStr);
                else next.add(idStr);
                return Array.from(next);
            });

            notify({ type: 'success', message: isSaved ? 'Đã bỏ lưu công việc.' : 'Đã lưu công việc.' });
        } catch (err) {
            notify({ type: 'error', message: err.message || 'Không thể cập nhật lưu việc' });
        }
    };

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/provinces`);
                const data = await res.json().catch(() => ([]));
                if (!res.ok) return;
                if (!cancelled) setProvinces(Array.isArray(data) ? data : []);
            } catch {
                // ignore
            }
        };
        load();
        return () => { cancelled = true; };
    }, [API_BASE]);

    const toNumber = (v) => {
        // IMPORTANT: Number(null) === 0 and Number('') === 0.
        // For filtering, empty values must be treated as "no constraint".
        if (v === '' || v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    const norm = (v) => String(v ?? '').trim().toLowerCase();
    const parseMillionVnd = (v) => {
        if (v === '' || v == null) return null;
        const n = Number(v);
        // Guard against 0 / negative / NaN values that could unintentionally filter out everything.
        if (!Number.isFinite(n) || n <= 0) return null;
        return n * 1_000_000;
    };

    const salaryOverlap = (jobFrom, jobTo, filterFrom, filterTo) => {
        const jf = toNumber(jobFrom);
        const jt = toNumber(jobTo);
        const ff = toNumber(filterFrom);
        const ft = toNumber(filterTo);
        if (ff == null && ft == null) return true;
        // Treat missing job salaries as no match for bounded filters
        if (jf == null && jt == null) return false;

        // Convert to numeric bounds
        const low = jf == null ? jt : jf;
        const high = jt == null ? jf : jt;

        if (ff != null && ft != null) return (high ?? low) >= ff && (low ?? high) <= ft ? true : !(high < ff || low > ft);
        if (ff != null) return (high ?? low) >= ff;
        if (ft != null) return (low ?? high) <= ft;
        return true;
    };

    const salaryAdvMatches = (job) => {
        const label = salaryAdv;
        if (label === 'Tất cả') return true;
        const jf = toNumber(job.LuongTu);
        const jt = toNumber(job.LuongDen);
        const kieu = (job.KieuLuong || '').toLowerCase();
        if (label === 'Thỏa thuận') return kieu.includes('thỏa') || (jf == null && jt == null);

        const toRange = (l) => {
            switch (l) {
                case '10 - 15 triệu': return [10e6, 15e6];
                case '15 - 20 triệu': return [15e6, 20e6];
                case '20 - 25 triệu': return [20e6, 25e6];
                case '25 - 30 triệu': return [25e6, 30e6];
                case '30 - 50 triệu': return [30e6, 50e6];
                case 'Trên 50 triệu': return [50e6, Number.MAX_SAFE_INTEGER];
                default: return null;
            }
        };
        const range = toRange(label);
        if (!range) return true;
        return salaryOverlap(jf, jt, range[0], range[1]);
    };

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();

    // Advanced filter state (UI-only)
    const advDefaults = {
        exp: 'Tất cả',
        level: 'Tất cả',
        salary: 'Tất cả',
        salaryFrom: '',
        salaryTo: '',
        companyField: 'Tất cả lĩnh vực',
        jobField: 'Tất cả lĩnh vực',
        workingForm: 'Tất cả',
    };

    const [expAdv, setExpAdv] = useState(advDefaults.exp);
    const [levelAdv, setLevelAdv] = useState(advDefaults.level);
    const [salaryAdv, setSalaryAdv] = useState(advDefaults.salary);
    const [salaryFrom, setSalaryFrom] = useState(advDefaults.salaryFrom);
    const [salaryTo, setSalaryTo] = useState(advDefaults.salaryTo);
    const [companyField, setCompanyField] = useState(advDefaults.companyField);
    const [jobField, setJobField] = useState(advDefaults.jobField);
    const [workingForm, setWorkingForm] = useState(advDefaults.workingForm);

    // Hover preview panel (TopCV-like)
    const previewRef = useRef(null);
    const hoverAnchorRef = useRef(null);
    const hideTimerRef = useRef(null);

    const [previewJob, setPreviewJob] = useState(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewPos, setPreviewPos] = useState({ top: 0, left: 0 });

    const clearHideTimer = () => {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    };

    const closePreview = () => {
        clearHideTimer();
        setPreviewOpen(false);
    };

    const scheduleClosePreview = (delayMs = 120) => {
        clearHideTimer();
        hideTimerRef.current = setTimeout(() => {
            setPreviewOpen(false);
        }, delayMs);
    };

    const computePreviewPosition = () => {
        const viewportPad = 12;
        const panelWidth = 560;
        const estHeight = 360;

        const rect = hoverAnchorRef.current?.getBoundingClientRect();
        const cardCenterY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

        const idealLeft = Math.max(viewportPad, Math.round((window.innerWidth - panelWidth) / 2));
        let top = cardCenterY - estHeight / 2;
        top = Math.min(Math.max(viewportPad, top), Math.max(viewportPad, window.innerHeight - viewportPad - estHeight));

        setPreviewPos({ top, left: idealLeft });

        requestAnimationFrame(() => {
            const el = previewRef.current;
            if (!el) return;
            const h = el.getBoundingClientRect().height;
            let measuredTop = cardCenterY - h / 2;
            measuredTop = Math.min(Math.max(viewportPad, measuredTop), Math.max(viewportPad, window.innerHeight - viewportPad - h));
            const clampedLeft = Math.min(Math.max(viewportPad, idealLeft), Math.max(viewportPad, window.innerWidth - viewportPad - panelWidth));
            setPreviewPos({ top: measuredTop, left: clampedLeft });
        });
    };

    const openPreviewForJob = (job, anchorEl) => {
        clearHideTimer();
        hoverAnchorRef.current = anchorEl;
        setPreviewJob(job);
        setPreviewOpen(true);
        computePreviewPosition();
    };

    useEffect(() => {
        if (!previewOpen) return;
        const onMove = () => computePreviewPosition();
        window.addEventListener('scroll', onMove, true);
        window.addEventListener('resize', onMove);
        return () => {
            window.removeEventListener('scroll', onMove, true);
            window.removeEventListener('resize', onMove);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewOpen]);

    const resetAdvancedFilters = () => {
        setSelectedCategory('');
        setExpAdv(advDefaults.exp);
        setLevelAdv(advDefaults.level);
        setSalaryAdv(advDefaults.salary);
        setSalaryFrom(advDefaults.salaryFrom);
        setSalaryTo(advDefaults.salaryTo);
        setCompanyField(advDefaults.companyField);
        setJobField(advDefaults.jobField);
        setWorkingForm(advDefaults.workingForm);
    };

    const isAdvancedDirty = useMemo(() => (
        expAdv !== advDefaults.exp ||
        levelAdv !== advDefaults.level ||
        salaryAdv !== advDefaults.salary ||
        salaryFrom !== advDefaults.salaryFrom ||
        salaryTo !== advDefaults.salaryTo ||
        companyField !== advDefaults.companyField ||
        jobField !== advDefaults.jobField ||
        workingForm !== advDefaults.workingForm
    ), [
        expAdv,
        levelAdv,
        salaryAdv,
        salaryFrom,
        salaryTo,
        companyField,
        jobField,
        workingForm,
    ]);

    const filteredJobs = useMemo(() => {
        const kw = keyword.trim().toLowerCase();
        const customFrom = parseMillionVnd(salaryFrom);
        const customTo = parseMillionVnd(salaryTo);

        const matches = (j) => {
            const matchKw = !kw || norm(j.TieuDe).includes(kw) || norm(j.TenCongTy).includes(kw);
            const matchProvince = !selectedProvince || norm(j.ThanhPho) === norm(selectedProvince);
            const matchCategory = !selectedCategory || norm(j.LinhVucCongViec).includes(norm(selectedCategory));

            const matchExp = expAdv === 'Tất cả' || norm(j.KinhNghiem) === norm(expAdv);
            const matchLevel = levelAdv === 'Tất cả' || norm(j.CapBac) === norm(levelAdv);
            const matchJobField = jobField === 'Tất cả lĩnh vực' || norm(j.LinhVucCongViec).includes(norm(jobField));
            const companyFieldValueRaw = j.LinhVucCongTy || j.LinhVuc || '';
            // Null-safe: nếu backend chưa có field lĩnh vực công ty thì không nên lọc rớt hết.
            const matchCompanyField = companyField === 'Tất cả lĩnh vực'
                || (!companyFieldValueRaw)
                || norm(companyFieldValueRaw).includes(norm(companyField));
            const matchWorkingForm = workingForm === 'Tất cả' || norm(j.HinhThuc).includes(norm(workingForm));

            const matchSalaryPreset = salaryAdvMatches(j);
            const matchSalaryCustom = salaryOverlap(j.LuongTu, j.LuongDen, customFrom, customTo);

            return matchKw && matchProvince && matchCategory && matchExp && matchLevel && matchJobField && matchCompanyField && matchWorkingForm && matchSalaryPreset && matchSalaryCustom;
        };

        const out = jobs.filter(matches);

        if (process.env.NODE_ENV !== 'production' && jobs.length > 0 && out.length === 0) {
            const breakdown = {
                total: jobs.length,
                matchKw: 0,
                matchProvince: 0,
                matchCategory: 0,
                matchExp: 0,
                matchLevel: 0,
                matchJobField: 0,
                matchCompanyField: 0,
                matchWorkingForm: 0,
                matchSalaryPreset: 0,
                matchSalaryCustom: 0,
                matchAll: 0,
            };

            for (const j of jobs) {
                const matchKw = !kw || norm(j?.TieuDe).includes(kw) || norm(j?.TenCongTy).includes(kw);
                const matchProvince = !selectedProvince || norm(j?.ThanhPho) === norm(selectedProvince);
                const matchCategory = !selectedCategory || norm(j?.LinhVucCongViec).includes(norm(selectedCategory));
                const matchExp = expAdv === 'Tất cả' || norm(j?.KinhNghiem) === norm(expAdv);
                const matchLevel = levelAdv === 'Tất cả' || norm(j?.CapBac) === norm(levelAdv);
                const matchJobField = jobField === 'Tất cả lĩnh vực' || norm(j?.LinhVucCongViec).includes(norm(jobField));
                const companyFieldValueRaw = j?.LinhVucCongTy || j?.LinhVuc || '';
                const matchCompanyField = companyField === 'Tất cả lĩnh vực'
                    || (!companyFieldValueRaw)
                    || norm(companyFieldValueRaw).includes(norm(companyField));
                const matchWorkingForm = workingForm === 'Tất cả' || norm(j?.HinhThuc).includes(norm(workingForm));
                const matchSalaryPreset = salaryAdvMatches(j || {});
                const matchSalaryCustom = salaryOverlap(j?.LuongTu, j?.LuongDen, customFrom, customTo);

                if (matchKw) breakdown.matchKw++;
                if (matchProvince) breakdown.matchProvince++;
                if (matchCategory) breakdown.matchCategory++;
                if (matchExp) breakdown.matchExp++;
                if (matchLevel) breakdown.matchLevel++;
                if (matchJobField) breakdown.matchJobField++;
                if (matchCompanyField) breakdown.matchCompanyField++;
                if (matchWorkingForm) breakdown.matchWorkingForm++;
                if (matchSalaryPreset) breakdown.matchSalaryPreset++;
                if (matchSalaryCustom) breakdown.matchSalaryCustom++;
                if (matchKw && matchProvince && matchCategory && matchExp && matchLevel && matchJobField && matchCompanyField && matchWorkingForm && matchSalaryPreset && matchSalaryCustom) {
                    breakdown.matchAll++;
                }
            }

            // eslint-disable-next-line no-console
            console.debug('[JobSearchPage] All jobs filtered out. Current filters:', {
                keyword,
                selectedProvince,
                selectedCategory,
                expAdv,
                levelAdv,
                salaryAdv,
                salaryFrom,
                salaryTo,
                companyField,
                jobField,
                workingForm
            });

            // eslint-disable-next-line no-console
            console.debug('[JobSearchPage] Filter breakdown:', breakdown);

            // eslint-disable-next-line no-console
            console.debug('[JobSearchPage] Sample job:', jobs[0]);
        }

        return out;
    }, [
        jobs,
        keyword,
        selectedProvince,
        selectedCategory,
        expAdv,
        levelAdv,
        jobField,
        companyField,
        workingForm,
        salaryAdv,
        salaryFrom,
        salaryTo
    ]);

    return (
        <div className="jf-job-search-page">
            <div className="jf-job-search-hero">
                <div className="container" style={{ maxWidth: 1220 }}>
                    <div className="jf-job-searchbar jf-job-searchbar--v2">
                        <div className="row g-2 align-items-center">
                            <div className="col-lg-5">
                                <div className="jf-job-searchbar-input">
                                    <i className="bi bi-search"></i>
                                    <input
                                        className="form-control border-0"
                                        placeholder="Tìm kiếm cơ hội việc làm"
                                        value={keyword}
                                        onChange={(e) => setKeyword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="col-lg-3">
                                <div className="jf-job-searchbar-input">
                                    <i className="bi bi-briefcase"></i>
                                    <select
                                        className="form-select border-0"
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                    >
                                        <option value="">Lọc theo nghề nghiệp</option>
                                        <option value="CNTT">Công nghệ thông tin</option>
                                        <option value="Marketing">Marketing</option>
                                        <option value="KinhDoanh">Kinh doanh</option>
                                        <option value="KeToan">Kế toán</option>
                                        <option value="CSKH">Chăm sóc khách hàng</option>
                                    </select>
                                </div>
                            </div>

                            <div className="col-lg-2">
                                <div className="jf-job-searchbar-input">
                                    <i className="bi bi-geo-alt"></i>
                                    <select
                                        className="form-select border-0"
                                        value={selectedProvince}
                                        onChange={(e) => setSelectedProvince(e.target.value)}
                                    >
                                        <option value="">Tất cả</option>
                                        {provinces.map((p) => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="col-lg-2">
                                <button type="button" className="btn btn-primary w-100 jf-job-search-btn" style={{ height: '48px' }}>
                                    Tìm kiếm
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Filter chip bar removed per request */}
                </div>
            </div>

            <div className="container my-4" style={{ maxWidth: 1220 }}>
                {error && <div className="alert alert-danger">{error}</div>}

                <div className="row g-4">
                    <div className="col-lg-3">
                        <div className="jf-filter-card">
                            <div className="d-flex align-items-center gap-2 mb-3 jf-filter-card__header">
                                <i className="bi bi-funnel"></i>
                                <span className="fw-semibold">Lọc nâng cao</span>
                            </div>

                            <div className="jf-filter-section mb-3">
                                <div className="fw-semibold mb-2">Kinh nghiệm</div>
                                {['Tất cả', 'Dưới 1 năm', '1 năm', '2 năm', '3 năm', '4 năm', '5 năm', 'Trên 5 năm', 'Không yêu cầu'].map((opt) => (
                                    <label key={opt} className="d-flex align-items-center gap-2 mb-2 text-muted">
                                        <input
                                            type="radio"
                                            className="form-check-input m-0"
                                            name="exp-adv"
                                            checked={expAdv === opt}
                                            onChange={() => setExpAdv(opt)}
                                        />
                                        <span>{opt}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="jf-filter-section mb-3">
                                <div className="fw-semibold mb-2">Cấp bậc</div>
                                {[
                                    'Tất cả',
                                    'Nhân viên',
                                    'Trưởng nhóm',
                                    'Trưởng/Phó phòng',
                                    'Quản lý / Giám sát',
                                    'Trưởng chi nhánh',
                                    'Phó giám đốc',
                                    'Giám đốc',
                                    'Thực tập sinh',
                                ].map((opt) => (
                                    <label key={opt} className="d-flex align-items-center gap-2 mb-2 text-muted">
                                        <input
                                            type="radio"
                                            className="form-check-input m-0"
                                            name="level-adv"
                                            checked={levelAdv === opt}
                                            onChange={() => setLevelAdv(opt)}
                                        />
                                        <span>{opt}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="jf-filter-section mb-3">
                                <div className="fw-semibold mb-2">Mức lương</div>
                                {[
                                    'Tất cả',
                                    '10 - 15 triệu',
                                    '15 - 20 triệu',
                                    '20 - 25 triệu',
                                    '25 - 30 triệu',
                                    '30 - 50 triệu',
                                    'Trên 50 triệu',
                                    'Thỏa thuận',
                                ].map((opt) => (
                                    <label key={opt} className="d-flex align-items-center gap-2 mb-2 text-muted">
                                        <input
                                            type="radio"
                                            className="form-check-input m-0"
                                            name="salary-adv"
                                            checked={salaryAdv === opt}
                                            onChange={() => setSalaryAdv(opt)}
                                        />
                                        <span>{opt}</span>
                                    </label>
                                ))}

                                <div className="d-flex align-items-center gap-2 mt-2">
                                    <input
                                        type="number"
                                        className="form-control form-control-sm"
                                        placeholder="Từ"
                                        value={salaryFrom}
                                        onChange={(e) => setSalaryFrom(e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        className="form-control form-control-sm"
                                        placeholder="Đến"
                                        value={salaryTo}
                                        onChange={(e) => setSalaryTo(e.target.value)}
                                    />
                                    <span className="text-muted" style={{ fontSize: 12 }}>triệu</span>
                                </div>
                            </div>

                            <div className="jf-filter-section mb-3">
                                <div className="fw-semibold mb-2">Lĩnh vực công ty</div>
                                <select
                                    className="form-select form-select-sm"
                                    value={companyField}
                                    onChange={(e) => setCompanyField(e.target.value)}
                                >
                                    {['Tất cả lĩnh vực', 'CNTT', 'Marketing', 'Kinh doanh', 'Tài chính', 'Sản xuất', 'Dịch vụ', 'Khác'].map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="jf-filter-section mb-3">
                                <div className="fw-semibold mb-2">Lĩnh vực công việc</div>
                                <select
                                    className="form-select form-select-sm"
                                    value={jobField}
                                    onChange={(e) => setJobField(e.target.value)}
                                >
                                    {['Tất cả lĩnh vực', 'CNTT', 'Marketing', 'Bán hàng', 'Hành chính', 'Kỹ thuật', 'Khác'].map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="jf-filter-section mb-2">
                                <div className="fw-semibold mb-2">Hình thức làm việc</div>
                                {['Tất cả', 'Toàn thời gian', 'Bán thời gian', 'Thực tập', 'Khác'].map((opt) => (
                                    <label key={opt} className="d-flex align-items-center gap-2 mb-2 text-muted">
                                        <input
                                            type="radio"
                                            className="form-check-input m-0"
                                            name="working-form"
                                            checked={workingForm === opt}
                                            onChange={() => setWorkingForm(opt)}
                                        />
                                        <span>{opt}</span>
                                    </label>
                                ))}
                            </div>

                            <button
                                type="button"
                                className={`btn btn-outline-secondary w-100 mt-2 jf-clear-btn ${isAdvancedDirty ? 'jf-clear-btn--active' : ''} jf-filter-card__footer`}
                                onClick={resetAdvancedFilters}
                                disabled={!isAdvancedDirty}
                            >
                                Xóa lọc
                            </button>
                        </div>
                    </div>

                    <div className="col-lg-9">
                        <div className="mb-3">
                            <div className="text-muted small">Trang chủ &nbsp;›&nbsp; Tuyển dụng</div>
                            <div className="d-flex align-items-end justify-content-between flex-wrap gap-2">
                                <div>
                                    <div className="fw-semibold" style={{ fontSize: 18 }}>
                                        Tuyển dụng {filteredJobs.length.toLocaleString('vi-VN')} việc làm <span className="text-muted">| Update {dd}/{mm}/{yyyy}</span>
                                    </div>
                                    <div className="text-muted small">
                                        Xem việc làm tại <span className="text-success fw-semibold">Hà Nội</span> | <span className="text-success fw-semibold">Hồ Chí Minh</span> | <span className="text-success fw-semibold">Chọn tỉnh thành của tôi →</span>
                                    </div>
                                </div>
                                <button className="btn btn-outline-secondary rounded-pill" disabled>
                                    <i className="bi bi-bell me-2"></i>Tạo thông báo việc làm
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-muted">Đang tải...</div>
                        ) : filteredJobs.length === 0 ? (
                            <div className="text-muted">
                                Không có việc làm phù hợp.
                                {jobs.length > 0 && (
                                    <div className="mt-2">
                                        <button type="button" className="btn btn-link p-0 align-baseline" onClick={resetAdvancedFilters}>Xóa lọc</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-3">
                                {filteredJobs.map((j) => (
                                    <div
                                        key={j.MaTin}
                                        className="jf-job-card"
                                        role="button"
                                        tabIndex={0}
                                        onMouseEnter={(e) => openPreviewForJob(j, e.currentTarget)}
                                        onMouseLeave={() => scheduleClosePreview()}
                                        onFocus={(e) => openPreviewForJob(j, e.currentTarget)}
                                        onBlur={() => scheduleClosePreview(0)}
                                        onClick={() => navigate(`/jobs/${j.MaTin}`)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') navigate(`/jobs/${j.MaTin}`);
                                        }}
                                    >
                                        <div className="d-flex gap-3">
                                            <div className="jf-job-logo">
                                                <img
                                                    src={j.Logo || '/images/logo.png'}
                                                    alt={j.TenCongTy || 'Logo'}
                                                    onError={(e) => {
                                                        e.currentTarget.onerror = null;
                                                        e.currentTarget.src = '/images/logo.png';
                                                    }}
                                                />
                                            </div>

                                            <div className="flex-grow-1">
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    {j.TrangThai === 'Đã đăng' && (
                                                        <span className="jf-job-pill">Nổi bật</span>
                                                    )}
                                                    <div className="jf-job-title">{j.TieuDe}</div>
                                                </div>
                                                <div className="text-muted small fw-semibold">{j.TenCongTy || 'Nhà tuyển dụng'}</div>

                                                <div className="d-flex flex-wrap gap-2 mt-2">
                                                    <span className="jf-job-tag"><i className="bi bi-geo-alt me-1"></i>{j.ThanhPho || '---'}</span>
                                                    <span className="jf-job-tag"><i className="bi bi-briefcase me-1"></i>{j.HinhThuc || '---'}</span>
                                                    <span className="jf-job-tag"><i className="bi bi-cash-coin me-1"></i>{formatSalary(j)}</span>
                                                </div>
                                            </div>

                                            <div className="text-end d-flex flex-column justify-content-between">
                                                <div className="jf-job-salary">
                                                    {(() => {
                                                        const from = j.LuongTu == null ? null : Number(j.LuongTu);
                                                        const to = j.LuongDen == null ? null : Number(j.LuongDen);
                                                        if (Number.isFinite(from) && Number.isFinite(to)) return `${fmtVnd.format(from)} - ${fmtVnd.format(to)}`;
                                                        if (Number.isFinite(from)) return `Từ ${fmtVnd.format(from)}`;
                                                        if (Number.isFinite(to)) return `Đến ${fmtVnd.format(to)}`;
                                                        return 'Thỏa thuận';
                                                    })()}
                                                </div>
                                                <div className="jf-job-actions">
                                                    <button
                                                        type="button"
                                                        className={`btn jf-heart ${savedSet.has(String(j.MaTin)) ? 'is-saved' : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleSaveJob(j.MaTin);
                                                        }}
                                                        aria-label="Lưu"
                                                        title={savedSet.has(String(j.MaTin)) ? 'Bỏ lưu' : 'Lưu'}
                                                    >
                                                        <i className={`bi ${savedSet.has(String(j.MaTin)) ? 'bi-heart-fill' : 'bi-heart'}`}></i>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {previewOpen && previewJob && (
                            <div
                                ref={previewRef}
                                className="jf-job-preview"
                                style={{ top: previewPos.top, left: previewPos.left }}
                                onMouseEnter={() => clearHideTimer()}
                                onMouseLeave={() => scheduleClosePreview()}
                                role="dialog"
                                aria-label="Xem nhanh tin tuyển dụng"
                            >
                                <div className="jf-job-preview-head">
                                    <div className="jf-job-preview-logo">
                                        <img
                                            src={previewJob.Logo || '/images/logo.png'}
                                            alt={previewJob.TenCongTy || 'Logo'}
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = '/images/logo.png';
                                            }}
                                        />
                                    </div>
                                    <div className="flex-grow-1">
                                        <div className="jf-job-preview-title">{previewJob.TieuDe || '---'}</div>
                                        <div className="jf-job-preview-company">{previewJob.TenCongTy || 'Nhà tuyển dụng'}</div>
                                        <div className="jf-job-preview-salary">{formatSalary(previewJob)}</div>
                                    </div>
                                </div>

                                <div className="jf-job-preview-tags">
                                    <span className="jf-job-preview-tag"><i className="bi bi-geo-alt me-1"></i>{[previewJob.DiaDiem, previewJob.ThanhPho].filter(Boolean).join(', ') || '---'}</span>
                                    <span className="jf-job-preview-tag"><i className="bi bi-briefcase me-1"></i>{previewJob.HinhThuc || '---'}</span>
                                    <span className="jf-job-preview-tag"><i className="bi bi-clock me-1"></i>Hạn: {previewJob.HanNopHoSo || '---'}</span>
                                    <span className="jf-job-preview-tag"><i className="bi bi-person-workspace me-1"></i>{previewJob.KinhNghiem || '---'}</span>
                                </div>

                                <div className="jf-job-preview-section">
                                    <div className="jf-job-preview-section-title">Mô tả công việc</div>
                                    <ul className="jf-job-preview-list">
                                        {(() => {
                                            const bullets = extractPreviewBullets(previewJob.MoTa, 6);
                                            if (bullets.length === 0) return (<li className="text-muted"><em>Chưa cập nhật</em></li>);
                                            return bullets.map((t, idx) => (
                                                <li key={`${previewJob.MaTin}-mota-${idx}`}>{t}</li>
                                            ));
                                        })()}
                                    </ul>
                                </div>

                                <div className="jf-job-preview-actions">
                                    <button
                                        type="button"
                                        className="btn btn-success"
                                        onClick={() => navigate(`/jobs/${previewJob.MaTin}`)}
                                    >
                                        Ứng tuyển
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={() => navigate(`/jobs/${previewJob.MaTin}`)}
                                    >
                                        Xem chi tiết
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobSearchPage;
