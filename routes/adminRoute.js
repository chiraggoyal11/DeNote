const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/user');
const Note = require('../models/note');
const Comment = require('../models/comment');
const Report = require('../models/report');
const AuditLog = require('../models/auditLog');
const Notification = require('../models/notification');
const Follow = require('../models/follow');
const Collection = require('../models/collection');
const user_jwt = require('../middleware/jwt');
const requireRole = require('../middleware/requireRole');
const { writeAudit, serializeAudit } = require('../utils/audit');
const { createNotification } = require('../utils/notifications');
const { ROLES, normalizeRole, roleAtLeast } = require('../utils/roles');
const { serializeNote } = require('../utils/notesHelpers');
const { purgeIfDue } = require('../utils/accountDeletion');

async function loadMe(req) {
    if (!req.user?.id) return null;
    const user = await User.findById(req.user.id);
    if (!user) return null;
    if (await purgeIfDue(user)) return null;
    return user;
}

function serializeReport(doc) {
    const r = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    return {
        _id: r._id,
        targetType: r.targetType,
        targetId: r.targetId,
        targetLabel: r.targetLabel || '',
        reporterId: r.reporterId,
        reporterUsername: r.reporterUsername || '',
        reason: r.reason,
        status: r.status,
        resolutionNote: r.resolutionNote || '',
        reviewedBy: r.reviewedBy || null,
        reviewedAt: r.reviewedAt || null,
        createdAt: r.createdAt
    };
}

// ——— Student/contributor reporting ———
router.post('/reports', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        if (me.restricted) {
            return res.status(403).json({ success: false, msg: me.restrictionReason || 'Account restricted.', code: 'ACCOUNT_RESTRICTED' });
        }

        const targetType = String(req.body.targetType || '').trim();
        const targetId = req.body.targetId;
        const reason = String(req.body.reason || '').trim().slice(0, 500);

        if (!['note', 'comment', 'user'].includes(targetType)) {
            return res.status(400).json({ success: false, msg: 'targetType must be note, comment, or user.' });
        }
        if (!mongoose.isValidObjectId(targetId)) {
            return res.status(400).json({ success: false, msg: 'Valid targetId is required.' });
        }
        if (!reason || reason.length < 3) {
            return res.status(400).json({ success: false, msg: 'Please provide a short reason (3+ characters).' });
        }

        let targetLabel = '';
        if (targetType === 'note') {
            const note = await Note.findById(targetId);
            if (!note) return res.status(404).json({ success: false, msg: 'Note not found.' });
            targetLabel = note.title;
        } else if (targetType === 'comment') {
            const comment = await Comment.findById(targetId);
            if (!comment) return res.status(404).json({ success: false, msg: 'Comment not found.' });
            targetLabel = (comment.body || '').slice(0, 80);
        } else {
            const user = await User.findById(targetId);
            if (!user) return res.status(404).json({ success: false, msg: 'User not found.' });
            if (String(user._id) === String(me._id)) {
                return res.status(400).json({ success: false, msg: 'You cannot report yourself.' });
            }
            targetLabel = `@${user.username}`;
        }

        const existing = await Report.findOne({
            reporterId: me._id,
            targetType,
            targetId,
            status: 'pending'
        });
        if (existing) {
            return res.status(200).json({
                success: true,
                msg: 'You already have a pending report for this item.',
                report: serializeReport(existing)
            });
        }

        const report = await Report.create({
            targetType,
            targetId,
            targetLabel,
            reporterId: me._id,
            reporterUsername: me.username,
            reason,
            status: 'pending'
        });

        await writeAudit({
            actorId: me._id,
            actorUsername: me.username,
            action: 'report.create',
            targetType,
            targetId,
            meta: { reason: reason.slice(0, 120) }
        });

        res.status(201).json({ success: true, report: serializeReport(report) });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to submit report' });
    }
});

// ——— Moderation queue ———
router.get('/admin/reports', user_jwt, requireRole('moderator'), async (req, res) => {
    try {
        const status = req.query.status || 'pending';
        const filter = {};
        if (status !== 'all') filter.status = status;
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
        const reports = await Report.find(filter).sort({ createdAt: -1 }).limit(limit);
        res.status(200).json({
            success: true,
            reports: reports.map(serializeReport)
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load reports' });
    }
});

router.post('/admin/reports/:id/resolve', user_jwt, requireRole('moderator'), async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ success: false, msg: 'Report not found.' });
        if (report.status !== 'pending') {
            return res.status(400).json({ success: false, msg: `Report is already ${report.status}.` });
        }

        const resolutionNote = String(req.body.resolutionNote || '').trim().slice(0, 500);
        report.status = 'resolved';
        report.resolutionNote = resolutionNote;
        report.reviewedBy = req.dbUser._id;
        report.reviewedAt = new Date();
        await report.save();

        await createNotification({
            userId: report.reporterId,
            type: 'system',
            actorId: req.dbUser._id,
            actorUsername: req.dbUser.username,
            message: `Your report was resolved${resolutionNote ? `: ${resolutionNote}` : '.'}`
        });

        await writeAudit({
            actorId: req.dbUser._id,
            actorUsername: req.dbUser.username,
            action: 'report.resolve',
            targetType: 'report',
            targetId: report._id,
            meta: { targetType: report.targetType, targetId: String(report.targetId) }
        });

        res.status(200).json({ success: true, report: serializeReport(report) });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to resolve report' });
    }
});

