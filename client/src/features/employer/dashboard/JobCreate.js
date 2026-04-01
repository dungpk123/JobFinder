import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const RichTextField = ({ label, onChange, rows = 4, placeholder, value = '' }) => {
    const editorRef = useRef(null);
    const selectionRef = useRef(null);

    // Keep editor content in sync when value changes (e.g., when loading existing job)
    useEffect(() => {
        if (editorRef.current && typeof value === 'string') {
            editorRef.current.innerHTML = value;
        }
    }, [value]);

    const saveSelection = () => {
        const editor = editorRef.current;
        if (!editor) return;

        const selection = window.getSelection?.();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const anchorNode = selection.anchorNode;

        // Only save if selection/caret is inside this editor
        if (anchorNode && editor.contains(anchorNode)) {
            selectionRef.current = range;
        }
    };

    const restoreSelection = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const range = selectionRef.current;
        if (!range) return;

        const selection = window.getSelection?.();
        if (!selection) return;
        selection.removeAllRanges();
        selection.addRange(range);
    };

    const applyCommand = (command) => {
        // Selection-first: user highlights text, then clicks toolbar.
        // Restore selection because toolbar click can steal focus.
        editorRef.current?.focus();
        restoreSelection();
        // execCommand is deprecated but widely supported and sufficient for this simple use.
        document.execCommand(command, false, null);
        onChange(editorRef.current?.innerHTML || '');
        saveSelection();
    };

    const minHeight = Math.max(96, rows * 24);

    return (
        <div className="col-12">
            <label className="form-label">{label}</label>
            <div className="d-flex align-items-center gap-2 mb-2">
                <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyCommand('bold')}
                    title="In đậm"
                >
                    <strong>B</strong>
                </button>
                <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyCommand('italic')}
                    title="In nghiêng"
                >
                    <em>I</em>
                </button>
                <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyCommand('insertUnorderedList')}
                    title="Gạch đầu dòng"
                >
                    •
                </button>
                <small className="text-muted ms-2">Bôi đen đoạn cần định dạng rồi bấm nút</small>
            </div>
            <div
                ref={editorRef}
                className="form-control job-create-editor"
                contentEditable
                suppressContentEditableWarning
                onFocus={saveSelection}
                onKeyUp={saveSelection}
                onMouseUp={saveSelection}
                onInput={(e) => {
                    onChange(e.currentTarget.innerHTML);
                    saveSelection();
                }}
                onBlur={(e) => {
                    onChange(e.currentTarget.innerHTML);
                    saveSelection();
                }}
                data-placeholder={placeholder || ''}
                style={{ minHeight, whiteSpace: 'pre-wrap', overflowY: 'auto', textAlign: 'left' }}
            />
            {/* Simple placeholder for contentEditable */}
            <style>{`
                [data-placeholder]:empty:before {
                    content: attr(data-placeholder);
                    color: #6c757d;
                }
            `}</style>
        </div>
    );
};

const USD_TO_VND_RATE = 25000;

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

    if (currency === 'USD') {
        const vnd = Math.round(value * USD_TO_VND_RATE);
        return String(Math.max(0, vnd));
    }

    return String(Math.max(0, Math.round(value)));
};

