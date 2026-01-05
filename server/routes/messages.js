const express = require('express');
const db = require('../config/sqlite');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
    });
});

// Unread conversations count (number of distinct senders with unread messages)
router.get('/unread-count', authenticateToken, authorizeRole(['Nhà tuyển dụng', 'Ứng viên']), async (req, res) => {
    try {
        const row = await dbGet(
            `SELECT COUNT(DISTINCT MaNguoiGui) AS c
             FROM TinNhan
             WHERE MaNguoiNhan = ? AND DaDoc = 0`,
            [req.user.id]
        );
        return res.json({ success: true, count: row?.c != null ? Number(row.c) : 0 });
    } catch (err) {
        console.error('Unread count error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
});

// Inbox: list conversations with last message + unread count
router.get('/inbox', authenticateToken, authorizeRole(['Nhà tuyển dụng', 'Ứng viên']), async (req, res) => {
    try {
        const rows = await dbAll(
            `SELECT
                u.MaNguoiDung AS userId,
                u.HoTen AS name,
                u.Email AS email,
                (SELECT NoiDung
                 FROM TinNhan t
                 WHERE (t.MaNguoiGui = u.MaNguoiDung AND t.MaNguoiNhan = ?)
                    OR (t.MaNguoiGui = ? AND t.MaNguoiNhan = u.MaNguoiDung)
                 ORDER BY datetime(t.NgayGui) DESC
                 LIMIT 1) AS lastMessage,
                (SELECT NgayGui
                 FROM TinNhan t
                 WHERE (t.MaNguoiGui = u.MaNguoiDung AND t.MaNguoiNhan = ?)
                    OR (t.MaNguoiGui = ? AND t.MaNguoiNhan = u.MaNguoiDung)
                 ORDER BY datetime(t.NgayGui) DESC
                 LIMIT 1) AS lastAt,
                (SELECT COUNT(*)
                 FROM TinNhan t
                 WHERE t.MaNguoiGui = u.MaNguoiDung AND t.MaNguoiNhan = ? AND t.DaDoc = 0) AS unread
             FROM NguoiDung u
             WHERE u.MaNguoiDung <> ?
               AND EXISTS (
                 SELECT 1 FROM TinNhan t
                 WHERE (t.MaNguoiGui = u.MaNguoiDung AND t.MaNguoiNhan = ?)
                    OR (t.MaNguoiGui = ? AND t.MaNguoiNhan = u.MaNguoiDung)
               )
             ORDER BY datetime(lastAt) DESC
             LIMIT 50`,
            [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
        );

        const inbox = rows.map((r) => ({
            userId: r.userId,
            name: r.name || r.email || `User ${r.userId}`,
            email: r.email || '',
            lastMessage: r.lastMessage || '',
            lastAt: r.lastAt || '',
            unread: r.unread != null ? Number(r.unread) : 0
        }));

        return res.json({ success: true, inbox });
    } catch (err) {
        console.error('Inbox error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
});

// Mark conversation as read (messages from other user -> current user)
router.patch('/mark-read/:userId', authenticateToken, authorizeRole(['Nhà tuyển dụng', 'Ứng viên']), async (req, res) => {
    try {
        const otherUserId = parseInt(req.params.userId, 10);
        if (Number.isNaN(otherUserId)) {
            return res.status(400).json({ success: false, error: 'userId không hợp lệ' });
        }

        await dbRun(
            'UPDATE TinNhan SET DaDoc = 1 WHERE MaNguoiGui = ? AND MaNguoiNhan = ? AND DaDoc = 0',
            [otherUserId, req.user.id]
        );

        return res.json({ success: true });
    } catch (err) {
        console.error('Mark read error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
});

// Send a message
router.post('/', authenticateToken, authorizeRole(['Nhà tuyển dụng', 'Ứng viên']), async (req, res) => {
    try {
        const toUserId = parseInt(req.body?.toUserId, 10);
        const jobId = req.body?.jobId != null ? parseInt(req.body.jobId, 10) : null;
        const content = String(req.body?.content || '').trim();

        if (Number.isNaN(toUserId)) {
            return res.status(400).json({ success: false, error: 'toUserId không hợp lệ' });
        }
        if (!content) {
            return res.status(400).json({ success: false, error: 'Nội dung tin nhắn không được trống' });
        }
        if (jobId != null && Number.isNaN(jobId)) {
            return res.status(400).json({ success: false, error: 'jobId không hợp lệ' });
        }

        const inserted = await dbRun(
            `INSERT INTO TinNhan (MaNguoiGui, MaNguoiNhan, MaTin, NoiDung)
             VALUES (?, ?, ?, ?)` ,
            [req.user.id, toUserId, jobId, content]
        );

        return res.status(201).json({
            success: true,
            message: {
                id: inserted.lastID,
                fromUserId: req.user.id,
                toUserId,
                jobId,
                content,
                createdAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Send message error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
});

// Get conversation with another user
router.get('/conversation/:userId', authenticateToken, authorizeRole(['Nhà tuyển dụng', 'Ứng viên']), async (req, res) => {
    try {
        const otherUserId = parseInt(req.params.userId, 10);
        if (Number.isNaN(otherUserId)) {
            return res.status(400).json({ success: false, error: 'userId không hợp lệ' });
        }

        const rows = await dbAll(
            `SELECT
                MaTinNhan,
                MaNguoiGui,
                MaNguoiNhan,
                MaTin,
                NoiDung,
                DaDoc,
                NgayGui
             FROM TinNhan
             WHERE (MaNguoiGui = ? AND MaNguoiNhan = ?)
                OR (MaNguoiGui = ? AND MaNguoiNhan = ?)
             ORDER BY datetime(NgayGui) ASC
             LIMIT 200`,
            [req.user.id, otherUserId, otherUserId, req.user.id]
        );

        const messages = rows.map((r) => ({
            id: r.MaTinNhan,
            fromUserId: r.MaNguoiGui,
            toUserId: r.MaNguoiNhan,
            jobId: r.MaTin,
            content: r.NoiDung,
            read: r.DaDoc === 1,
            createdAt: r.NgayGui
        }));

        return res.json({ success: true, messages });
    } catch (err) {
        console.error('Get conversation error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
});

module.exports = router;
