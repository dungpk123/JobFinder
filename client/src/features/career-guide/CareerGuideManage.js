import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import CareerRichTextEditor from './components/CareerRichTextEditor';
import {
  sanitizeCareerHtml,
  extractPlainText,
  buildCareerSlug,
  splitTags
} from './richTextUtils';
import './CareerGuideManage.css';

const CATEGORY_OPTIONS = [
  'CV & Hồ sơ',
  'Phỏng vấn',
  'Lương & đãi ngộ',
  'Định hướng nghề',
  'Kỹ năng làm việc'
];

const STATUS_OPTIONS = [
  { value: 'published', label: 'Công khai ngay' },
  { value: 'draft', label: 'Lưu nháp' }
];

const INITIAL_CONTENT = `
<h2>Mở đầu</h2>
<p>Hãy bắt đầu bài viết bằng một đoạn ngắn nêu vấn đề và bối cảnh thực tế.</p>
<h3>Ý chính 1</h3>
<p>Nội dung nên có ví dụ cụ thể và lời khuyên có thể áp dụng ngay.</p>
<h3>Kết luận</h3>
<p>Tóm tắt lại thông điệp chính và gợi ý hành động tiếp theo cho người đọc.</p>
`;

const MAX_COVER_IMAGE_SIZE = 5 * 1024 * 1024;

const INITIAL_FORM = {
  title: '',
  excerpt: '',
  category: CATEGORY_OPTIONS[0],
  tags: '',
  coverImage: '',
  status: STATUS_OPTIONS[0].value,
  content: INITIAL_CONTENT
};

const normalizeTagsForInput = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join(', ');
  }

  const asText = String(value || '').trim();
  if (!asText) return '';

  try {
    const parsed = JSON.parse(asText);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .join(', ');
    }
  } catch {
    // Keep raw string fallback for legacy formats.
  }

  return asText;
};

