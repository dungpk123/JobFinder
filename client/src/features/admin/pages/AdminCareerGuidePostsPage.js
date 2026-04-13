import React, { useState } from 'react';
import { BookOpen, ExternalLink, Trash2 } from 'lucide-react';

const toText = (value) => String(value || '').trim();

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('vi-VN');
};

    const formatCode = (prefix, value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return '-';
        return `${prefix}-${raw}`;
    };

const formatAuthorType = (value) => {
    const type = toText(value).toLowerCase();
    if (!type) return '-';
    if (type === 'candidate') return 'Ứng viên';
    if (type === 'employer') return 'Nhà tuyển dụng';
    if (type === 'admin') return 'Quản trị';
    return value;
};

const buildPostPath = (post) => {
    const id = Number(post?.MaBaiViet);
    if (!Number.isFinite(id)) return '';
    return `/career-guide/${encodeURIComponent(String(id))}`;
};

const AdminCareerGuidePostsPage = ({ posts, loading, onDeletePost, requestConfirm }) => {
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState('');

    const handleDeletePost = async (post) => {
        const postId = Number(post?.MaBaiViet);
        if (!Number.isFinite(postId)) return;

        const approved = await requestConfirm({
            title: 'Xóa bài viết hướng nghiệp',
            message: `Bạn có chắc muốn xóa bài viết #${postId}? Thao tác này không thể hoàn tác.`,
            confirmText: 'Xóa',
            cancelText: 'Hủy'
        });
        if (!approved) return;

        setDeletingId(postId);
        setError('');

        try {
            await onDeletePost(postId);
        } catch (err) {
            setError(err?.message || 'Không thể xóa bài viết hướng nghiệp');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="card border-0 shadow-sm admin-module-card mb-4">
            <div className="card-header bg-white border-0 py-3">
                <h5 className="mb-0 d-flex align-items-center gap-2">
                    <BookOpen size={18} />
                    <span>Quản lý bài viết hướng nghiệp</span>
                </h5>
            </div>

            <div className="card-body py-2">
                {error ? <div className="alert alert-danger mb-2">{error}</div> : null}
            </div>

            <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                    <thead>
                        <tr>
                            <th style={{ width: 100 }}>ID</th>
                            <th style={{ width: 220 }}>Tiêu đề</th>
                            <th style={{ width: 130 }}>Tác giả</th>
                            <th style={{ width: 150 }}>Loại tác giả</th>
                            <th style={{ width: 185 }}>Ngày tạo</th>
                            <th style={{ width: 185 }}>Ngày cập nhật</th>
                            <th style={{ width: 100 }}>Lượt xem</th>
                            <th style={{ width: 110 }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.map((post, index) => {
                            const postPath = buildPostPath(post);
                            return (
                                <tr key={post.MaBaiViet}>
                                    <td>{index + 1}</td>
                                    <td className="admin-career-post-title">{toText(post.TieuDe) || '-'}</td>
                                    <td><span className="admin-code-chip">{formatCode('TG', post.MaTacGia)}</span></td>
                                    <td>{formatAuthorType(post.LoaiTacGia)}</td>
                                    <td>{formatDateTime(post.NgayTao)}</td>
                                    <td>{formatDateTime(post.NgayCapNhat)}</td>
                                    <td>{Number(post.LuotXem || 0).toLocaleString('vi-VN')}</td>
                                    <td>
                                        <div className="admin-career-row-actions">
                                            <a
                                                href={postPath || '#'}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="btn btn-sm btn-outline-primary admin-action-icon-btn"
                                                title="Đi tới link bài viết"
                                                aria-label="Đi tới link bài viết"
                                                onClick={(event) => {
                                                    if (!postPath) event.preventDefault();
                                                }}
                                            >
                                                <ExternalLink size={14} />
                                            </a>

                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-danger admin-action-icon-btn"
                                                title="Xóa bài viết"
                                                aria-label="Xóa bài viết"
                                                disabled={deletingId === post.MaBaiViet}
                                                onClick={() => handleDeletePost(post)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}

                        {posts.length === 0 && !loading && (
                            <tr><td colSpan={8} className="text-center text-muted py-4">Chưa có dữ liệu</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminCareerGuidePostsPage;
