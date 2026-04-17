const express = require('express');
const db = require('../config/db');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { sendFirebaseMessageToToken } = require('../config/firebaseMessaging');

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

const isDuplicateColumnError = (error) => {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('duplicate column') || message.includes('duplicate field name') || message.includes('already exists');
};

let ensureFcmTokenColumnPromise = null;
const ensureFcmTokenColumn = async () => {
    if (!ensureFcmTokenColumnPromise) {
        ensureFcmTokenColumnPromise = (async () => {
            try {
                await dbRun('ALTER TABLE NguoiDung ADD COLUMN FcmToken TEXT');
            } catch (error) {
                if (!isDuplicateColumnError(error)) {
                    throw error;
                }
            }
        })().catch((error) => {
            ensureFcmTokenColumnPromise = null;
            throw error;
        });
    }

    return ensureFcmTokenColumnPromise;
};

const buildMessagePreview = (content) => {
    const text = String(content || '').trim();
    if (!text) {
        return 'Ban co tin nhan moi.';
    }

    if (text.length <= 120) {
        return text;
    }

    return `${text.slice(0, 117)}...`;
};

const resolveInboxPathByRole = (role) => {
    return String(role || '').trim() === 'Nhà tuyển dụng' ? '/employer/messages' : '/messages';
};

const sendPushForIncomingMessage = async ({ fromUserId, toUserId, content }) => {
    await ensureFcmTokenColumn();

    const recipient = await dbGet(
        'SELECT FcmToken, VaiTro FROM NguoiDung WHERE MaNguoiDung = ?',
        [toUserId]
    );

    const recipientToken = String(recipient?.FcmToken || '').trim();
    if (!recipientToken) {
        return { sent: false, reason: 'missing-recipient-token' };
    }

    const sender = await dbGet(
        'SELECT HoTen, Email FROM NguoiDung WHERE MaNguoiDung = ?',
        [fromUserId]
    );

    const senderName = String(sender?.HoTen || sender?.Email || 'Co nguoi').trim();
    const targetUrl = resolveInboxPathByRole(recipient?.VaiTro);

    return sendFirebaseMessageToToken({
        token: recipientToken,
        title: 'Tin nhan moi tren JobFinder',
        body: `${senderName}: ${buildMessagePreview(content)}`,
        data: {
            type: 'message',
            fromUserId: String(fromUserId || ''),
            toUserId: String(toUserId || ''),
            url: targetUrl
        }
    });
};

router.post('/fcm-token', authenticateToken, authorizeRole(['Nhà tuyển dụng', 'Ứng viên']), async (req, res) => {
    try {
        const token = String(req.body?.token || '').trim();
        if (!token || token.length < 20) {
            return res.status(400).json({ success: false, error: 'FCM token không hợp lệ' });
        }

        await ensureFcmTokenColumn();
        await dbRun('UPDATE NguoiDung SET FcmToken = ? WHERE MaNguoiDung = ?', [token, req.user.id]);

        return res.json({ success: true });
    } catch (err) {
        console.error('Save FCM token error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
});

router.delete('/fcm-token', authenticateToken, authorizeRole(['Nhà tuyển dụng', 'Ứng viên']), async (req, res) => {
    try {
        await ensureFcmTokenColumn();
        await dbRun('UPDATE NguoiDung SET FcmToken = NULL WHERE MaNguoiDung = ?', [req.user.id]);
        return res.json({ success: true });
    } catch (err) {
        console.error('Delete FCM token error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
});

// Unread conversations count (number of distinct senders with unread messages)
router.get('/unread-count', authenticateToken, authorizeRole(['Nhà tuyển dụng', 'Ứng viên']), async (req, res) => {
    try {
        return res.json({ success: true, count: 0 });
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
                                 WHERE 1 = 0) AS unread
             FROM NguoiDung u
             WHERE u.MaNguoiDung <> ?
               AND EXISTS (
                 SELECT 1 FROM TinNhan t
                 WHERE (t.MaNguoiGui = u.MaNguoiDung AND t.MaNguoiNhan = ?)
                    OR (t.MaNguoiGui = ? AND t.MaNguoiNhan = u.MaNguoiDung)
               )
             ORDER BY datetime(lastAt) DESC
             LIMIT 50`,
            [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]
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

        void otherUserId;

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

        void sendPushForIncomingMessage({
            fromUserId: req.user.id,
            toUserId,
            content
        }).catch((pushError) => {
            console.warn('FCM push skipped:', pushError?.message || pushError);
        });

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
            read: true,
            createdAt: r.NgayGui
        }));

        return res.json({ success: true, messages });
    } catch (err) {
        console.error('Get conversation error:', err);
        return res.status(500).json({ success: false, error: err.message || 'Server error' });
    }
});

module.exports = router;
