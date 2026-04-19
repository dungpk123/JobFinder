import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import CareerRichTextEditor from '../../career-guide/components/CareerRichTextEditor';
import CalendarDatePicker from '../../../components/date/CalendarDatePicker';
import './JobCreate.css';

const salaryTypes = ['Thỏa thuận', 'Tháng', 'Năm', 'Khoảng', 'Không xác định'];
const employmentTypes = ['Toàn thời gian', 'Bán thời gian', 'Thực tập', 'Từ xa', 'Hợp đồng'];
const statuses = ['Đã đăng', 'Nháp'];
const experienceOptions = ['Không yêu cầu', 'Dưới 1 năm', '1 năm', '2 năm', '3 năm', '4 năm', '5 năm', 'Trên 5 năm'];
const levelOptions = [
    'Thực tập sinh',
    'Nhân viên',
    'Trưởng nhóm',
    'Trưởng/Phó phòng',
    'Quản lý / Giám sát',
    'Trưởng chi nhánh',
    'Phó giám đốc',
    'Giám đốc'
];
const jobFieldOptions = ['CNTT', 'Marketing', 'Bán hàng', 'Hành chính', 'Kỹ thuật', 'Tài chính', 'Sản xuất', 'Dịch vụ', 'Khác'];

const normalizeProvinceEntry = (entry) => {
    if (!entry) return '';
    if (typeof entry === 'string') return entry.trim();
    return String(
        entry.TenTinh
        || entry.name
        || entry.ten
        || entry.province
        || entry.label
        || ''
    ).trim();
};

const pad2 = (value) => String(value).padStart(2, '0');

const parseIsoDateParts = (value) => {
    const input = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return null;

    const [yearRaw, monthRaw, dayRaw] = input.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return null;
    }

    if (month < 1 || month > 12) return null;

    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) return null;

    return { year, month, day };
};

const formatIsoDate = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    const day = pad2(date.getDate());
    return `${year}-${month}-${day}`;
};

