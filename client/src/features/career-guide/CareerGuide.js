import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './CareerGuide.css';

function CareerGuide() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

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
      month: 'long',
      day: 'numeric'
    });
  };

  const truncateContent = (content, maxLength = 150) => {
    const text = content.replace(/<[^>]*>/g, ''); // Remove HTML tags
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
  };

  const filteredPosts = posts.filter(post =>
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="career-guide-container">
      {/* Hero Section */}
      <div className="career-guide-hero">
        <div className="container">
          <h1 className="hero-title">Cẩm Nang Nghề Nghiệp</h1>
          <p className="hero-subtitle">
            Khám phá các mẹo, tin tức và hướng dẫn hữu ích cho sự nghiệp của bạn
          </p>
          
          {/* Search Bar */}
          <div className="search-bar-wrapper">
            <div className="search-bar">
              <i className="bi bi-search"></i>
              <input
                type="text"
                placeholder="Tìm kiếm bài viết..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container career-guide-content">
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Đang tải...</span>
            </div>
          </div>
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : (
          <>
            {/* Posts Grid */}
            <div className="posts-grid">
              {filteredPosts.length > 0 ? (
                filteredPosts.map((post) => (
                  <div key={post.id} className="post-card">
                    <div className="post-card-body">
                      <div className="post-meta">
                        <span className="post-author">
                          <i className="bi bi-person-circle"></i> {post.authorName || 'Ẩn danh'}
                        </span>
                        <span className="post-date">
                          <i className="bi bi-calendar3"></i> {formatDate(post.createdAt)}
                        </span>
                        <span className="post-views">
                          <i className="bi bi-eye"></i> {post.views || 0}
                        </span>
                      </div>
                      
                      <h3 className="post-title">
                        <Link to={`/career-guide/${post.id}`}>{post.title}</Link>
                      </h3>
                      
                      <p className="post-excerpt">
                        {truncateContent(post.content)}
                      </p>
                      
                      <Link to={`/career-guide/${post.id}`} className="read-more-btn">
                        Đọc tiếp <i className="bi bi-arrow-right"></i>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-posts">
                  <i className="bi bi-inbox"></i>
                  <p>Không tìm thấy bài viết nào</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination-wrapper">
                <nav aria-label="Page navigation">
                  <ul className="pagination">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <i className="bi bi-chevron-left"></i>
                      </button>
                    </li>
                    
                    {[...Array(totalPages)].map((_, index) => (
                      <li
                        key={index + 1}
                        className={`page-item ${currentPage === index + 1 ? 'active' : ''}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => setCurrentPage(index + 1)}
                        >
                          {index + 1}
                        </button>
                      </li>
                    ))}
                    
                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
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
          </>
        )}
      </div>

      {/* Floating Action Button */}
      {user && (
        <button
          className="fab-create-post"
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