router.post('/admin/reports/:id/reject', user_jwt, requireRole('moderator'), async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ success: false, msg: 'Report not found.' });
        if (report.status !== 'pending') {
            return res.status(400).json({ success: false, msg: `Report is already ${report.status}.` });
        }

        const resolutionNote = String(req.body.resolutionNote || '').trim().slice(0, 500);
        report.status = 'rejected';
        report.resolutionNote = resolutionNote;
        report.reviewedBy = req.dbUser._id;
        report.reviewedAt = new Date();
        await report.save();

        await createNotification({
            userId: report.reporterId,
            type: 'system',
            actorId: req.dbUser._id,
            actorUsername: req.dbUser.username,
            message: `Your report was reviewed and closed${resolutionNote ? `: ${resolutionNote}` : '.'}`
        });

        await writeAudit({
            actorId: req.dbUser._id,
            actorUsername: req.dbUser.username,
            action: 'report.reject',
            targetType: 'report',
            targetId: report._id
        });

        res.status(200).json({ success: true, report: serializeReport(report) });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to reject report' });
    }
});

// ——— Verify notes ———
router.post('/admin/notes/:id/verify', user_jwt, requireRole('moderator'), async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) return res.status(404).json({ success: false, msg: 'Note not found.' });

        note.isVerified = true;
        note.verifiedBy = req.dbUser._id;
        note.verifiedAt = new Date();
        await note.save();

        if (note.uploaderId) {
            await createNotification({
                userId: note.uploaderId,
                type: 'system',
                actorId: req.dbUser._id,
                actorUsername: req.dbUser.username,
                noteId: note._id,
                noteCid: note.cid,
                message: `Your note “${note.title}” was verified`
            });
        }

        await writeAudit({
            actorId: req.dbUser._id,
            actorUsername: req.dbUser.username,
            action: 'note.verify',
            targetType: 'note',
            targetId: note._id
        });

        res.status(200).json({
            success: true,
            note: serializeNote(note, { userId: String(req.dbUser._id), username: req.dbUser.username })
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to verify note' });
    }
});

router.post('/admin/notes/:id/unverify', user_jwt, requireRole('moderator'), async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) return res.status(404).json({ success: false, msg: 'Note not found.' });
        note.isVerified = false;
        note.verifiedBy = null;
        note.verifiedAt = null;
        await note.save();

        await writeAudit({
            actorId: req.dbUser._id,
            actorUsername: req.dbUser.username,
            action: 'note.unverify',
            targetType: 'note',
            targetId: note._id
        });

        res.status(200).json({
            success: true,
            note: serializeNote(note, { userId: String(req.dbUser._id), username: req.dbUser.username })
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to unverify note' });
    }
});

router.delete('/admin/notes/:id', user_jwt, requireRole('moderator'), async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) return res.status(404).json({ success: false, msg: 'Note not found.' });
        const id = note._id;
        const title = note.title;
        await note.deleteOne();
        await Comment.updateMany({ noteId: id }, { $set: { deleted: true, body: '[deleted]' } });

        await writeAudit({
            actorId: req.dbUser._id,
            actorUsername: req.dbUser.username,
            action: 'note.remove',
            targetType: 'note',
            targetId: id,
            meta: { title }
        });

        res.status(200).json({ success: true, msg: 'Note removed.' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to remove note' });
    }
});

router.delete('/admin/comments/:id', user_jwt, requireRole('moderator'), async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ success: false, msg: 'Comment not found.' });
        comment.deleted = true;
        comment.body = '[deleted]';
        comment.updatedAt = new Date();
        await comment.save();

        await writeAudit({
            actorId: req.dbUser._id,
            actorUsername: req.dbUser.username,
            action: 'comment.remove',
            targetType: 'comment',
            targetId: comment._id
        });

        res.status(200).json({ success: true, msg: 'Comment removed.' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to remove comment' });
    }
});

