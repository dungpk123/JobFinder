import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './CareerGuide.css';

const TOPIC_FILTERS = [
  { key: 'all', label: 'Tất cả chủ đề', keywords: [] },
  { key: 'cv', label: 'CV & Hồ sơ', keywords: ['cv', 'hồ sơ', 'resume', 'portfolio'] },
  { key: 'interview', label: 'Phỏng vấn', keywords: ['phỏng vấn', 'interview', 'câu hỏi'] },
  { key: 'salary', label: 'Lương & đãi ngộ', keywords: ['lương', 'thưởng', 'đãi ngộ', 'offer'] },
  { key: 'career', label: 'Định hướng nghề', keywords: ['career', 'lộ trình', 'phát triển', 'chuyển việc'] },
  { key: 'skills', label: 'Kỹ năng làm việc', keywords: ['kỹ năng', 'giao tiếp', 'thuyết trình', 'teamwork'] }
];

const normalizeRoleValue = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

function CareerGuide() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [activeTopic, setActiveTopic] = useState('all');
  const [sortMode, setSortMode] = useState('latest');

  const normalizedUserRole = useMemo(
    () => normalizeRoleValue(
      user?.role
      || user?.vaiTro
      || user?.VaiTro
      || user?.LoaiNguoiDung
      || ''
    ),
    [user]
  );

  const canCreatePost = useMemo(() => {
    if (!user) return false;

    const isSuperAdmin = (
      user?.isSuperAdmin === true
      || user?.isSuperAdmin === 1
      || user?.isSuperAdmin === '1'
      || user?.IsSuperAdmin === true
      || user?.IsSuperAdmin === 1
      || user?.IsSuperAdmin === '1'
    );

    if (isSuperAdmin) return true;

    return (
      normalizedUserRole === 'ung vien'
      || normalizedUserRole === 'nha tuyen dung'
      || normalizedUserRole === 'quan tri'
      || normalizedUserRole === 'sieu quan tri vien'
    );
  }, [normalizedUserRole, user]);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchPosts();
  }, [currentPage]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/career-guide?page=${currentPage}&limit=9`);
      const data = await response.json();
      
      if (data.success) {
        setPosts(data.posts);
        setTotalPages(data.pagination.totalPages);
      } else {
        setError('Không thể tải danh sách bài viết');
      }
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Lỗi khi tải danh sách bài viết');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const truncateContent = (content, maxLength = 150) => {
    const text = String(content || '').replace(/<[^>]*>/g, '');
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const getPostExcerpt = (post, maxLength = 150) => {
    const rawExcerpt = String(post?.excerpt || '').trim();
    if (rawExcerpt) {
      return rawExcerpt.length > maxLength
        ? `${rawExcerpt.slice(0, maxLength)}...`
        : rawExcerpt;
    }
    return truncateContent(post?.content, maxLength);
  };

  const getPostPath = (post) => `/career-guide/${encodeURIComponent(post?.slug || post?.id)}`;

  const getReadingTime = (content) => {
    const rawText = String(content || '').replace(/<[^>]*>/g, ' ').trim();
    if (!rawText) return '1 phút đọc';
    const words = rawText.split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 220));
    return `${minutes} phút đọc`;
  };

  const filteredPosts = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase().trim();
    const selectedTopic = TOPIC_FILTERS.find((item) => item.key === activeTopic);

    const list = posts.filter((post) => {
      const title = String(post.title || '').toLowerCase();
      const content = String(post.content || '').toLowerCase();

      const matchesSearch = !normalizedSearch
        || title.includes(normalizedSearch)
        || content.includes(normalizedSearch);

      if (!matchesSearch) return false;
      if (!selectedTopic || selectedTopic.key === 'all') return true;

      const searchableText = `${title} ${content}`;
      return selectedTopic.keywords.some((keyword) => searchableText.includes(keyword));
    });

    return [...list].sort((a, b) => {
      if (sortMode === 'views') {
        return Number(b.views || 0) - Number(a.views || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [posts, searchTerm, activeTopic, sortMode]);

  const featuredPost = filteredPosts.length > 0 ? filteredPosts[0] : null;
  const secondaryPosts = featuredPost ? filteredPosts.slice(1) : [];
  const totalViews = posts.reduce((sum, post) => sum + Number(post.views || 0), 0);
  const avgViews = posts.length > 0 ? Math.round(totalViews / posts.length) : 0;

  return (
    <div className="career-guide-page">
      <section className="cg-hero">
        <div className="cg-shell cg-hero-grid">
          <div className="cg-hero-content">
            <p className="cg-hero-eyebrow">Blog nghề nghiệp JobFinder</p>
            <h1>Bài viết hướng nghiệp</h1>
            <p className="cg-hero-subtitle">
              Cập nhật xu hướng tuyển dụng, chiến lược phỏng vấn và bí quyết xây dựng hồ sơ để bạn ứng tuyển hiệu quả hơn mỗi ngày.
            </p>

            <div className="cg-search-wrap">
              <i className="bi bi-search"></i>
              <input
                type="text"
                placeholder="Tìm theo tiêu đề, nội dung hoặc kỹ năng..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="cg-topic-chips" role="group" aria-label="Bộ lọc chủ đề">
              {TOPIC_FILTERS.map((topic) => (
                <button
                  key={topic.key}
                  type="button"
                  className={`cg-topic-chip ${activeTopic === topic.key ? 'is-active' : ''}`}
                  onClick={() => setActiveTopic(topic.key)}
                  aria-pressed={activeTopic === topic.key}
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </div>

          <aside className="cg-hero-insight" aria-label="Tổng quan bài viết">
            <h2>Toàn cảnh chuyên mục</h2>
            <ul>
              <li>
                <strong>{posts.length}</strong>
                <span>Bài viết trong trang hiện tại</span>
              </li>
              <li>
                <strong>{avgViews}</strong>
                <span>Lượt xem trung bình mỗi bài</span>
              </li>
              <li>
                <strong>{totalPages}</strong>
                <span>Tổng số trang nội dung</span>
              </li>
            </ul>
          </aside>
        </div>
      </section>

      <div className="cg-shell cg-main-content">
        {loading ? (
          <div className="cg-loading">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Đang tải...</span>
            </div>
          </div>
        ) : error ? (
          <div className="alert alert-danger cg-alert">{error}</div>
        ) : (
          <div className="cg-layout">
            <section className="cg-feed" aria-label="Danh sách bài viết">
              {featuredPost ? (
                <article className="cg-featured-post">
                  <span className="cg-featured-label">Bài nổi bật</span>

                  {featuredPost.coverImage && (
                    <div className="cg-featured-cover-wrap">
                      <img
                        src={featuredPost.coverImage}
                        alt={featuredPost.title}
                        className="cg-featured-cover"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <h2>
                    <Link to={getPostPath(featuredPost)}>{featuredPost.title}</Link>
                  </h2>

                  {featuredPost.category && <span className="cg-post-category">{featuredPost.category}</span>}

                  <p>{getPostExcerpt(featuredPost, 220)}</p>

                  <div className="cg-featured-meta">
                    <span>
                      <i className="bi bi-person-circle"></i>
                      {featuredPost.authorName || 'Ẩn danh'}
                    </span>
                    <span>
                      <i className="bi bi-calendar3"></i>
                      {formatDate(featuredPost.createdAt)}
                    </span>
                    <span>
                      <i className="bi bi-eye"></i>
                      {featuredPost.views || 0} lượt xem
                    </span>
                    <span>
                      <i className="bi bi-clock-history"></i>
                      {getReadingTime(featuredPost.content)}
                    </span>
                  </div>

                  <Link to={getPostPath(featuredPost)} className="cg-read-link">
                    Đọc bài viết nổi bật
                    <i className="bi bi-arrow-right"></i>
                  </Link>
                </article>
              ) : (
                <div className="cg-empty-state">
                  <i className="bi bi-inbox"></i>
                  <p>Không tìm thấy bài viết nào</p>
                </div>
              )}

              <div className="cg-feed-toolbar">
                <div className="cg-feed-count">
                  <strong>{filteredPosts.length}</strong> bài viết phù hợp
                  <span>Trang {currentPage}/{totalPages}</span>
                </div>
                <div className="cg-sort-group" role="group" aria-label="Sắp xếp bài viết">
                  <button
                    type="button"
                    className={`cg-sort-btn ${sortMode === 'latest' ? 'is-active' : ''}`}
                    onClick={() => setSortMode('latest')}
                  >
                    Mới nhất
                  </button>
                  <button
                    type="button"
                    className={`cg-sort-btn ${sortMode === 'views' ? 'is-active' : ''}`}
                    onClick={() => setSortMode('views')}
                  >
                    Xem nhiều
                  </button>
                </div>
              </div>

              {secondaryPosts.length > 0 && (
                <div className="cg-post-grid">
                  {secondaryPosts.map((post) => (
                    <article key={post.id} className="cg-post-card">
                      {post.coverImage && (
                        <div className="cg-post-cover-wrap">
                          <img
                            src={post.coverImage}
                            alt={post.title}
                            className="cg-post-cover"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {post.category && <span className="cg-post-category">{post.category}</span>}

                      <div className="cg-post-meta">
                        <span>
                          <i className="bi bi-person-circle"></i>
                          {post.authorName || 'Ẩn danh'}
                        </span>
                        <span>
                          <i className="bi bi-calendar3"></i>
                          {formatDate(post.createdAt)}
                        </span>
                      </div>

                      <h3>
                        <Link to={getPostPath(post)}>{post.title}</Link>
                      </h3>

                      <p>{getPostExcerpt(post, 150)}</p>

                      <div className="cg-post-footer">
                        <span>
                          <i className="bi bi-eye"></i>
                          {post.views || 0} lượt xem
                        </span>
                        <span>
                          <i className="bi bi-clock-history"></i>
                          {getReadingTime(post.content)}
                        </span>
                      </div>

                      <Link to={getPostPath(post)} className="cg-card-link">
                        Xem chi tiết
                        <i className="bi bi-arrow-right"></i>
                      </Link>
                    </article>
                  ))}
                </div>
              )}

            {totalPages > 1 && (
              <div className="cg-pagination-wrapper">
                <nav aria-label="Page navigation" className="cg-pagination-nav">
                  <ul className="cg-pagination-list">
                    <li className={`cg-page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button
                        className="cg-page-link"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <i className="bi bi-chevron-left"></i>
                      </button>
                    </li>

                    {[...Array(totalPages)].map((_, index) => (
                      <li
                        key={index + 1}
                        className={`cg-page-item ${currentPage === index + 1 ? 'active' : ''}`}
                      >
                        <button
                          className="cg-page-link"
                          onClick={() => setCurrentPage(index + 1)}
                        >
                          {index + 1}
                        </button>
                      </li>
                    ))}

                    <li className={`cg-page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button
                        className="cg-page-link"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}

            </section>

            <aside className="cg-sidebar" aria-label="Nội dung liên quan">
              <div className="cg-sidebar-card">
                <h3>Lộ trình tham khảo</h3>
                <ul>
                  <li>Hoàn thiện CV theo đúng vị trí ứng tuyển.</li>
                  <li>Tối ưu LinkedIn và portfolio trước khi apply.</li>
                  <li>Chuẩn bị bộ câu hỏi phỏng vấn theo chuyên môn.</li>
                  <li>Đàm phán offer dựa trên dữ liệu thị trường.</li>
                </ul>
              </div>

              <div className="cg-sidebar-card cg-sidebar-cta">
                <h3>Khám phá việc làm ngay</h3>
                <p>Áp dụng kiến thức trong cẩm nang để tìm việc phù hợp nhanh hơn.</p>
                <div className="cg-sidebar-links">
                  <Link to="/jobs">Xem danh sách việc làm</Link>
                  <Link to="/create-cv">Tạo CV online</Link>
                </div>
              </div>

              {user && canCreatePost ? (
                <div className="cg-author-actions">
                  <button
                    type="button"
                    className="cg-create-post-btn"
                    onClick={() => navigate('/career-guide/create')}
                  >
                    <i className="bi bi-plus-circle"></i>
                    Viết bài mới
                  </button>
                  <button
                    type="button"
                    className="cg-manage-post-btn"
                    onClick={() => navigate('/career-guide/my-posts')}
                  >
                    <i className="bi bi-journal-text"></i>
                    Quản lý bài đã đăng
                  </button>
                </div>
              ) : user ? (
                <div className="cg-sidebar-card cg-sidebar-auth">
                  <h3>Quyền của bạn</h3>
                  <p>Bạn có thể xem, bình luận và viết bài chia sẻ kinh nghiệm hướng nghiệp.</p>
                </div>
              ) : (
                <div className="cg-sidebar-card cg-sidebar-auth">
                  <h3>Đăng nhập để viết bài</h3>
                  <p>Bạn có thể chia sẻ kinh nghiệm nghề nghiệp với cộng đồng ứng viên.</p>
                  <Link to="/login" className="cg-auth-link">Đăng nhập ngay</Link>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      {user && canCreatePost && (
        <button
          className="cg-fab-create-post"
          onClick={() => navigate('/career-guide/create')}
          title="Tạo bài viết mới"
        >
          <i className="bi bi-plus-lg"></i>
        </button>
      )}
    </div>
  );
}

export default CareerGuide;