const JobsStyleSelect = ({
    value,
    options,
    onChange,
    placeholder = 'Chọn',
    searchable = false,
    searchPlaceholder = 'Nhập để tìm...',
    locationMode = false,
    disabled = false,
    emptyText = 'Không tìm thấy lựa chọn'
}) => {
    const rootRef = useRef(null);
    const searchInputRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');

    const normalizedOptions = useMemo(() => {
        const source = Array.isArray(options) ? options : [];
        return Array.from(new Set(source.map((item) => String(item || '').trim()).filter(Boolean)));
    }, [options]);

    const visibleOptions = useMemo(() => {
        const keyword = String(query || '').trim().toLowerCase();
        if (!keyword) return normalizedOptions;
        return normalizedOptions.filter((item) => item.toLowerCase().includes(keyword));
    }, [normalizedOptions, query]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const closeIfOutside = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const closeOnEscape = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', closeIfOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('mousedown', closeIfOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            return;
        }

        if (!searchable) return;
        const id = window.setTimeout(() => {
            searchInputRef.current?.focus();
        }, 0);
        return () => window.clearTimeout(id);
    }, [isOpen, searchable]);

    const selectedLabel = value || placeholder;

    return (
        <div
            ref={rootRef}
            className={`jf-jobs-select job-create-select ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
        >
            <button
                type="button"
                className="jf-jobs-select-trigger"
                onClick={() => {
                    if (disabled) return;
                    setIsOpen((prev) => !prev);
                }}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                disabled={disabled}
            >
                <span className="jf-jobs-select-text">{selectedLabel}</span>
                <i className="bi bi-chevron-down"></i>
            </button>

            {isOpen ? (
                <div
                    className={`jf-jobs-select-menu ${locationMode ? 'jf-jobs-select-menu--location' : ''}`}
                    role="listbox"
                >
                    {searchable ? (
                        <div className="jf-jobs-select-search-wrap">
                            <i className="bi bi-search"></i>
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={searchPlaceholder}
                            />
                        </div>
                    ) : null}

                    <div className="jf-jobs-select-scroll">
                        {visibleOptions.length === 0 ? (
                            <div className="jf-jobs-select-empty">{emptyText}</div>
                        ) : (
                            visibleOptions.map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    className={`jf-jobs-select-option ${value === item ? 'is-active' : ''}`}
                                    onClick={() => {
                                        onChange(item);
                                        setIsOpen(false);
                                    }}
                                >
                                    {item}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
};

const DeadlineDateField = ({ value, onChange, disabled = false }) => {
    const parsed = useMemo(() => parseIsoDateParts(value), [value]);
    const todayIso = useMemo(() => formatIsoDate(new Date()), []);
    const maxDateIso = useMemo(() => {
        const maxYear = new Date().getFullYear() + 7;
        return `${maxYear}-12-31`;
    }, []);

    const setQuickDate = (daysToAdd) => {
        const next = new Date();
        next.setHours(0, 0, 0, 0);
        next.setDate(next.getDate() + daysToAdd);
        onChange(formatIsoDate(next));
    };

    const displayValue = parsed
        ? `${pad2(parsed.day)}/${pad2(parsed.month)}/${parsed.year}`
        : 'Chưa chọn hạn nộp hồ sơ';

    return (
        <div className="job-create-deadline-picker">
            <CalendarDatePicker
                value={value}
                onChange={onChange}
                placeholder="Chọn hạn nộp hồ sơ"
                disabled={disabled}
                minDate={todayIso}
                maxDate={maxDateIso}
                inputClassName="form-control job-create-deadline-input"
                menuClassName="job-create-deadline-menu"
            />

            <div className="job-create-deadline-actions">
                <button
                    type="button"
                    className="job-create-deadline-chip"
                    onClick={() => setQuickDate(7)}
                    disabled={disabled}
                >
                    +7 ngày
                </button>
                <button
                    type="button"
                    className="job-create-deadline-chip"
                    onClick={() => setQuickDate(30)}
                    disabled={disabled}
                >
                    +30 ngày
                </button>
                <button
                    type="button"
                    className="job-create-deadline-chip is-clear"
                    onClick={() => {
                        onChange('');
                    }}
                    disabled={disabled}
                >
                    Xóa
                </button>
            </div>

            <small className="job-create-helptext">{displayValue}</small>
        </div>
    );
};

const USD_TO_VND_RATE = 25000;
const MAX_VND_SALARY = 999999999;

const digitsOnly = (value) => String(value || '').replace(/[^0-9]/g, '');

const formatThousandsVi = (digits) => {
    const normalized = digitsOnly(digits);
    if (!normalized) return '';

    const asNumber = Number(normalized);
    if (!Number.isFinite(asNumber)) return normalized;

    return new Intl.NumberFormat('vi-VN').format(asNumber);
};

const vndDigitsToDisplayDigits = (vndDigits, currency) => {
    const normalized = digitsOnly(vndDigits);
    if (!normalized) return '';

    const vnd = Number(normalized);
    if (!Number.isFinite(vnd)) return '';

    if (currency === 'USD') {
        const usd = Math.round(vnd / USD_TO_VND_RATE);
        return String(Math.max(0, usd));
    }

    return String(Math.max(0, Math.round(vnd)));
};

const inputDigitsToVndDigits = (inputDigits, currency) => {
    const normalized = digitsOnly(inputDigits);
    if (!normalized) return '';

    const value = Number(normalized);
    if (!Number.isFinite(value)) return '';

    let vndValue = Math.round(value);
    if (currency === 'USD') {
        vndValue = Math.round(value * USD_TO_VND_RATE);
    }

    const clamped = Math.min(MAX_VND_SALARY, Math.max(0, vndValue));
    return String(clamped);
};

const normalizeHeading = (value, fallback) => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
};

const normalizeExtraSectionItem = (item) => {
    if (!item || typeof item !== 'object') return null;

    const title = String(
        item.title
        ?? item.TieuDe
        ?? item.tenMuc
        ?? item.label
        ?? ''
    ).trim();

    const content = String(
        item.content
        ?? item.NoiDung
        ?? item.noiDung
        ?? item.html
        ?? item.moTa
        ?? ''
    );

    if (!title && !content) return null;

    return { title, content };
};

const parseExtraSectionsPayload = (rawValue) => {
    if (!rawValue) return [];

    let source = rawValue;
    if (typeof source === 'string') {
        try {
            source = JSON.parse(source);
        } catch {
            return [];
        }
    }

    if (!Array.isArray(source)) return [];

    return source
        .map((item) => normalizeExtraSectionItem(item))
        .filter(Boolean);
};

const JobCreate = () => {
    const navigate = useNavigate();
    const { id: jobId } = useParams();
    const token = useMemo(() => localStorage.getItem('token') || '', []);
    const isEdit = Boolean(jobId);
    const extraSectionIdRef = useRef(1);

    const [form, setForm] = useState({
        title: '',
        location: '',
        city: '',
        salaryFrom: '',
        salaryTo: '',
        salaryType: 'Thỏa thuận',
        employmentType: 'Toàn thời gian',
        experience: 'Không yêu cầu',
        level: 'Nhân viên',
        jobField: 'CNTT',
        deadline: '',
        status: 'Đã đăng'
    });

    const [provinces, setProvinces] = useState([]);
    const [loadingProvinces, setLoadingProvinces] = useState(false);
    const [salaryCurrency, setSalaryCurrency] = useState('VND');
    const [loadingJob, setLoadingJob] = useState(isEdit);
    const [richValues, setRichValues] = useState({
        description: '',
        requirements: '',
        benefits: ''
    });
    const [editorTitles, setEditorTitles] = useState({
        description: 'Mô tả công việc',
        requirements: 'Yêu cầu',
        benefits: 'Quyền lợi'
    });
    const [extraSections, setExtraSections] = useState([]);
    const [showLocationModal, setShowLocationModal] = useState(false);
    const [locationModalError, setLocationModalError] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Fetch provinces on component mount
    useEffect(() => {
        const fetchProvinces = async () => {
            setLoadingProvinces(true);
            try {
                const res = await fetch('/api/provinces');
                if (res.ok) {
                    const payload = await res.json().catch(() => []);
                    const source = Array.isArray(payload)
                        ? payload
                        : Array.isArray(payload?.data)
                            ? payload.data
                            : [];
                    const normalized = Array.from(
                        new Set(source.map(normalizeProvinceEntry).filter(Boolean))
                    ).sort((a, b) => a.localeCompare(b, 'vi'));
                    setProvinces(normalized);
                }
            } catch (err) {
                console.error('Error fetching provinces:', err);
            } finally {
                setLoadingProvinces(false);
            }
        };
        fetchProvinces();
    }, []);

    const setField = (key) => (valueOrEvent) => {
        const value = valueOrEvent && valueOrEvent.target
            ? valueOrEvent.target.value
            : valueOrEvent;
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const setRichField = (key) => (html) => {
        setRichValues((prev) => ({
            ...prev,
            [key]: html
        }));
    };

    const setEditorTitle = (key) => (event) => {
        const nextValue = event?.target?.value ?? '';
        setEditorTitles((prev) => ({
            ...prev,
            [key]: nextValue
        }));
    };

    const addExtraSection = () => {
        const nextId = extraSectionIdRef.current;
        extraSectionIdRef.current += 1;
        setExtraSections((prev) => ([
            ...prev,
            {
                id: nextId,
                title: '',
                content: ''
            }
        ]));
    };

    const removeExtraSection = (id) => {
        setExtraSections((prev) => prev.filter((section) => section.id !== id));
    };

    const updateExtraSection = (id, key, value) => {
        setExtraSections((prev) => prev.map((section) => {
            if (section.id !== id) return section;
            return {
                ...section,
                [key]: value
            };
        }));
    };

    const setSalaryField = (key) => (e) => {
        const vndDigits = inputDigitsToVndDigits(e.target.value, salaryCurrency);
        setForm((prev) => ({ ...prev, [key]: vndDigits }));
    };

    const salaryDisplayValue = (vndDigits) => {
        const displayDigits = vndDigitsToDisplayDigits(vndDigits, salaryCurrency);
        return formatThousandsVi(displayDigits);
    };

    // Fetch job detail when editing
    useEffect(() => {
        if (!isEdit) return;
        let cancelled = false;
        const loadJob = async () => {
            setLoadingJob(true);
            setError('');
            try {
                const res = await fetch(`/jobs/${jobId}`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'Không tải được tin tuyển dụng');

                if (cancelled) return;
                setForm({
                    title: data.TieuDe || '',
                    location: data.DiaDiem || '',
                    city: data.ThanhPho || '',
                    salaryFrom: digitsOnly(data.LuongTu ?? ''),
                    salaryTo: digitsOnly(data.LuongDen ?? ''),
                    salaryType: data.KieuLuong || 'Thỏa thuận',
                    employmentType: data.HinhThuc || 'Toàn thời gian',
                    experience: data.KinhNghiem || 'Không yêu cầu',
                    level: data.CapBac || 'Nhân viên',
                    jobField: data.LinhVucCongViec || 'CNTT',
                    deadline: data.HanNopHoSo ? String(data.HanNopHoSo).slice(0, 10) : '',
                    status: data.TrangThai || 'Đã đăng'
                });
                const nextRich = {
                    description: data.MoTa || '',
                    requirements: data.YeuCau || '',
                    benefits: data.QuyenLoi || ''
                };
                setRichValues(nextRich);

                setEditorTitles({
                    description: normalizeHeading(
                        data.sectionTitles?.description
                        ?? data.descriptionTitle
                        ?? data.moTaTieuDe,
                        'Mô tả công việc'
                    ),
                    requirements: normalizeHeading(
                        data.sectionTitles?.requirements
                        ?? data.requirementsTitle
                        ?? data.yeuCauTieuDe,
                        'Yêu cầu'
                    ),
                    benefits: normalizeHeading(
                        data.sectionTitles?.benefits
                        ?? data.benefitsTitle
                        ?? data.quyenLoiTieuDe,
                        'Quyền lợi'
                    )
                });

                const nextExtraSections = parseExtraSectionsPayload(
                    data.extraSections
                    ?? data.ExtraSections
                    ?? data.ExtraSectionsJson
                    ?? data.MucBoSung
                    ?? data.MucBoSungJson
                ).map((section) => {
                    const nextId = extraSectionIdRef.current;
                    extraSectionIdRef.current += 1;
                    return {
                        id: nextId,
                        title: section.title,
                        content: section.content
                    };
                });

                setExtraSections(nextExtraSections);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Có lỗi khi tải tin.');
            } finally {
                if (!cancelled) setLoadingJob(false);
            }
        };
        loadJob();
        return () => { cancelled = true; };
    }, [isEdit, jobId, token]);

    useEffect(() => {
        if (!showLocationModal) return undefined;
        if (typeof document === 'undefined') return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [showLocationModal]);

    const submitJob = async () => {
        setSubmitting(true);
        try {
            const payloadExtraSections = extraSections.map((section) => ({
                title: String(section.title || '').trim(),
                content: String(section.content || '')
            }));

            const payloadSectionTitles = {
                description: normalizeHeading(editorTitles.description, 'Mô tả công việc'),
                requirements: normalizeHeading(editorTitles.requirements, 'Yêu cầu'),
                benefits: normalizeHeading(editorTitles.benefits, 'Quyền lợi')
            };

            const res = await fetch(isEdit ? `/jobs/${jobId}` : '/jobs', {
                method: isEdit ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...form,
                    description: richValues.description,
                    requirements: richValues.requirements,
                    benefits: richValues.benefits,
                    sectionTitles: payloadSectionTitles,
                    descriptionTitle: payloadSectionTitles.description,
                    requirementsTitle: payloadSectionTitles.requirements,
                    benefitsTitle: payloadSectionTitles.benefits,
                    extraSections: payloadExtraSections,
                    salaryFrom: form.salaryFrom === '' ? null : Math.min(MAX_VND_SALARY, Number(digitsOnly(form.salaryFrom))),
                    salaryTo: form.salaryTo === '' ? null : Math.min(MAX_VND_SALARY, Number(digitsOnly(form.salaryTo)))
                })
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Đăng tin thất bại.');
            }

            navigate('/employer/jobs', {
                state: {
                    flash: isEdit ? 'Cập nhật tin tuyển dụng thành công!' : 'Đăng tin tuyển dụng thành công!'
                }
            });
        } catch (err) {
            setError(err.message || 'Có lỗi xảy ra.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (loadingJob || submitting) return;
        setError('');

        if (!form.title.trim()) {
            setError('Vui lòng nhập tiêu đề tin tuyển dụng.');
            return;
        }
        if (!token) {
            setError('Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.');
            return;
        }

        setLocationModalError('');
        setShowLocationModal(true);
    };

    const handleConfirmLocationSubmit = async () => {
        if (loadingJob || submitting) return;

        const locationText = String(form.location || '').trim();
        const cityText = String(form.city || '').trim();

        if (!locationText) {
            setLocationModalError('Vui lòng nhập địa điểm làm việc.');
            return;
        }

        if (!cityText) {
            setLocationModalError('Vui lòng chọn tỉnh/thành phố.');
            return;
        }

        setLocationModalError('');
        setShowLocationModal(false);
        await submitJob();
    };

    return (
        <div className="job-create-page">
            <div className="job-create-shell">
                <div className="d-flex justify-content-between align-items-center mb-4 job-create-header">
                    <div>
                        <h2 className="mb-0 employer-page-title">{isEdit ? 'Chỉnh sửa tin tuyển dụng' : 'Đăng tin tuyển dụng'}</h2>
                    </div>
                    <button
                        type="button"
                        className="btn job-create-back-btn"
                        onClick={() => navigate('/employer/jobs')}
                    >
                        Quay lại
                    </button>
                </div>

                <div className="card border-0 shadow-sm job-create-card">
                    <div className="card-body job-create-card-body">
                    {error && (
                        <div className="alert alert-danger" role="alert">
                            {error}
                        </div>
                    )}

                    {loadingJob && (
                        <p className="text-muted">Đang tải tin tuyển dụng...</p>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="row g-3">
                            <div className="col-12">
                                <label className="form-label">Tiêu đề *</label>
                                <input
                                    className="form-control"
                                    value={form.title}
                                    onChange={setField('title')}
                                    placeholder="VD: Nhân viên Kinh doanh, Backend Developer..."
                                />
                            </div>

                            <div className="col-12">
                                <input
                                    className="form-control job-create-section-heading-input"
                                    value={editorTitles.description}
                                    onChange={setEditorTitle('description')}
                                    placeholder="Mô tả công việc"
                                    disabled={submitting || loadingJob}
                                />
                                <CareerRichTextEditor
                                    value={richValues.description}
                                    onChange={setRichField('description')}
                                    placeholder="Nhập mô tả công việc..."
                                    minHeight={180}
                                    toolbarMode="word-basic"
                                    className="job-create-career-editor"
                                />
                            </div>

                            <div className="col-12">
                                <input
                                    className="form-control job-create-section-heading-input"
                                    value={editorTitles.requirements}
                                    onChange={setEditorTitle('requirements')}
                                    placeholder="Yêu cầu"
                                    disabled={submitting || loadingJob}
                                />
                                <CareerRichTextEditor
                                    value={richValues.requirements}
                                    onChange={setRichField('requirements')}
                                    placeholder="Nhập yêu cầu ứng viên..."
                                    minHeight={180}
                                    toolbarMode="word-basic"
                                    className="job-create-career-editor"
                                />
                            </div>

                            <div className="col-12">
                                <input
                                    className="form-control job-create-section-heading-input"
                                    value={editorTitles.benefits}
                                    onChange={setEditorTitle('benefits')}
                                    placeholder="Quyền lợi"
                                    disabled={submitting || loadingJob}
                                />
                                <CareerRichTextEditor
                                    value={richValues.benefits}
                                    onChange={setRichField('benefits')}
                                    placeholder="Nhập quyền lợi..."
                                    minHeight={170}
                                    toolbarMode="word-basic"
                                    className="job-create-career-editor"
                                />
                            </div>

                            <div className="col-12">
                                <div className="job-create-extra-sections-wrap">
                                    {extraSections.map((section) => (
                                        <div key={section.id} className="card border-0 shadow-sm job-create-card job-create-extra-card">
                                            <div className="card-body job-create-extra-card-body">
                                                <div className="job-create-extra-card-head">
                                                    <button
                                                        type="button"
                                                        className="btn job-create-extra-remove-btn"
                                                        onClick={() => removeExtraSection(section.id)}
                                                        disabled={submitting || loadingJob}
                                                    >
                                                        Xóa
                                                    </button>
                                                </div>

                                                <div className="mb-3">
                                                    <input
                                                        className="form-control job-create-extra-title-input"
                                                        value={section.title}
                                                        onChange={(event) => updateExtraSection(section.id, 'title', event.target.value)}
                                                        placeholder="Tên mục..."
                                                        disabled={submitting || loadingJob}
                                                    />
                                                </div>

                                                <CareerRichTextEditor
                                                    value={section.content}
                                                    onChange={(html) => updateExtraSection(section.id, 'content', html)}
                                                    placeholder="Nhập nội dung..."
                                                    minHeight={160}
                                                    toolbarMode="word-basic"
                                                    className="job-create-career-editor"
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    <div className="job-create-extra-add-wrap">
                                        <button
                                            type="button"
                                            className="btn job-create-cancel-btn job-create-extra-add-btn"
                                            onClick={addExtraSection}
                                            disabled={submitting || loadingJob}
                                        >
                                            + Thêm mục
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="col-12 d-flex gap-2 justify-content-end pt-2">
                                <button
                                    type="button"
                                    className="btn job-create-cancel-btn"
                                    onClick={() => navigate('/employer/jobs')}
                                    disabled={submitting}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="btn job-create-submit-btn"
                                    disabled={submitting || loadingJob}
                                >
                                    {submitting ? (isEdit ? 'Đang lưu...' : 'Đang đăng...') : (isEdit ? 'Lưu thay đổi' : 'Đăng tin')}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {showLocationModal && typeof document !== 'undefined' ? createPortal(
                <div
                    className="job-create-location-modal-backdrop"
                    role="presentation"
                    onClick={() => {
                        if (submitting) return;
                        setShowLocationModal(false);
                    }}
                >
                    <div
                        className="job-create-location-modal card border-0 shadow-sm job-create-card"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="job-create-location-modal-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="job-create-location-modal-header">
                            <div>
                                <h5 id="job-create-location-modal-title" className="mb-1">Thông tin trước khi đăng tin</h5>
                                <p className="mb-0 text-muted small">Hoàn tất địa điểm, mức lương và tiêu chí tuyển dụng trước khi {isEdit ? 'lưu thay đổi' : 'đăng tin'}.</p>
                            </div>
                            <button
                                type="button"
                                className="btn job-create-location-close-btn"
                                onClick={() => setShowLocationModal(false)}
                                disabled={submitting}
                                aria-label="Đóng modal"
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>

                        <div className="job-create-location-modal-body">
                            {locationModalError ? (
                                <div className="alert alert-danger mb-3" role="alert">
                                    {locationModalError}
                                </div>
                            ) : null}

                            <div className="job-create-modal-section">
                                <h6 className="job-create-location-section-title">Địa điểm làm việc</h6>
                                <div className="row g-3 align-items-end">
                                    <div className="col-md-6">
                                        <label className="form-label">Địa điểm</label>
                                        <input
                                            className="form-control"
                                            value={form.location}
                                            onChange={setField('location')}
                                            placeholder="VD: Quận 1, 123 Nguyễn Huệ..."
                                            disabled={submitting || loadingJob}
                                        />
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label">Thành phố</label>
                                        <JobsStyleSelect
                                            value={form.city}
                                            options={provinces}
                                            onChange={setField('city')}
                                            placeholder={loadingProvinces ? 'Đang tải tỉnh/thành...' : 'Chọn tỉnh/thành'}
                                            searchable
                                            searchPlaceholder="Nhập để tìm tỉnh/thành"
                                            locationMode
                                            emptyText="Không tìm thấy tỉnh/thành phù hợp"
                                            disabled={loadingProvinces || submitting || loadingJob}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="job-create-modal-section">
                                <h6 className="job-create-location-section-title">Mức lương</h6>
                                <div className="row g-3 align-items-end">
                                    <div className="col-md-3">
                                        <label className="form-label">Lương từ</label>
                                        <input
                                            className="form-control"
                                            inputMode="numeric"
                                            value={salaryDisplayValue(form.salaryFrom)}
                                            onChange={setSalaryField('salaryFrom')}
                                            placeholder={salaryCurrency === 'USD' ? 'VD: 1.000' : 'VD: 10.000.000'}
                                            disabled={submitting || loadingJob}
                                        />
                                    </div>

                                    <div className="col-md-3">
                                        <label className="form-label">Lương đến</label>
                                        <input
                                            className="form-control"
                                            inputMode="numeric"
                                            value={salaryDisplayValue(form.salaryTo)}
                                            onChange={setSalaryField('salaryTo')}
                                            placeholder={salaryCurrency === 'USD' ? 'VD: 2.000' : 'VD: 30.000.000'}
                                            disabled={submitting || loadingJob}
                                        />
                                    </div>

                                    <div className="col-md-2">
                                        <label className="form-label">Tiền tệ</label>
                                        <JobsStyleSelect
                                            value={salaryCurrency}
                                            options={['VND', 'USD']}
                                            onChange={setSalaryCurrency}
                                            disabled={submitting || loadingJob}
                                        />
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label">Kiểu lương</label>
                                        <JobsStyleSelect
                                            value={form.salaryType}
                                            options={salaryTypes}
                                            onChange={setField('salaryType')}
                                            disabled={submitting || loadingJob}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="job-create-modal-section">
                                <h6 className="job-create-location-section-title">Tiêu chí tuyển dụng</h6>
                                <div className="row g-3 align-items-end">
                                    <div className="col-md-4">
                                        <label className="form-label">Kinh nghiệm</label>
                                        <JobsStyleSelect
                                            value={form.experience}
                                            options={experienceOptions}
                                            onChange={setField('experience')}
                                            disabled={submitting || loadingJob}
                                        />
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label">Cấp bậc</label>
                                        <JobsStyleSelect
                                            value={form.level}
                                            options={levelOptions}
                                            onChange={setField('level')}
                                            disabled={submitting || loadingJob}
                                        />
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label">Lĩnh vực công việc</label>
                                        <JobsStyleSelect
                                            value={form.jobField}
                                            options={jobFieldOptions}
                                            onChange={setField('jobField')}
                                            searchable
                                            searchPlaceholder="Nhập để tìm lĩnh vực"
                                            emptyText="Không tìm thấy lĩnh vực phù hợp"
                                            disabled={submitting || loadingJob}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="job-create-modal-section">
                                <h6 className="job-create-location-section-title">Thiết lập đăng tin</h6>
                                <div className="row g-3 align-items-end">
                                    <div className="col-md-4">
                                        <label className="form-label">Hình thức</label>
                                        <JobsStyleSelect
                                            value={form.employmentType}
                                            options={employmentTypes}
                                            onChange={setField('employmentType')}
                                            disabled={submitting || loadingJob}
                                        />
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label">Trạng thái</label>
                                        <JobsStyleSelect
                                            value={form.status}
                                            options={statuses}
                                            onChange={setField('status')}
                                            disabled={submitting || loadingJob}
                                        />
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label">Hạn nộp hồ sơ</label>
                                        <DeadlineDateField
                                            value={form.deadline}
                                            onChange={setField('deadline')}
                                            disabled={submitting || loadingJob}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="job-create-location-modal-footer">
                            <button
                                type="button"
                                className="btn job-create-cancel-btn"
                                onClick={() => setShowLocationModal(false)}
                                disabled={submitting}
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                className="btn job-create-submit-btn"
                                onClick={handleConfirmLocationSubmit}
                                disabled={submitting || loadingJob}
                            >
                                {submitting ? (isEdit ? 'Đang lưu...' : 'Đang đăng...') : (isEdit ? 'Xác nhận & Lưu thay đổi' : 'Xác nhận & Đăng tin')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            ) : null}
        </div>
        </div>
    );
};

export default JobCreate;