const JobCreate = () => {
    const navigate = useNavigate();
    const { id: jobId } = useParams();
    const token = useMemo(() => localStorage.getItem('token') || '', []);
    const isEdit = Boolean(jobId);

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
    const [richValues, setRichValues] = useState({ description: '', requirements: '', benefits: '' });

    // Store rich text HTML without re-rendering the editor on every keystroke
    const richRef = useRef({
        description: '',
        requirements: '',
        benefits: ''
    });

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Fetch provinces on component mount
    useEffect(() => {
        const fetchProvinces = async () => {
            setLoadingProvinces(true);
            try {
                const res = await fetch('/api/provinces');
                if (res.ok) {
                    const data = await res.json();
                    setProvinces(data);
                }
            } catch (err) {
                console.error('Error fetching provinces:', err);
            } finally {
                setLoadingProvinces(false);
            }
        };
        fetchProvinces();
    }, []);

    const setField = (key) => (e) => {
        setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

    const setRichField = (key) => (html) => {
        richRef.current[key] = html;
        setRichValues((prev) => ({ ...prev, [key]: html }));
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
                richRef.current = nextRich;
                setRichValues(nextRich);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Có lỗi khi tải tin.');
            } finally {
                if (!cancelled) setLoadingJob(false);
            }
        };
        loadJob();
        return () => { cancelled = true; };
    }, [isEdit, jobId, token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loadingJob) return;
        setError('');

        if (!form.title.trim()) {
            setError('Vui lòng nhập tiêu đề tin tuyển dụng.');
            return;
        }
        if (!token) {
            setError('Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(isEdit ? `/jobs/${jobId}` : '/jobs', {
                method: isEdit ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...form,
                    description: richRef.current.description,
                    requirements: richRef.current.requirements,
                    benefits: richRef.current.benefits,
                    salaryFrom: form.salaryFrom === '' ? null : Number(digitsOnly(form.salaryFrom)),
                    salaryTo: form.salaryTo === '' ? null : Number(digitsOnly(form.salaryTo))
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

    return (
        <div className="job-create-page">
            <div className="job-create-shell">
                <div className="d-flex justify-content-between align-items-center mb-4 job-create-header">
                    <div>
                        <h2 className="mb-0">{isEdit ? 'Chỉnh sửa tin tuyển dụng' : 'Đăng tin tuyển dụng'}</h2>
                    </div>
                    <button
                        type="button"
                        className="btn btn-outline-secondary"
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

                            <RichTextField
                                label="Mô tả công việc"
                                onChange={setRichField('description')}
                                value={richValues.description}
                                rows={6}
                                placeholder="Nhập mô tả công việc..."
                            />

                            <RichTextField
                                label="Yêu cầu"
                                onChange={setRichField('requirements')}
                                value={richValues.requirements}
                                rows={6}
                                placeholder="Nhập yêu cầu ứng viên..."
                            />

                            <RichTextField
                                label="Quyền lợi"
                                onChange={setRichField('benefits')}
                                value={richValues.benefits}
                                rows={5}
                                placeholder="Nhập quyền lợi..."
                            />

                            <div className="col-12">
                                <div className="row g-3 align-items-end">
                                    <div className="col-md-6">
                                        <label className="form-label">Địa điểm</label>
                                        <input
                                            className="form-control"
                                            value={form.location}
                                            onChange={setField('location')}
                                            placeholder="VD: Quận 1, 123 Nguyễn Huệ..."
                                        />
                                    </div>

                                    <div className="col-md-6">
                                        <label className="form-label">Thành phố</label>
                                        <input
                                            className="form-control"
                                            list="province-list"
                                            value={form.city}
                                            onChange={setField('city')}
                                            placeholder={loadingProvinces ? 'Đang tải danh sách tỉnh/thành...' : 'Gõ để tìm tỉnh/thành...'}
                                            disabled={loadingProvinces}
                                        />
                                        <datalist id="province-list">
                                            {provinces.map((province) => (
                                                <option key={province} value={province} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                            </div>

                            <div className="col-12">
                                <div className="row g-3 align-items-end">
                                    <div className="col-md-3">
                                        <label className="form-label">Lương từ</label>
                                        <input
                                            className="form-control"
                                            inputMode="numeric"
                                            value={salaryDisplayValue(form.salaryFrom)}
                                            onChange={setSalaryField('salaryFrom')}
                                            placeholder={salaryCurrency === 'USD' ? 'VD: 1.000' : 'VD: 10.000.000'}
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
                                        />
                                    </div>

                                    <div className="col-md-2">
                                        <label className="form-label">Tiền tệ</label>
                                        <select
                                            className="form-select"
                                            value={salaryCurrency}
                                            onChange={(e) => setSalaryCurrency(e.target.value)}
                                        >
                                            <option value="VND">VND</option>
                                            <option value="USD">USD</option>
                                        </select>
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label">Kiểu lương</label>
                                        <select
                                            className="form-select"
                                            value={form.salaryType}
                                            onChange={setField('salaryType')}
                                        >
                                            {salaryTypes.map((t) => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="col-12">
                                <div className="row g-3 align-items-end">
                                    <div className="col-md-4">
                                        <label className="form-label">Kinh nghiệm</label>
                                        <select
                                            className="form-select"
                                            value={form.experience}
                                            onChange={setField('experience')}
                                        >
                                            {experienceOptions.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label">Cấp bậc</label>
                                        <select
                                            className="form-select"
                                            value={form.level}
                                            onChange={setField('level')}
                                        >
                                            {levelOptions.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label">Lĩnh vực công việc</label>
                                        <select
                                            className="form-select"
                                            value={form.jobField}
                                            onChange={setField('jobField')}
                                        >
                                            {jobFieldOptions.map((opt) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="col-12">
                                <div className="row g-3 align-items-end">
                                    <div className="col-md-4">
                                        <label className="form-label">Hình thức</label>
                                        <select
                                            className="form-select"
                                            value={form.employmentType}
                                            onChange={setField('employmentType')}
                                        >
                                            {employmentTypes.map((t) => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label">Trạng thái</label>
                                        <select
                                            className="form-select"
                                            value={form.status}
                                            onChange={setField('status')}
                                        >
                                            {statuses.map((s) => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-md-4">
                                        <label className="form-label">Hạn nộp hồ sơ</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={form.deadline}
                                            onChange={setField('deadline')}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="col-12 d-flex gap-2 justify-content-end pt-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => navigate('/employer/jobs')}
                                    disabled={submitting}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={submitting || loadingJob}
                                >
                                    {submitting ? (isEdit ? 'Đang lưu...' : 'Đang đăng...') : (isEdit ? 'Lưu thay đổi' : 'Đăng tin')}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
        </div>
    );
};

export default JobCreate;