// ——— User management (admin) ———
router.post('/admin/users/:id/restrict', user_jwt, requireRole('admin'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, msg: 'User not found.' });
        if (roleAtLeast(user.role, 'admin') && String(user._id) !== String(req.dbUser._id)) {
            return res.status(403).json({ success: false, msg: 'Cannot restrict another admin.' });
        }

        user.restricted = true;
        user.restrictionReason = String(req.body.reason || 'Account restricted by admin.').trim().slice(0, 300);
        user.restrictedAt = new Date();
        await user.save();

        await writeAudit({
            actorId: req.dbUser._id,
            actorUsername: req.dbUser.username,
            action: 'user.restrict',
            targetType: 'user',
            targetId: user._id,
            meta: { reason: user.restrictionReason }
        });

        res.status(200).json({
            success: true,
            user: { _id: user._id, username: user.username, restricted: true, restrictionReason: user.restrictionReason }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to restrict user' });
    }
});

router.post('/admin/users/:id/unrestrict', user_jwt, requireRole('admin'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, msg: 'User not found.' });
        user.restricted = false;
        user.restrictionReason = '';
        user.restrictedAt = null;
        await user.save();

        await writeAudit({
            actorId: req.dbUser._id,
            actorUsername: req.dbUser.username,
            action: 'user.unrestrict',
            targetType: 'user',
            targetId: user._id
        });

        res.status(200).json({
            success: true,
            user: { _id: user._id, username: user.username, restricted: false }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to unrestrict user' });
    }
});

router.put('/admin/users/:id/role', user_jwt, requireRole('admin'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, msg: 'User not found.' });
        const role = normalizeRole(req.body.role);
        if (!ROLES.includes(role)) {
            return res.status(400).json({ success: false, msg: `Invalid role. Use: ${ROLES.join(', ')}` });
        }
        if (String(user._id) === String(req.dbUser._id) && role !== 'admin') {
            return res.status(400).json({ success: false, msg: 'You cannot demote yourself.' });
        }

        const previous = user.role;
        user.role = role;
        await user.save();

        await writeAudit({
            actorId: req.dbUser._id,
            actorUsername: req.dbUser.username,
            action: 'user.role',
            targetType: 'user',
            targetId: user._id,
            meta: { previous, role }
        });

        res.status(200).json({
            success: true,
            user: { _id: user._id, username: user.username, role: user.role }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to update role' });
    }
});

router.get('/admin/users', user_jwt, requireRole('admin'), async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const filter = {};
        if (q) {
            filter.$or = [
                { username: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { displayName: { $regex: q, $options: 'i' } }
            ];
        }
        const users = await User.find(filter)
            .sort({ username: 1 })
            .limit(50)
            .select('username displayName email role restricted restrictionReason createdAt');
        res.status(200).json({
            success: true,
            users: users.map((u) => ({
                _id: u._id,
                username: u.username,
                displayName: u.displayName || u.username,
                email: u.email || null,
                role: normalizeRole(u.role),
                restricted: Boolean(u.restricted),
                restrictionReason: u.restrictionReason || ''
            }))
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to list users' });
    }
});

// ——— Dashboard stats ———
router.get('/admin/stats', user_jwt, requireRole('moderator'), async (req, res) => {
    try {
        const [
            totalUsers,
            restrictedUsers,
            totalNotes,
            verifiedNotes,
            pendingReports,
            totalReports,
            totalComments,
            totalFollows,
            totalCollections,
            recentUploads
        ] = await Promise.all([
            User.countDocuments({}),
            User.countDocuments({ restricted: true }),
            Note.countDocuments({ isLatest: { $ne: false } }),
            Note.countDocuments({ isVerified: true }),
            Report.countDocuments({ status: 'pending' }),
            Report.countDocuments({}),
            Comment.countDocuments({ deleted: { $ne: true } }),
            Follow.countDocuments({}),
            Collection.countDocuments({}),
            Note.find({ isLatest: { $ne: false } }).sort({ uploadedAt: -1 }).limit(8).select('title uploader uploadedAt likeCount viewCount isVerified cid')
        ]);

        const popularSubjects = await Note.aggregate([
            { $match: { isLatest: { $ne: false } } },
            { $group: { _id: '$subject', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 8 }
        ]);

        res.status(200).json({
            success: true,
            stats: {
                totalUsers,
                restrictedUsers,
                totalNotes,
                verifiedNotes,
                pendingReports,
                totalReports,
                totalComments,
                totalFollows,
                totalCollections,
                popularSubjects: popularSubjects.map((s) => ({ subject: s._id || 'Unknown', count: s.count })),
                recentUploads: recentUploads.map((n) => ({
                    _id: n._id,
                    title: n.title,
                    uploader: n.uploader,
                    uploadedAt: n.uploadedAt,
                    likeCount: n.likeCount || 0,
                    viewCount: n.viewCount || 0,
                    isVerified: Boolean(n.isVerified),
                    cid: n.cid
                }))
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load admin stats' });
    }
});

router.get('/admin/audit-logs', user_jwt, requireRole('moderator'), async (req, res) => {
    try {
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 40));
        const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit);
        res.status(200).json({
            success: true,
            logs: logs.map(serializeAudit)
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load audit logs' });
    }
});

module.exports = router;