function CareerGuideManage() {
  const navigate = useNavigate();
  const location = useLocation();

  const editingPostId = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    const parsed = Number(params.get('postId') || 0);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [location.search]);

  const isEditMode = Boolean(editingPostId);

  const [form, setForm] = useState(INITIAL_FORM);
  const coverUploadInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [loadingExistingPost, setLoadingExistingPost] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const sanitizedContent = useMemo(
    () => sanitizeCareerHtml(form.content),
    [form.content]
  );

  const plainTextContent = useMemo(
    () => extractPlainText(form.content),
    [form.content]
  );

  const slugPreview = useMemo(
    () => buildCareerSlug(form.title),
    [form.title]
  );

  const tagList = useMemo(
    () => splitTags(form.tags),
    [form.tags]
  );

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
  };

  const handlePickCoverImage = () => {
    if (submitting || loadingExistingPost || coverUploading) return;
    coverUploadInputRef.current?.click();
  };

  const handleCoverImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const isImageType = String(file.type || '').toLowerCase().startsWith('image/');
    if (!isImageType) {
      setMessage({ type: 'error', text: 'Vui lòng chọn tệp ảnh hợp lệ (JPG, PNG, WebP, GIF).' });
      return;
    }

    if (file.size > MAX_COVER_IMAGE_SIZE) {
      setMessage({ type: 'error', text: 'Ảnh bìa vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.' });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setMessage({ type: 'error', text: 'Vui lòng đăng nhập lại để tải ảnh bìa.' });
      return;
    }

    try {
      setCoverUploading(true);
      setMessage({ type: '', text: '' });

      const formData = new FormData();
      formData.append('upload', file);

      const response = await fetch('/api/career-guide/upload-image?usage=cover', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể tải ảnh bìa lên lúc này.');
      }

      const uploadedUrl = String(data.absoluteUrl || data.url || '').trim();
      if (!uploadedUrl) {
        throw new Error('Server chưa trả về URL ảnh bìa hợp lệ.');
      }

      updateForm('coverImage', uploadedUrl);
      setMessage({ type: 'success', text: 'Tải ảnh bìa thành công.' });
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Không thể tải ảnh bìa lên.' });
    } finally {
      setCoverUploading(false);
    }
  };

  useEffect(() => {
    if (!isEditMode) {
      setForm(INITIAL_FORM);
      setMessage({ type: '', text: '' });
      setLoadingExistingPost(false);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setMessage({ type: 'error', text: 'Vui lòng đăng nhập lại để chỉnh sửa bài viết' });
      return;
    }

    let active = true;

    const loadPostDetail = async () => {
      try {
        setLoadingExistingPost(true);
        setMessage({ type: '', text: '' });

        const response = await fetch(`/api/career-guide/${editingPostId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await response.json().catch(() => null);
        if (!active) return;

        if (!response.ok || !data?.success || !data?.post) {
          throw new Error(data?.error || 'Không tải được bài viết để chỉnh sửa');
        }

        const post = data.post;
        setForm({
          title: String(post.title || ''),
          excerpt: String(post.excerpt || ''),
          category: String(post.category || CATEGORY_OPTIONS[0]),
          tags: normalizeTagsForInput(post.tags),
          coverImage: String(post.coverImage || ''),
          status: String(post.status || STATUS_OPTIONS[0].value),
          content: String(post.content || INITIAL_CONTENT)
        });
      } catch (error) {
        if (!active) return;
        setMessage({ type: 'error', text: error?.message || 'Không tải được bài viết để chỉnh sửa' });
      } finally {
        if (active) {
          setLoadingExistingPost(false);
        }
      }
    };

    loadPostDetail();

    return () => {
      active = false;
    };
  }, [editingPostId, isEditMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim() || plainTextContent.length < 30) {
      setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ thông tin' });
      return;
    }

    try {
      setSubmitting(true);
      setMessage({ type: '', text: '' });
      
      const token = localStorage.getItem('token');
      const endpoint = isEditMode
        ? `/api/career-guide/${editingPostId}`
        : '/api/career-guide';
      const response = await fetch(endpoint, {
        method: isEditMode ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: form.title.trim(),
          content: sanitizedContent,
          excerpt: form.excerpt.trim(),
          category: form.category,
          tags: tagList,
          coverImage: form.coverImage.trim(),
          status: form.status,
          slug: slugPreview
        })
      });

      const data = await response.json();

      if (data.success) {
        const targetPostId = Number(data.postId || data.post?.id || editingPostId || 0);
        setMessage({
          type: 'success',
          text: isEditMode ? 'Cập nhật bài viết thành công!' : 'Đăng bài thành công!'
        });

        if (!isEditMode) {
          setForm(INITIAL_FORM);
        }

        setTimeout(() => {
          if (targetPostId > 0) {
            navigate(`/career-guide/${targetPostId}`);
          } else {
            navigate('/career-guide/my-posts');
          }
        }, 900);
      } else {
        setMessage({
          type: 'error',
          text: data.error || (isEditMode ? 'Không thể cập nhật bài viết' : 'Không thể đăng bài')
        });
      }
    } catch (err) {
      console.error('Error creating post:', err);
      setMessage({ type: 'error', text: isEditMode ? 'Lỗi khi cập nhật bài viết' : 'Lỗi khi đăng bài viết' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="career-guide-manage-page">
      <div className="cgm-shell">
        <div className="cgm-header">
          <span className="cgm-header-badge">Career Guide Studio</span>
          <div className="cgm-header-actions">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => navigate('/career-guide/my-posts')}
            >
              <i className="bi bi-journal-text me-1" aria-hidden="true"></i>
              Bài đã đăng
            </button>
          </div>
          <h1>
            <i className="bi bi-pencil-square" aria-hidden="true"></i>
            {isEditMode ? 'Chỉnh sửa bài viết' : 'Tạo bài viết mới'}
          </h1>
          <p>
            {isEditMode
              ? 'Cập nhật nội dung bài viết và lưu thay đổi ngay khi bạn hoàn tất.'
              : 'Soạn bài với trình editor trực quan, thêm metadata rõ ràng và xem trước trước khi đăng.'}
          </p>
        </div>

        {message.text && (
          <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} cgm-alert`}>
            {message.text}
          </div>
        )}

        {loadingExistingPost && (
          <div className="alert alert-info cgm-alert mb-3">Đang tải dữ liệu bài viết...</div>
        )}

        <form onSubmit={handleSubmit} className="cgm-layout">
          <section className="cgm-main-card">
            <div className="cgm-field">
              <label htmlFor="title">Tiêu đề bài viết *</label>
              <input
                id="title"
                type="text"
                className="form-control"
                placeholder="Ví dụ: 5 cách chuẩn bị phỏng vấn cho vị trí Data Analyst"
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                disabled={submitting || loadingExistingPost}
                maxLength={200}
              />
              <div className="cgm-hint-row">
                <small>{form.title.length}/200 ký tự</small>
                <small>Slug: {slugPreview || '-'}</small>
              </div>
            </div>

            <div className="cgm-field">
              <label htmlFor="excerpt">Mô tả ngắn</label>
              <textarea
                id="excerpt"
                className="form-control cgm-textarea-sm"
                placeholder="Tóm tắt ngắn 1-2 câu để hiển thị ở danh sách bài viết..."
                value={form.excerpt}
                onChange={(event) => updateForm('excerpt', event.target.value)}
                disabled={submitting || loadingExistingPost}
                maxLength={240}
              />
              <small>{form.excerpt.length}/240 ký tự</small>
            </div>

            <div className="cgm-field">
              <label>Nội dung bài viết *</label>
              <CareerRichTextEditor
                value={form.content}
                onChange={(nextValue) => updateForm('content', nextValue)}
                initialValue={INITIAL_CONTENT}
                placeholder="Viết nội dung bài viết theo định dạng trực quan..."
                minHeight={360}
              />
              <small>{plainTextContent.length} ký tự nội dung</small>
            </div>

            {plainTextContent && (
              <div className="cgm-preview-card">
                <h3>
                  <i className="bi bi-eye" aria-hidden="true"></i>
                  Xem trước
                </h3>
                {form.coverImage.trim() && (
                  <img
                    src={form.coverImage.trim()}
                    alt="Ảnh bìa xem trước"
                    className="cgm-preview-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className="cgm-preview-meta">
                  <span>{form.category}</span>
                  <span>{new Date().toLocaleDateString('vi-VN')}</span>
                </div>
                <h4>{form.title || 'Tiêu đề bài viết'}</h4>
                {form.excerpt.trim() && <p className="cgm-preview-excerpt">{form.excerpt.trim()}</p>}
                <div
                  className="cgm-preview-content"
                  dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                />
              </div>
            )}
          </section>

          <aside className="cgm-side-card">
            <h3>Cấu hình bài viết</h3>

            <div className="cgm-field">
              <label htmlFor="category">Danh mục</label>
              <select
                id="category"
                className="form-select"
                value={form.category}
                onChange={(event) => updateForm('category', event.target.value)}
                disabled={submitting || loadingExistingPost}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="cgm-field">
              <label htmlFor="tags">Tags</label>
              <input
                id="tags"
                type="text"
                className="form-control"
                placeholder="Ví dụ: CV, phỏng vấn, thực tập"
                value={form.tags}
                onChange={(event) => updateForm('tags', event.target.value)}
                disabled={submitting || loadingExistingPost}
              />
              {tagList.length > 0 && (
                <div className="cgm-tag-preview">
                  {tagList.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="cgm-field">
              <label htmlFor="coverImage">Ảnh bìa (URL)</label>
              <input
                id="coverImage"
                type="url"
                className="form-control"
                placeholder="https://..."
                value={form.coverImage}
                onChange={(event) => updateForm('coverImage', event.target.value)}
                disabled={submitting || loadingExistingPost || coverUploading}
              />
              <div className="cgm-cover-upload-row">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={handlePickCoverImage}
                  disabled={submitting || loadingExistingPost || coverUploading}
                >
                  <i className="bi bi-upload me-1" aria-hidden="true"></i>
                  {coverUploading ? 'Đang tải ảnh...' : 'Tải ảnh lên'}
                </button>

                {form.coverImage.trim() && (
                  <button
                    type="button"
                    className="btn btn-light btn-sm"
                    onClick={() => updateForm('coverImage', '')}
                    disabled={submitting || loadingExistingPost || coverUploading}
                  >
                    Xóa ảnh
                  </button>
                )}
              </div>
              <input
                ref={coverUploadInputRef}
                type="file"
                className="cgm-hidden-file-input"
                accept="image/*"
                onChange={handleCoverImageUpload}
                disabled={submitting || loadingExistingPost || coverUploading}
              />
              <small>Hỗ trợ JPG, PNG, WebP, GIF. Kích thước tối đa 5MB.</small>
            </div>

            <div className="cgm-field">
              <label htmlFor="status">Trạng thái</label>
              <select
                id="status"
                className="form-select"
                value={form.status}
                onChange={(event) => updateForm('status', event.target.value)}
                disabled={submitting || loadingExistingPost}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>

            <div className="cgm-tips">
              <h4>Mẹo để bài viết chất lượng</h4>
              <ul>
                <li>Mở bài nêu rõ vấn đề và đối tượng độc giả.</li>
                <li>Dùng tiêu đề phụ để người đọc quét nội dung nhanh.</li>
                <li>Ưu tiên ví dụ thực tế, có số liệu hoặc tình huống cụ thể.</li>
                <li>Kết bài nên có checklist hành động ngắn gọn.</li>
              </ul>
            </div>

            <div className="cgm-actions">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => navigate(isEditMode ? '/career-guide/my-posts' : '/career-guide')}
                disabled={submitting || loadingExistingPost}
              >
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting || loadingExistingPost}>
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send me-2" aria-hidden="true"></i>
                    {isEditMode ? 'Lưu thay đổi' : 'Đăng bài viết'}
                  </>
                )}
              </button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

export default CareerGuideManage;
