import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, PencilLine, Trash2 } from 'lucide-react';
import './AdminTemplateManager.css';

const EMPTY_TEMPLATE_FORM = {
    MaTemplateCV: null,
    TenTemplate: '',
    Slug: '',
    MoTa: '',
    ThumbnailUrl: '',
    HtmlContent: '',
    TrangThai: 1,
    NgayTao: '',
    NgayCapNhat: ''
};

const slugify = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const normalizeTemplate = (template) => ({
    MaTemplateCV: Number(template?.MaTemplateCV || template?.id || 0) || null,
    TenTemplate: String(template?.TenTemplate || template?.name || ''),
    Slug: String(template?.Slug || template?.slug || ''),
    MoTa: String(template?.MoTa || template?.description || ''),
    ThumbnailUrl: String(template?.ThumbnailUrl || template?.thumbnailUrl || template?.thumbnail_url || ''),
    HtmlContent: String(template?.HtmlContent || template?.htmlContent || ''),
    TrangThai: Number(template?.TrangThai ?? template?.status ?? 1) === 0 ? 0 : 1,
    NgayTao: String(template?.NgayTao || template?.createdAt || ''),
    NgayCapNhat: String(template?.NgayCapNhat || template?.updatedAt || '')
});

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('vi-VN');
};

const AdminTemplateManager = ({ API_BASE, authHeaders, requestConfirm, mode = 'list' }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const isCreateMode = mode === 'create';
    const isListMode = !isCreateMode;

    const templateIdFromQuery = useMemo(() => {
        if (!isCreateMode) return null;
        const params = new URLSearchParams(location.search || '');
        const parsed = Number(params.get('templateId') || 0);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }, [isCreateMode, location.search]);

    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [workingTemplateId, setWorkingTemplateId] = useState(null);

    const [searchInput, setSearchInput] = useState('');
    const [searchText, setSearchText] = useState('');

    const [editorTab, setEditorTab] = useState('basic');
    const [quickPreview, setQuickPreview] = useState(false);
    const [form, setForm] = useState(EMPTY_TEMPLATE_FORM);
    const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
    const [thumbnailInputKey, setThumbnailInputKey] = useState(0);

    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [successToast, setSuccessToast] = useState({
        open: false,
        text: ''
    });
    const successToastTimerRef = useRef(null);

    const [modalPreview, setModalPreview] = useState({
        open: false,
        title: '',
        html: ''
    });

    const endpoint = useMemo(() => `${API_BASE}/api/admin/templates`, [API_BASE]);
    const authAuthorization = useMemo(() => String(authHeaders?.Authorization || ''), [authHeaders]);

    const showSuccessToast = (text) => {
        if (successToastTimerRef.current) {
            clearTimeout(successToastTimerRef.current);
        }

        setSuccessToast({
            open: true,
            text: String(text || '').trim()
        });

        successToastTimerRef.current = window.setTimeout(() => {
            setSuccessToast((prev) => ({
                ...prev,
                open: false
            }));
            successToastTimerRef.current = null;
        }, 2600);
    };

    useEffect(() => () => {
        if (successToastTimerRef.current) {
            clearTimeout(successToastTimerRef.current);
            successToastTimerRef.current = null;
        }
    }, []);

    const forceReLogin = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login', { replace: true });
    };

    const fetchJson = async (url, options = {}) => {
        const res = await fetch(url, options);
        const data = await res.json().catch(() => null);

        if (!res.ok && [401, 403].includes(res.status)) {
            const message = String(data?.error || data?.message || '').trim();
            if (/token|access token|expired|insufficient permissions/i.test(message)) {
                forceReLogin();
                throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            }
        }

        if (!res.ok || !data?.success) {
            throw new Error(data?.error || 'Không thể xử lý yêu cầu');
        }
        return data;
    };

    const loadTemplates = async (nextSearch = searchText) => {
        setLoading(true);
        setError('');

        try {
            const query = new URLSearchParams({ limit: '100', offset: '0' });
            if (nextSearch) query.set('search', nextSearch);

            const data = await fetchJson(`${endpoint}?${query.toString()}`, {
                headers: authHeaders
            });

            const rows = Array.isArray(data?.templates) ? data.templates : [];
            setTemplates(rows.map(normalizeTemplate));
        } catch (err) {
            setError(err?.message || 'Không tải được danh sách template');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isListMode) return;
        loadTemplates('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [endpoint, isListMode]);

    const resetEditor = () => {
        setForm(EMPTY_TEMPLATE_FORM);
        setEditorTab('basic');
        setQuickPreview(false);
        setError('');
        setMessage('');

        if (isCreateMode && location.search) {
            navigate('/admin/templates/create', { replace: true });
        }
    };

    const goToCreatePage = (templateId = null) => {
        const query = templateId ? `?templateId=${templateId}` : '';
        navigate(`/admin/templates/create${query}`);
    };

    const loadTemplateById = async (id) => {
        const data = await fetchJson(`${endpoint}/${id}`, {
            headers: authHeaders
        });
        return normalizeTemplate(data.template || {});
    };

    const handleEdit = async (id) => {
        setWorkingTemplateId(id);
        setError('');
        setMessage('');

        try {
            const detail = await loadTemplateById(id);
            setForm(detail);
            setEditorTab('basic');
            setQuickPreview(false);
        } catch (err) {
            setError(err?.message || 'Không tải được chi tiết template');
        } finally {
            setWorkingTemplateId(null);
        }
    };

    useEffect(() => {
        if (!isCreateMode) return;

        if (!templateIdFromQuery) {
            setForm(EMPTY_TEMPLATE_FORM);
            setEditorTab('basic');
            setQuickPreview(false);
            return;
        }

        handleEdit(templateIdFromQuery);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCreateMode, templateIdFromQuery]);

    const handleOpenPreview = async (id) => {
        setWorkingTemplateId(id);
        setError('');

        try {
            const detail = await loadTemplateById(id);
            setModalPreview({
                open: true,
                title: detail.TenTemplate || 'Preview template',
                html: detail.HtmlContent || ''
            });
        } catch (err) {
            setError(err?.message || 'Không mở được preview');
        } finally {
            setWorkingTemplateId(null);
        }
    };

    const handleDelete = async (template) => {
        const templateName = template?.TenTemplate || '';
        const confirmMessage = `Bạn có chắc muốn xóa template "${templateName}"?`;

        const approved = requestConfirm
            ? await requestConfirm({
                title: 'Xác nhận xóa template',
                message: confirmMessage,
                confirmText: 'Xóa'
            })
            : window.confirm(confirmMessage);

        if (!approved) return;

        setWorkingTemplateId(template.MaTemplateCV);
        setError('');
        setMessage('');

        try {
            await fetchJson(`${endpoint}/${template.MaTemplateCV}`, {
                method: 'DELETE',
                headers: authHeaders
            });

            if (Number(form.MaTemplateCV) === Number(template.MaTemplateCV)) {
                resetEditor();
            }

            setMessage('Đã xóa template thành công.');
            await loadTemplates(searchText);
        } catch (err) {
            setError(err?.message || 'Không xóa được template');
        } finally {
            setWorkingTemplateId(null);
        }
    };

    const handleFormChange = (key, value) => {
        setForm((prev) => ({
            ...prev,
            [key]: value
        }));
    };

    useEffect(() => {
        if (!isCreateMode) return;
        const generatedSlug = slugify(form.TenTemplate || '');
        setForm((prev) => {
            if (prev.Slug === generatedSlug) return prev;
            return {
                ...prev,
                Slug: generatedSlug
            };
        });
    }, [form.TenTemplate, isCreateMode]);

    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        const nextSearch = searchInput.trim();
        setSearchText(nextSearch);
        await loadTemplates(nextSearch);
    };

    const handleClearSearch = async () => {
        setSearchInput('');
        setSearchText('');
        await loadTemplates('');
    };

    const handlePickThumbnail = () => {
        const input = document.getElementById('admin-template-thumbnail-input');
        if (input) input.click();
    };

    const handleThumbnailSelected = async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        if (!String(file.type || '').startsWith('image/')) {
            setError('Chỉ chấp nhận file ảnh cho thumbnail.');
            setThumbnailInputKey((prev) => prev + 1);
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setError('Kích thước ảnh thumbnail không vượt quá 2MB.');
            setThumbnailInputKey((prev) => prev + 1);
            return;
        }

        if (!authAuthorization) {
            setError('Không tìm thấy token đăng nhập. Vui lòng đăng nhập lại.');
            setThumbnailInputKey((prev) => prev + 1);
            return;
        }

        setUploadingThumbnail(true);
        setError('');

        try {
            const body = new FormData();
            body.append('thumbnail', file);

            const res = await fetch(`${endpoint}/upload-thumbnail`, {
                method: 'POST',
                headers: {
                    Authorization: authAuthorization
                },
                body
            });

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) {
                throw new Error(data?.error || 'Không thể tải thumbnail lên .');
            }

            const nextUrl = String(data?.thumbnailUrl || data?.thumbnailAbsoluteUrl || '').trim();
            if (!nextUrl) {
                throw new Error(' không trả về URL thumbnail hợp lệ.');
            }

            setForm((prev) => ({
                ...prev,
                ThumbnailUrl: nextUrl
            }));
            setMessage('Đã tải thumbnail lên  thành công.');
        } catch (err) {
            setError(err?.message || 'Không thể tải thumbnail lên .');
        } finally {
            setUploadingThumbnail(false);
            setThumbnailInputKey((prev) => prev + 1);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setMessage('');

        try {
            const payload = {
                name: String(form.TenTemplate || '').trim(),
                slug: slugify(form.Slug || form.TenTemplate),
                description: String(form.MoTa || '').trim(),
                thumbnailUrl: String(form.ThumbnailUrl || '').trim(),
                htmlContent: String(form.HtmlContent || ''),
                status: Number(form.TrangThai) === 0 ? 0 : 1
            };

            if (!payload.name) {
                throw new Error('Tên template là bắt buộc.');
            }
            if (!payload.slug) {
                throw new Error('Slug không hợp lệ.');
            }
            if (!payload.htmlContent.trim()) {
                throw new Error('HTML content là bắt buộc.');
            }

            const isEditing = !!form.MaTemplateCV;
            const url = isEditing ? `${endpoint}/${form.MaTemplateCV}` : endpoint;
            const method = isEditing ? 'PATCH' : 'POST';

            const data = await fetchJson(url, {
                method,
                headers: {
                    ...authHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const savedTemplate = normalizeTemplate(data.template || {});
            setEditorTab('basic');
            setQuickPreview(false);

            if (isEditing) {
                setForm(savedTemplate);
                showSuccessToast('Cập nhật template thành công.');
            } else {
                setForm(EMPTY_TEMPLATE_FORM);
                setThumbnailInputKey((prev) => prev + 1);
                showSuccessToast('Tạo template thành công.');
            }

            if (isListMode) {
                await loadTemplates(searchText);
            }
        } catch (err) {
            setError(err?.message || 'Không lưu được template');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="row g-4 admin-template-section">
            {isListMode && (
                <div className="col-12 admin-template-pane">
                    <div className="card border-0 shadow-sm h-100">
                        <div className="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0">
                                <i className="bi bi-collection me-2"></i>
                                Danh sách template CV
                            </h5>
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => goToCreatePage()}>
                                <i className="bi bi-plus-lg me-1"></i>
                                Tạo template mới
                            </button>
                        </div>

                        <div className="card-body pt-0">
                            {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
                            {message && <div className="alert alert-success mt-3 mb-0">{message}</div>}

                            <form className="admin-template-search mt-3" onSubmit={handleSearchSubmit}>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Tìm theo tên hoặc slug..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                />
                                <button type="submit" className="btn btn-outline-primary">Tìm</button>
                                {(searchText || searchInput) && (
                                    <button type="button" className="btn btn-outline-secondary" onClick={handleClearSearch}>Xóa lọc</button>
                                )}
                            </form>

                            <div className="table-responsive admin-template-table-wrap mt-3">
                                <table className="table table-hover align-middle mb-0">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 72 }}>ID</th>
                                            <th>Tên template</th>
                                            <th style={{ width: 180 }}>Slug</th>
                                            <th style={{ width: 190 }}>Cập nhật</th>
                                            <th style={{ width: 230 }}>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {templates.map((template) => (
                                            <tr key={template.MaTemplateCV}>
                                                <td>{template.MaTemplateCV}</td>
                                                <td>
                                                    <div className="fw-semibold text-truncate" title={template.TenTemplate}>{template.TenTemplate}</div>
                                                    <div className="text-muted small text-truncate" title={template.MoTa || ''}>{template.MoTa || 'Không có mô tả'}</div>
                                                </td>
                                                <td><code>{template.Slug}</code></td>
                                                <td className="small text-muted">{formatDate(template.NgayCapNhat || template.NgayTao)}</td>
                                                <td>
                                                    <div className="d-flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-primary admin-action-icon-btn"
                                                            disabled={workingTemplateId === template.MaTemplateCV}
                                                            onClick={() => goToCreatePage(template.MaTemplateCV)}
                                                            title="Sửa template"
                                                            aria-label="Sửa template"
                                                        >
                                                            <PencilLine size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-info admin-action-icon-btn"
                                                            disabled={workingTemplateId === template.MaTemplateCV}
                                                            onClick={() => handleOpenPreview(template.MaTemplateCV)}
                                                            title="Xem template"
                                                            aria-label="Xem template"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger admin-action-icon-btn"
                                                            disabled={workingTemplateId === template.MaTemplateCV}
                                                            onClick={() => handleDelete(template)}
                                                            title="Xóa template"
                                                            aria-label="Xóa template"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {templates.length === 0 && !loading && (
                                            <tr>
                                                <td colSpan={5} className="text-center text-muted py-4">Chưa có template nào</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {loading && <div className="alert alert-info mt-3 mb-0">Đang tải danh sách template...</div>}
                        </div>
                    </div>
                </div>
            )}

            {isCreateMode && (
                <div className="col-12 admin-template-pane">
                    <div className="card border-0 shadow-sm h-100 admin-template-create-card">
                        <div className="card-header border-0 py-3 d-flex justify-content-between align-items-center flex-wrap gap-3 admin-template-create-header">
                            <div>
                                <h5 className="mb-1">
                                    <i className="bi bi-code-square me-2"></i>
                                    {form.MaTemplateCV ? `Chỉnh sửa template #${form.MaTemplateCV}` : 'Tạo template CV mới'}
                                </h5>
                                <p className="admin-template-create-subtitle mb-0">
                                    Thiết kế mẫu CV rõ ràng, đẹp mắt và sẵn sàng cho ứng viên sử dụng ngay.
                                </p>
                            </div>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => navigate('/admin/templates')}>
                                Tất cả template
                            </button>
                        </div>

                        <div className="card-body admin-template-create-body">
                            {!!templateIdFromQuery && workingTemplateId === templateIdFromQuery && (
                                <div className="alert alert-info">Đang tải chi tiết template...</div>
                            )}
                            {error && <div className="alert alert-danger">{error}</div>}
                            {message && <div className="alert alert-success">{message}</div>}

                            <form onSubmit={handleSubmit} className="admin-template-editor-form">
                                <ul className="nav nav-tabs admin-template-tabs mb-3" role="tablist">
                                    <li className="nav-item" role="presentation">
                                        <button type="button" className={`nav-link ${editorTab === 'basic' ? 'active' : ''}`} onClick={() => setEditorTab('basic')}>
                                            Thông tin cơ bản
                                        </button>
                                    </li>
                                    <li className="nav-item" role="presentation">
                                        <button type="button" className={`nav-link ${editorTab === 'html' ? 'active' : ''}`} onClick={() => setEditorTab('html')}>
                                            HTML & Design
                                        </button>
                                    </li>
                                    <li className="nav-item" role="presentation">
                                        <button type="button" className={`nav-link ${editorTab === 'preview' ? 'active' : ''}`} onClick={() => setEditorTab('preview')}>
                                            Xem trước
                                        </button>
                                    </li>
                                </ul>

                                {editorTab === 'basic' && (
                                    <div className="admin-template-basic-grid">
                                        <div>
                                            <label className="form-label">Tên template *</label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                value={form.TenTemplate}
                                                onChange={(e) => handleFormChange('TenTemplate', e.target.value)}
                                                placeholder="Ví dụ: CV Chuyên nghiệp xanh navy"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="form-label">Slug (URL) *</label>
                                            <div className="input-group">
                                                <input
                                                    type="text"
                                                    className="form-control"
                                                    value={form.Slug}
                                                    placeholder="cv-chuyen-nghiep-xanh-navy"
                                                    readOnly
                                                    required
                                                />
                                            </div>
                                            <small className="text-muted">Slug được tạo tự động theo tên template.</small>
                                        </div>

                                        <div>
                                            <label className="form-label">Trạng thái</label>
                                            <select
                                                className="form-select"
                                                value={Number(form.TrangThai) === 0 ? 0 : 1}
                                                onChange={(e) => handleFormChange('TrangThai', Number(e.target.value))}
                                            >
                                                <option value={1}>Hoạt động</option>
                                                <option value={0}>Tạm tắt</option>
                                            </select>
                                        </div>

                                        <div className="admin-template-basic-grid-full">
                                            <label className="form-label">Mô tả</label>
                                            <textarea
                                                className="form-control"
                                                rows={4}
                                                value={form.MoTa}
                                                onChange={(e) => handleFormChange('MoTa', e.target.value)}
                                                placeholder="Mô tả ngắn về template CV"
                                            />
                                        </div>

                                        <div className="admin-template-thumbnail-field admin-template-basic-grid-full">
                                            <label className="form-label">Thumbnail URL</label>
                                            <input
                                                type="url"
                                                className="form-control"
                                                value={form.ThumbnailUrl}
                                                onChange={(e) => handleFormChange('ThumbnailUrl', e.target.value)}
                                            />

                                            <div className="admin-template-thumbnail-actions mt-2">
                                                <input
                                                    key={thumbnailInputKey}
                                                    id="admin-template-thumbnail-input"
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    onChange={handleThumbnailSelected}
                                                />

                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary"
                                                    onClick={handlePickThumbnail}
                                                    disabled={saving || uploadingThumbnail}
                                                >
                                                    <i className="bi bi-upload me-2"></i>
                                                    {uploadingThumbnail ? 'Đang tải ảnh...' : 'Tải ảnh lên '}
                                                </button>

                                                {form.ThumbnailUrl && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-secondary"
                                                        disabled={saving || uploadingThumbnail}
                                                        onClick={() => handleFormChange('ThumbnailUrl', '')}
                                                    >
                                                        Xóa thumbnail
                                                    </button>
                                                )}
                                            </div>

                                            <small className="text-muted d-block mt-2">Chọn ảnh thumbnail trực tiếp từ máy của bạn.</small>

                                            {form.ThumbnailUrl ? (
                                                <div className="admin-template-thumbnail-preview mt-3">
                                                    <img src={form.ThumbnailUrl} alt="Template thumbnail" />
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                )}

                                {editorTab === 'html' && (
                                    <div>
                                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                                            <label className="form-label mb-0">HTML Content *</label>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary"
                                                onClick={() => setQuickPreview((prev) => !prev)}
                                            >
                                                {quickPreview ? 'Sửa code' : 'Xem Preview nhanh'}
                                            </button>
                                        </div>

                                        {!quickPreview ? (
                                            <textarea
                                                className="form-control admin-template-code-input"
                                                value={form.HtmlContent}
                                                onChange={(e) => handleFormChange('HtmlContent', e.target.value)}
                                                placeholder="<!doctype html>..."
                                                required
                                            />
                                        ) : (
                                            <div className="admin-template-preview-pane">
                                                {form.HtmlContent.trim() ? (
                                                    <iframe
                                                        title="Quick Preview"
                                                        srcDoc={form.HtmlContent}
                                                        className="admin-template-preview-frame"
                                                        sandbox="allow-scripts"
                                                    />
                                                ) : (
                                                    <div className="admin-template-preview-empty">Nhập HTML content để xem preview.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {editorTab === 'preview' && (
                                    <div className="admin-template-preview-pane">
                                        {form.HtmlContent.trim() ? (
                                            <iframe
                                                title="Template Preview"
                                                srcDoc={form.HtmlContent}
                                                className="admin-template-preview-frame preview-tab"
                                                sandbox="allow-scripts"
                                            />
                                        ) : (
                                            <div className="admin-template-preview-empty">Chưa có nội dung HTML để xem trước.</div>
                                        )}
                                    </div>
                                )}

                                <div className="admin-template-form-actions mt-4">
                                    <button type="submit" className="btn btn-primary admin-template-submit-btn" disabled={saving}>
                                        {saving
                                            ? (form.MaTemplateCV ? 'Đang cập nhật...' : 'Đang tạo...')
                                            : (form.MaTemplateCV ? 'Cập nhật template' : 'Tạo template')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {successToast.open && (
                <div className="admin-template-success-toast" role="status" aria-live="polite">
                    <div className="admin-template-success-toast-inner">
                        <i className="bi bi-check-circle-fill" aria-hidden="true"></i>
                        <span>{successToast.text}</span>
                    </div>
                </div>
            )}

            {modalPreview.open && (
                <div className="admin-template-preview-backdrop" role="dialog" aria-modal="true">
                    <div className="admin-template-preview-dialog card border-0 shadow-lg">
                        <div className="card-header bg-white d-flex justify-content-between align-items-center">
                            <h6 className="mb-0 text-truncate">Preview: {modalPreview.title}</h6>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setModalPreview({ open: false, title: '', html: '' })}>
                                Đóng
                            </button>
                        </div>
                        <div className="card-body p-0">
                            {modalPreview.html.trim() ? (
                                <iframe
                                    title="Template Modal Preview"
                                    srcDoc={modalPreview.html}
                                    className="admin-template-preview-frame modal-frame"
                                    sandbox="allow-scripts"
                                />
                            ) : (
                                <div className="admin-template-preview-empty">Template này chưa có nội dung HTML.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminTemplateManager;
