import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CareerGuideMyPosts.css';

const getStatusMeta = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'draft') {
    return {
      label: 'Nháp',
      className: 'cgmp-status-draft'
    };
  }

  return {
    label: 'Đã đăng',
    className: 'cgmp-status-published'
  };
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const toExcerpt = (post) => {
  const raw = String(post?.excerpt || '').trim();
  if (raw) {
    return raw.length > 140 ? `${raw.slice(0, 140)}...` : raw;
  }

  const plain = String(post?.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!plain) return 'Chưa có mô tả ngắn';
  return plain.length > 140 ? `${plain.slice(0, 140)}...` : plain;
};

function CareerGuideMyPosts() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const token = useMemo(() => String(localStorage.getItem('token') || '').trim(), []);

  const fetchMyPosts = async (targetPage = page) => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/career-guide/my-posts?page=${targetPage}&limit=10`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không tải được danh sách bài viết của bạn');
      }

      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setTotalPages(Math.max(1, Number(data?.pagination?.totalPages || 1)));
    } catch (fetchError) {
      setError(fetchError?.message || 'Không tải được danh sách bài viết của bạn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    fetchMyPosts(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page]);

  const handleDelete = async (post) => {
    if (!post?.id) return;

    const approved = window.confirm(`Bạn có chắc muốn xóa bài viết "${post.title || 'không tên'}"?`);
    if (!approved) return;

    try {
      setDeletingId(post.id);
      setError('');

      const response = await fetch(`/api/career-guide/${post.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Không thể xóa bài viết');
      }

      const nextPosts = posts.filter((item) => item.id !== post.id);
      setPosts(nextPosts);

      if (nextPosts.length === 0 && page > 1) {
        setPage((previous) => Math.max(1, previous - 1));
      } else {
        fetchMyPosts(page);
      }
    } catch (deleteError) {
      setError(deleteError?.message || 'Không thể xóa bài viết');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="career-guide-my-posts-page">
      <div className="cgmp-shell">
        <header className="cgmp-header">
          <div>
            <span className="cgmp-eyebrow">Career Guide Studio</span>
            <h1>Quản lý bài viết đã đăng</h1>
            <p>Theo dõi trạng thái, lượt xem và cập nhật nhanh các bài bạn đã chia sẻ.</p>
          </div>
          <div className="cgmp-header-actions">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => navigate('/career-guide')}
            >
              <i className="bi bi-arrow-left me-2" aria-hidden="true"></i>
              Về Cẩm nang
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/career-guide/create')}
            >
              <i className="bi bi-plus-circle me-2" aria-hidden="true"></i>
              Viết bài mới
            </button>
          </div>
        </header>

        {error && <div className="alert alert-danger cgmp-alert">{error}</div>}

        <section className="cgmp-card">
          {loading ? (
            <div className="cgmp-loading">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Đang tải...</span>
              </div>
            </div>
          ) : posts.length === 0 ? (
            <div className="cgmp-empty">
              <i className="bi bi-journal-x" aria-hidden="true"></i>
              <h2>Bạn chưa có bài viết nào</h2>
              <p>Hãy tạo bài đầu tiên để bắt đầu chia sẻ kinh nghiệm nghề nghiệp.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/career-guide/create')}
              >
                Viết bài ngay
              </button>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table align-middle mb-0 cgmp-table">
                  <thead>
                    <tr>
                      <th>Bài viết</th>
                      <th style={{ width: 130 }}>Trạng thái</th>
                      <th style={{ width: 170 }}>Tạo lúc</th>
                      <th style={{ width: 170 }}>Cập nhật</th>
                      <th style={{ width: 110 }}>Lượt xem</th>
                      <th style={{ width: 160 }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => {
                      const statusMeta = getStatusMeta(post.status);
                      const busy = deletingId === post.id;
                      const postPath = `/career-guide/${encodeURIComponent(post.slug || post.id)}`;

                      return (
                        <tr key={post.id}>
                          <td>
                            <div className="cgmp-title">{post.title || 'Không có tiêu đề'}</div>
                            <div className="cgmp-excerpt">{toExcerpt(post)}</div>
                          </td>
                          <td>
                            <span className={`cgmp-status ${statusMeta.className}`}>{statusMeta.label}</span>
                          </td>
                          <td>{formatDateTime(post.createdAt)}</td>
                          <td>{formatDateTime(post.updatedAt)}</td>
                          <td>{Number(post.views || 0)}</td>
                          <td>
                            <div className="cgmp-actions">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-info cgmp-icon-btn"
                                title="Xem bài viết"
                                aria-label="Xem bài viết"
                                onClick={() => navigate(postPath)}
                                disabled={busy}
                              >
                                <i className="bi bi-eye"></i>
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary cgmp-icon-btn"
                                title="Sửa bài viết"
                                aria-label="Sửa bài viết"
                                onClick={() => navigate(`/career-guide/create?postId=${post.id}`)}
                                disabled={busy}
                              >
                                <i className="bi bi-pencil-square"></i>
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger cgmp-icon-btn"
                                title="Xóa bài viết"
                                aria-label="Xóa bài viết"
                                onClick={() => handleDelete(post)}
                                disabled={busy}
                              >
                                {busy ? (
                                  <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
                                ) : (
                                  <i className="bi bi-trash"></i>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="cgmp-pagination">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                  disabled={page <= 1}
                >
                  <i className="bi bi-chevron-left"></i>
                </button>
                <span>Trang {page}/{totalPages}</span>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                  disabled={page >= totalPages}
                >
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default CareerGuideMyPosts;
