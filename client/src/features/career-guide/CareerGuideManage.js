import React, { useRef, useState } from 'react';
import './CareerGuideManage.css';

function CareerGuideManage() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const textareaRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ thông tin' });
      return;
    }

    try {
      setSubmitting(true);
      setMessage({ type: '', text: '' });
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/career-guide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, content })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Đăng bài thành công!' });
        setTitle('');
        setContent('');
        
        // Redirect after 2 seconds
        setTimeout(() => {
          window.location.href = `/career-guide/${data.postId}`;
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Không thể đăng bài' });
      }
    } catch (err) {
      console.error('Error creating post:', err);
      setMessage({ type: 'error', text: 'Lỗi khi đăng bài viết' });
    } finally {
      setSubmitting(false);
    }
  };

  const applyWrap = (prefix, suffix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = content.slice(start, end);

    const before = content.slice(0, start);
    const after = content.slice(end);

    const next = `${before}${prefix}${selected}${suffix}${after}`;
    setContent(next);

    setTimeout(() => {
      textarea.focus();
      if (start === end) {
        const pos = start + prefix.length;
        textarea.setSelectionRange(pos, pos);
      } else {
        const selStart = start + prefix.length;
        const selEnd = selStart + selected.length;
        textarea.setSelectionRange(selStart, selEnd);
      }
    }, 0);
  };

  const applyHeading = (level) => {
    const tag = `h${level}`;
    applyWrap(`\n<${tag}>`, `</${tag}>\n`);
  };

  const applyList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const selected = content.slice(start, end);
    const before = content.slice(0, start);
    const after = content.slice(end);

    if (!selected.trim()) {
      const prefix = '\n<ul>\n  <li>';
      const suffix = '</li>\n</ul>\n';
      const next = `${before}${prefix}${suffix}${after}`;
      setContent(next);
      setTimeout(() => {
        textarea.focus();
        const pos = start + prefix.length;
        textarea.setSelectionRange(pos, pos);
      }, 0);
      return;
    }

    const lines = selected
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const items = lines.map((l) => `  <li>${l}</li>`).join('\n');
    const block = `\n<ul>\n${items}\n</ul>\n`;
    const next = `${before}${block}${after}`;
    setContent(next);
    setTimeout(() => {
      textarea.focus();
      const pos = start + block.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  return (
    <div className="career-guide-manage-container">
      <div className="container">
        <div className="manage-header">
          <h1>
            <i className="bi bi-pencil-square"></i>
            Tạo Bài Viết Mới
          </h1>
          <p className="subtitle">Chia sẻ kiến thức và kinh nghiệm của bạn với cộng đồng</p>
        </div>

        {message.text && (
          <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="create-post-form">
          {/* Title Input */}
          <div className="form-group">
            <label htmlFor="title" className="form-label">
              <i className="bi bi-text-left"></i> Tiêu đề bài viết *
            </label>
            <input
              type="text"
              className="form-control"
              id="title"
              placeholder="Nhập tiêu đề hấp dẫn cho bài viết của bạn..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              maxLength={200}
            />
            <small className="text-muted">{title.length}/200 ký tự</small>
          </div>

          {/* Content Editor */}
          <div className="form-group">
            <label className="form-label">
              <i className="bi bi-file-text"></i> Nội dung bài viết *
            </label>
            
            <div className="quick-templates">
              <button
                type="button"
                className="template-btn"
                onClick={() => applyHeading(2)}
              >
                <i className="bi bi-type-h2"></i> Tiêu đề lớn
              </button>
              <button
                type="button"
                className="template-btn"
                onClick={() => applyHeading(3)}
              >
                <i className="bi bi-type-h3"></i> Tiêu đề nhỏ
              </button>
              <button
                type="button"
                className="template-btn"
                onClick={applyList}
              >
                <i className="bi bi-list-ul"></i> Danh sách
              </button>
              <button
                type="button"
                className="template-btn"
                onClick={() => applyWrap('<strong>', '</strong>')}
              >
                <i className="bi bi-type-bold"></i> Đậm
              </button>
              <button
                type="button"
                className="template-btn"
                onClick={() => applyWrap('<em>', '</em>')}
              >
                <i className="bi bi-type-italic"></i> Nghiêng
              </button>
            </div>

            {/* Content Editor */}
            <textarea
              className="form-control content-editor"
              name="content"
              rows="15"
              placeholder="Nhập nội dung bài viết..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={submitting}
              ref={textareaRef}
            />
            <small className="text-muted">{content.length} ký tự</small>
          </div>

          {/* Preview Section */}
          {content && (
            <div className="form-group">
              <label className="form-label">
                <i className="bi bi-eye"></i> Xem trước
              </label>
              <div 
                className="content-preview"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          )}

          {/* Submit Button */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => window.history.back()}
              disabled={submitting}
            >
              <i className="bi bi-x-circle"></i> Hủy
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Đang đăng...
                </>
              ) : (
                <>
                  <i className="bi bi-send"></i> Đăng bài viết
                </>
              )}
            </button>
          </div>
        </form>

        {/* Tips Section */}
        <div className="tips-section">
          <h4><i className="bi bi-lightbulb"></i> Mẹo viết bài hay</h4>
          <ul>
            <li>Tiêu đề ngắn gọn, súc tích và thu hút</li>
            <li>Nội dung có cấu trúc rõ ràng với các tiêu đề phụ</li>
            <li>Sử dụng ví dụ cụ thể để minh họa ý tưởng</li>
            <li>Kiểm tra lỗi chính tả trước khi đăng</li>
            <li>Chia sẻ kinh nghiệm thực tế và hữu ích</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default CareerGuideManage;
