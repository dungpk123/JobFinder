const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

const dbPath = path.join(__dirname, '../data/timkiemvieclam.db');

// Get all career guide posts with pagination
router.get('/', async (req, res) => {
  const db = new sqlite3.Database(dbPath);
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // Get total count
    db.get('SELECT COUNT(*) as total FROM CareerGuide', [], (err, countRow) => {
      if (err) {
        db.close();
        return res.status(500).json({ success: false, error: 'Lỗi database' });
      }

      // Get posts with author info
      const sql = `
        SELECT 
          cg.id, cg.title, cg.content, cg.authorId, cg.authorType, 
          cg.createdAt, cg.updatedAt, cg.views,
          CASE 
            WHEN cg.authorType = 'candidate' THEN u.HoTen
            WHEN cg.authorType = 'employer' THEN c.TenCongTy
            ELSE 'Admin'
          END as authorName
        FROM CareerGuide cg
        LEFT JOIN NguoiDung u ON cg.authorId = u.MaNguoiDung AND cg.authorType = 'candidate'
        LEFT JOIN CongTy c ON cg.authorId = c.MaCongTy AND cg.authorType = 'employer'
        ORDER BY cg.createdAt DESC
        LIMIT ? OFFSET ?
      `;

      db.all(sql, [limit, offset], (err, rows) => {
        db.close();
        if (err) {
          return res.status(500).json({ success: false, error: 'Lỗi database' });
        }

        res.json({
          success: true,
          posts: rows,
          pagination: {
            page,
            limit,
            total: countRow.total,
            totalPages: Math.ceil(countRow.total / limit)
          }
        });
      });
    });
  } catch (error) {
    db.close();
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single post with comments
router.get('/:id', (req, res) => {
  const db = new sqlite3.Database(dbPath);
  const { id } = req.params;

  const sql = `
    SELECT 
      cg.id, cg.title, cg.content, cg.authorId, cg.authorType, 
      cg.createdAt, cg.updatedAt, cg.views,
      CASE 
        WHEN cg.authorType = 'candidate' THEN u.HoTen
        WHEN cg.authorType = 'employer' THEN c.TenCongTy
        ELSE 'Admin'
      END as authorName
    FROM CareerGuide cg
    LEFT JOIN NguoiDung u ON cg.authorId = u.MaNguoiDung AND cg.authorType = 'candidate'
    LEFT JOIN CongTy c ON cg.authorId = c.MaCongTy AND cg.authorType = 'employer'
    WHERE cg.id = ?
  `;

  db.get(sql, [id], (err, post) => {
    if (err) {
      db.close();
      return res.status(500).json({ success: false, error: 'Lỗi database' });
    }

    if (!post) {
      db.close();
      return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    }

    // Update view count
    db.run('UPDATE CareerGuide SET views = views + 1 WHERE id = ?', [id]);

    // Get comments
    const commentSql = `
      SELECT 
        cgc.id, cgc.content, cgc.userId, cgc.userType, cgc.createdAt,
        CASE 
          WHEN cgc.userType = 'candidate' THEN u.HoTen
          WHEN cgc.userType = 'employer' THEN c.TenCongTy
          ELSE 'Admin'
        END as userName
      FROM CareerGuideComment cgc
      LEFT JOIN NguoiDung u ON cgc.userId = u.MaNguoiDung AND cgc.userType = 'candidate'
      LEFT JOIN CongTy c ON cgc.userId = c.MaCongTy AND cgc.userType = 'employer'
      WHERE cgc.postId = ?
      ORDER BY cgc.createdAt DESC
    `;

    db.all(commentSql, [id], (err, comments) => {
      db.close();
      if (err) {
        return res.status(500).json({ success: false, error: 'Lỗi khi tải bình luận' });
      }

      res.json({
        success: true,
        post: { ...post, views: post.views + 1 },
        comments: comments || []
      });
    });
  });
});

// Create new post (authenticated)
router.post('/', authenticateToken, (req, res) => {
  const db = new sqlite3.Database(dbPath);
  const { title, content } = req.body;
  
  // Get user info from JWT token
  const userId = req.user.id;
  const userRole = req.user.role;
  
  // Determine userType based on role
  let userType = 'candidate';
  if (userRole === 'Nhà tuyển dụng') {
    userType = 'employer';
  } else if (userRole === 'Quản trị' || userRole === 'Siêu quản trị viên') {
    userType = 'admin';
  }

  if (!title || !content) {
    db.close();
    return res.status(400).json({ success: false, error: 'Thiếu thông tin bài viết' });
  }

  const sql = `
    INSERT INTO CareerGuide (title, content, authorId, authorType, createdAt, views)
    VALUES (?, ?, ?, ?, datetime('now'), 0)
  `;

  db.run(sql, [title, content, userId, userType], function(err) {
    db.close();
    if (err) {
      return res.status(500).json({ success: false, error: 'Lỗi khi tạo bài viết' });
    }

    res.json({ success: true, postId: this.lastID, message: 'Đăng bài thành công' });
  });
});

// Add comment (authenticated)
router.post('/:id/comments', authenticateToken, (req, res) => {
  const db = new sqlite3.Database(dbPath);
  const { id } = req.params;
  const { content } = req.body;
  
  // Get user info from JWT token
  const userId = req.user.id;
  const userRole = req.user.role;
  
  // Determine userType based on role
  let userType = 'candidate';
  if (userRole === 'Nhà tuyển dụng') {
    userType = 'employer';
  } else if (userRole === 'Quản trị' || userRole === 'Siêu quản trị viên') {
    userType = 'admin';
  }

  if (!content) {
    db.close();
    return res.status(400).json({ success: false, error: 'Nội dung bình luận không được để trống' });
  }

  const sql = `
    INSERT INTO CareerGuideComment (postId, userId, userType, content, createdAt)
    VALUES (?, ?, ?, ?, datetime('now'))
  `;

  db.run(sql, [id, userId, userType, content], function(err) {
    db.close();
    if (err) {
      return res.status(500).json({ success: false, error: 'Lỗi khi thêm bình luận' });
    }

    res.json({ success: true, commentId: this.lastID, message: 'Bình luận thành công' });
  });
});

// Delete post (admin or author)
router.delete('/:id', authenticateToken, (req, res) => {
  const db = new sqlite3.Database(dbPath);
  const { id } = req.params;
  
  // Get user info from JWT token
  const userId = req.user.id;
  const userRole = req.user.role;
  const isAdmin = userRole === 'Quản trị' || userRole === 'Siêu quản trị viên';
  
  // Determine userType based on role
  let userType = 'candidate';
  if (userRole === 'Nhà tuyển dụng') {
    userType = 'employer';
  } else if (isAdmin) {
    userType = 'admin';
  }

  // Check if user is author or admin
  const checkSql = 'SELECT authorId, authorType FROM CareerGuide WHERE id = ?';
  
  db.get(checkSql, [id], (err, post) => {
    if (err) {
      db.close();
      return res.status(500).json({ success: false, error: 'Lỗi database' });
    }

    if (!post) {
      db.close();
      return res.status(404).json({ success: false, error: 'Không tìm thấy bài viết' });
    }

    const isAuthor = Number(post.authorId) === Number(userId) && post.authorType === userType;
    
    if (!isAdmin && !isAuthor) {
      db.close();
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa bài viết này' });
    }

    // Delete comments first
    db.run('DELETE FROM CareerGuideComment WHERE postId = ?', [id], (err) => {
      if (err) {
        db.close();
        return res.status(500).json({ success: false, error: 'Lỗi khi xóa bình luận' });
      }

      // Delete post
      db.run('DELETE FROM CareerGuide WHERE id = ?', [id], function(err) {
        db.close();
        if (err) {
          return res.status(500).json({ success: false, error: 'Lỗi khi xóa bài viết' });
        }
        res.json({ success: true, message: 'Xóa bài viết thành công' });
      });
    });
  });
});

// Delete comment (admin or author)
router.delete('/:postId/comments/:commentId', authenticateToken, (req, res) => {
  const db = new sqlite3.Database(dbPath);
  const { commentId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const isAdmin = userRole === 'Quản trị' || userRole === 'Siêu quản trị viên';

  let userType = 'candidate';
  if (userRole === 'Nhà tuyển dụng') {
    userType = 'employer';
  } else if (isAdmin) {
    userType = 'admin';
  }

  const checkSql = 'SELECT userId, userType FROM CareerGuideComment WHERE id = ?';
  
  db.get(checkSql, [commentId], (err, comment) => {
    if (err) {
      db.close();
      return res.status(500).json({ success: false, error: 'Lỗi database' });
    }

    if (!comment) {
      db.close();
      return res.status(404).json({ success: false, error: 'Không tìm thấy bình luận' });
    }

    const isAuthor = Number(comment.userId) === Number(userId) && comment.userType === userType;
    
    if (!isAdmin && !isAuthor) {
      db.close();
      return res.status(403).json({ success: false, error: 'Bạn không có quyền xóa bình luận này' });
    }

    db.run('DELETE FROM CareerGuideComment WHERE id = ?', [commentId], function(err) {
      db.close();
      if (err) {
        return res.status(500).json({ success: false, error: 'Lỗi khi xóa bình luận' });
      }

      res.json({ success: true, message: 'Xóa bình luận thành công' });
    });
  });
});

module.exports = router;
