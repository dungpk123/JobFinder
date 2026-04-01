import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import './CareerGuideDetail.css';

function CareerGuideDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchPostDetail();
  }, [id]);

  const fetchPostDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/career-guide/${id}`);
      const data = await response.json();
      
      if (data.success) {
        setPost(data.post);
        setComments(data.comments || []);
      } else {
        setError('Không thể tải bài viết');
      }
    } catch (err) {
      console.error('Error fetching post detail:', err);
      setError('Lỗi khi tải bài viết');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    
    if (!user) {
      alert('Vui lòng đăng nhập để bình luận');
      return;
    }

    if (!commentContent.trim()) {
      alert('Vui lòng nhập nội dung bình luận');
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/career-guide/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: commentContent })
      });

      const data = await response.json();
      
      if (data.success) {
        setCommentContent('');
        fetchPostDetail(); // Reload comments
      } else {
        alert(data.error || 'Không thể thêm bình luận');
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
      alert('Lỗi khi thêm bình luận');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Bạn có chắc muốn xóa bình luận này?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/career-guide/${id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        fetchPostDetail(); // Reload comments
      } else {
        alert(data.error || 'Không thể xóa bình luận');
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert('Lỗi khi xóa bình luận');
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa bài viết này?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/career-guide/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Xóa bài viết thành công');
        navigate('/career-guide');
      } else {
        alert(data.error || 'Không thể xóa bài viết');
      }
    } catch (err) {
      console.error('Error deleting post:', err);
      alert('Lỗi khi xóa bài viết');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canDeletePost = () => {
    if (!user || !post) return false;
    return user.LoaiNguoiDung === 'Quản trị' || 
           user.LoaiNguoiDung === 'Siêu quản trị viên' ||
           (post.authorId === user.MaNguoiDung && post.authorType === 'candidate') ||
           (post.authorId === user.MaCongTy && post.authorType === 'employer');
  };

  const canDeleteComment = (comment) => {
    if (!user) return false;
    return user.LoaiNguoiDung === 'Quản trị' || 
           user.LoaiNguoiDung === 'Siêu quản trị viên' ||
           (comment.userId === user.MaNguoiDung && comment.userType === 'candidate') ||
           (comment.userId === user.MaCongTy && comment.userType === 'employer');
  };

  if (loading) {
    return (
      <div className="career-guide-detail-container">
        <div className="loading-spinner">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Đang tải...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="career-guide-detail-container">
        <div className="container">
          <div className="alert alert-danger">{error || 'Không tìm thấy bài viết'}</div>
          <Link to="/career-guide" className="btn btn-primary">
            <i className="bi bi-arrow-left"></i> Quay lại
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="career-guide-detail-container">
      <div className="container">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="breadcrumb-nav">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link to="/career-guide">Cẩm nang nghề nghiệp</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              {post.title}
            </li>
          </ol>
        </nav>

        {/* Post Content */}
        <article className="post-detail-card">
          <header className="post-header">
            <h1 className="post-detail-title">{post.title}</h1>
            
            <div className="post-detail-meta">
              <div className="meta-left">
                <span className="meta-item">
                  <i className="bi bi-person-circle"></i>
                  <strong>{post.authorName || 'Ẩn danh'}</strong>
                </span>
                <span className="meta-item">
                  <i className="bi bi-calendar3"></i>
                  {formatDate(post.createdAt)}
                </span>
                <span className="meta-item">
                  <i className="bi bi-eye"></i>
                  {post.views || 0} lượt xem
                </span>
              </div>
              
              {canDeletePost() && (
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={handleDeletePost}
                >
                  <i className="bi bi-trash"></i> Xóa bài viết
                </button>
              )}
            </div>
          </header>

          <div 
            className="post-detail-content"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>

        {/* Comments Section */}
        <section className="comments-section">
          <h3 className="comments-title">
            <i className="bi bi-chat-dots"></i>
            Bình luận ({comments.length})
          </h3>

          {/* Comment Form */}
          {user ? (
            <form className="comment-form" onSubmit={handleSubmitComment}>
              <textarea
                className="form-control"
                rows="4"
                placeholder="Viết bình luận của bạn..."
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                disabled={submitting}
              />
              <button 
                type="submit" 
                className="btn btn-primary mt-3"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send"></i> Gửi bình luận
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="alert alert-info">
              Vui lòng <Link to="/login">đăng nhập</Link> để bình luận
            </div>
          )}

          {/* Comments List */}
          <div className="comments-list">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="comment-item">
                  <div className="comment-header">
                    <div className="comment-author">
                      <i className="bi bi-person-circle"></i>
                      <strong>{comment.userName || 'Ẩn danh'}</strong>
                    </div>
                    <div className="comment-actions">
                      <span className="comment-date">
                        {formatDate(comment.createdAt)}
                      </span>
                      {canDeleteComment(comment) && (
                        <button
                          className="btn-delete-comment"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="comment-content">{comment.content}</p>
                </div>
              ))
            ) : (
              <p className="no-comments">Chưa có bình luận nào. Hãy là người đầu tiên bình luận!</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default CareerGuideDetail;
