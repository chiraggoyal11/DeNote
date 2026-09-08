const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/user');
const Note = require('../models/note');
const Comment = require('../models/comment');
const Follow = require('../models/follow');
const Notification = require('../models/notification');
const Collection = require('../models/collection');
const user_jwt = require('../middleware/jwt');
const optionalJwt = require('../middleware/optionalJwt');
const { serializeNote, loadFavoriteSets } = require('../utils/notesHelpers');
const { createNotification, serializeNotification } = require('../utils/notifications');
const { computeBadges } = require('../utils/badges');
const { purgeIfDue } = require('../utils/accountDeletion');

async function loadUser(req) {
    if (!req.user?.id) return null;
    const user = await User.findById(req.user.id);
    if (!user) return null;
    if (await purgeIfDue(user)) return null;
    return user;
}

function serializeComment(doc, { userId = null } = {}) {
    const c = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    return {
        _id: c._id,
        noteId: c.noteId,
        authorId: c.authorId,
        authorUsername: c.authorUsername || '',
        body: c.deleted ? '[deleted]' : c.body,
        parentId: c.parentId || null,
        deleted: Boolean(c.deleted),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        isOwner: userId ? String(c.authorId) === String(userId) : false
    };
}

async function profileStats(userId) {
    const oid = new mongoose.Types.ObjectId(String(userId));
    const [uploadCount, agg, followerCount, followingCount, commentCount, verifiedCount] = await Promise.all([
        Note.countDocuments({ uploaderId: oid, isLatest: { $ne: false } }),
        Note.aggregate([
            { $match: { uploaderId: oid } },
            { $group: { _id: null, likes: { $sum: '$likeCount' }, downloads: { $sum: '$downloadCount' } } }
        ]),
        Follow.countDocuments({ followingId: oid }),
        Follow.countDocuments({ followerId: oid }),
        Comment.countDocuments({ authorId: oid, deleted: { $ne: true } }),
        Note.countDocuments({ uploaderId: oid, isVerified: true })
    ]);

    return {
        uploadCount,
        likeReceived: agg[0]?.likes || 0,
        downloadCount: agg[0]?.downloads || 0,
        followerCount,
        followingCount,
        commentCount,
        isVerifiedUploader: verifiedCount > 0
    };
}

async function buildPublicProfile(user, viewerId = null) {
    const stats = await profileStats(user._id);
    const badges = computeBadges(stats);

    let isFollowing = false;
    if (viewerId && String(viewerId) !== String(user._id)) {
        const edge = await Follow.findOne({ followerId: viewerId, followingId: user._id });
        isFollowing = Boolean(edge);
    }

    const notes = await Note.find({ uploaderId: user._id, isLatest: { $ne: false } })
        .sort({ uploadedAt: -1 })
        .limit(12);

    const publicCollections = await Collection.find({ ownerId: user._id, isPublic: true })
        .sort({ updatedAt: -1 })
        .limit(12);

    return {
        _id: user._id,
        username: user.username,
        displayName: user.displayName || user.username,
        picture: user.picture || null,
        bio: user.bio || '',
        college: user.college || '',
        branch: user.branch || '',
        semester: user.semester || '',
        stats,
        badges,
        isFollowing,
        isSelf: viewerId ? String(viewerId) === String(user._id) : false,
        notes: notes.map((n) => serializeNote(n, { userId: viewerId, username: null })),
        collections: publicCollections.map((c) => ({
            _id: c._id,
            name: c.name,
            description: c.description || '',
            noteCount: (c.notes || []).length,
            shareId: c.shareId || null
        }))
    };
}

// ——— Public profiles ———
router.get('/users/:username', optionalJwt, async (req, res) => {
    try {
        const username = String(req.params.username || '').trim();
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ success: false, msg: 'User not found.' });

        const viewer = await loadUser(req);
        const profile = await buildPublicProfile(user, viewer?._id || null);
        res.status(200).json({ success: true, profile });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load profile' });
    }
});

router.get('/users/:username/followers', optionalJwt, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ success: false, msg: 'User not found.' });
        const edges = await Follow.find({ followingId: user._id }).sort({ createdAt: -1 }).limit(100);
        const ids = edges.map((e) => e.followerId);
        const users = await User.find({ _id: { $in: ids } }).select('username displayName picture');
        const byId = new Map(users.map((u) => [String(u._id), u]));
        res.status(200).json({
            success: true,
            users: ids.map((id) => {
                const u = byId.get(String(id));
                return u
                    ? { _id: u._id, username: u.username, displayName: u.displayName || u.username, picture: u.picture || null }
                    : null;
            }).filter(Boolean)
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load followers' });
    }
});

router.get('/users/:username/following', optionalJwt, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ success: false, msg: 'User not found.' });
        const edges = await Follow.find({ followerId: user._id }).sort({ createdAt: -1 }).limit(100);
        const ids = edges.map((e) => e.followingId);
        const users = await User.find({ _id: { $in: ids } }).select('username displayName picture');
        const byId = new Map(users.map((u) => [String(u._id), u]));
        res.status(200).json({
            success: true,
            users: ids.map((id) => {
                const u = byId.get(String(id));
                return u
                    ? { _id: u._id, username: u.username, displayName: u.displayName || u.username, picture: u.picture || null }
                    : null;
            }).filter(Boolean)
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load following' });
    }
});

router.post('/users/:username/follow', user_jwt, async (req, res) => {
    try {
        const me = await loadUser(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const target = await User.findOne({ username: req.params.username });
        if (!target) return res.status(404).json({ success: false, msg: 'User not found.' });
        if (String(target._id) === String(me._id)) {
            return res.status(400).json({ success: false, msg: 'You cannot follow yourself.' });
        }

        try {
            await Follow.create({ followerId: me._id, followingId: target._id });
        } catch (err) {
            if (err.code !== 11000) throw err;
        }

        await createNotification({
            userId: target._id,
            type: 'follow',
            actorId: me._id,
            actorUsername: me.username,
            message: `@${me.username} started following you`
        });

        const followerCount = await Follow.countDocuments({ followingId: target._id });
        res.status(200).json({ success: true, following: true, followerCount });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to follow user' });
    }
});

router.delete('/users/:username/follow', user_jwt, async (req, res) => {
    try {
        const me = await loadUser(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const target = await User.findOne({ username: req.params.username });
        if (!target) return res.status(404).json({ success: false, msg: 'User not found.' });

        await Follow.deleteOne({ followerId: me._id, followingId: target._id });
        const followerCount = await Follow.countDocuments({ followingId: target._id });
        res.status(200).json({ success: true, following: false, followerCount });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to unfollow user' });
    }
});

// ——— Comments ———
router.get('/notes/:noteId/comments', optionalJwt, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.noteId)) {
            return res.status(400).json({ success: false, msg: 'Invalid note id.' });
        }
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 30));
        const skip = (page - 1) * limit;

        const filter = { noteId: req.params.noteId };
        const [total, comments] = await Promise.all([
            Comment.countDocuments(filter),
            Comment.find(filter).sort({ createdAt: 1 }).skip(skip).limit(limit)
        ]);

        const viewer = await loadUser(req);
        const serialized = comments.map((c) => serializeComment(c, { userId: viewer?._id }));

        // Nest replies under parents for convenience
        const roots = [];
        const byId = new Map(serialized.map((c) => [String(c._id), { ...c, replies: [] }]));
        for (const c of byId.values()) {
            if (c.parentId && byId.has(String(c.parentId))) {
                byId.get(String(c.parentId)).replies.push(c);
            } else if (!c.parentId) {
                roots.push(c);
            } else {
                roots.push(c);
            }
        }

        res.status(200).json({
            success: true,
            comments: roots,
            flat: serialized,
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit))
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load comments' });
    }
});

router.post('/notes/:noteId/comments', user_jwt, async (req, res) => {
    try {
        const me = await loadUser(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        if (!mongoose.isValidObjectId(req.params.noteId)) {
            return res.status(400).json({ success: false, msg: 'Invalid note id.' });
        }

        const note = await Note.findById(req.params.noteId);
        if (!note) return res.status(404).json({ success: false, msg: 'Note not found.' });

        const body = String(req.body.body || '').trim();
        if (!body) return res.status(400).json({ success: false, msg: 'Comment cannot be empty.' });
        if (body.length > 2000) {
            return res.status(400).json({ success: false, msg: 'Comment is too long (max 2000 characters).' });
        }

        let parentId = null;
        let parent = null;
        if (req.body.parentId) {
            if (!mongoose.isValidObjectId(req.body.parentId)) {
                return res.status(400).json({ success: false, msg: 'Invalid parent comment.' });
            }
            parent = await Comment.findById(req.body.parentId);
            if (!parent || String(parent.noteId) !== String(note._id)) {
                return res.status(400).json({ success: false, msg: 'Parent comment not found on this note.' });
            }
            parentId = parent._id;
        }

        const comment = await Comment.create({
            noteId: note._id,
            authorId: me._id,
            authorUsername: me.username,
            body,
            parentId
        });

        // Notify note owner
        if (note.uploaderId) {
            await createNotification({
                userId: note.uploaderId,
                type: parentId ? 'reply' : 'comment',
                actorId: me._id,
                actorUsername: me.username,
                noteId: note._id,
                noteCid: note.cid,
                commentId: comment._id,
                message: parentId
                    ? `@${me.username} replied on “${note.title}”`
                    : `@${me.username} commented on “${note.title}”`
            });
        }
        // Notify parent author on reply
        if (parent && String(parent.authorId) !== String(note.uploaderId)) {
            await createNotification({
                userId: parent.authorId,
                type: 'reply',
                actorId: me._id,
                actorUsername: me.username,
                noteId: note._id,
                noteCid: note.cid,
                commentId: comment._id,
                message: `@${me.username} replied to your comment`
            });
        }

        res.status(201).json({
            success: true,
            comment: serializeComment(comment, { userId: me._id })
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to post comment' });
    }
});

router.put('/comments/:id', user_jwt, async (req, res) => {
    try {
        const me = await loadUser(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const comment = await Comment.findById(req.params.id);
        if (!comment || comment.deleted) {
            return res.status(404).json({ success: false, msg: 'Comment not found.' });
        }
        if (String(comment.authorId) !== String(me._id)) {
            return res.status(403).json({ success: false, msg: 'Only the author can edit this comment.' });
        }
        const body = String(req.body.body || '').trim();
        if (!body) return res.status(400).json({ success: false, msg: 'Comment cannot be empty.' });
        comment.body = body.slice(0, 2000);
        comment.updatedAt = new Date();
        await comment.save();
        res.status(200).json({ success: true, comment: serializeComment(comment, { userId: me._id }) });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to edit comment' });
    }
});

router.delete('/comments/:id', user_jwt, async (req, res) => {
    try {
        const me = await loadUser(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const comment = await Comment.findById(req.params.id);
        if (!comment) return res.status(404).json({ success: false, msg: 'Comment not found.' });

        const note = await Note.findById(comment.noteId);
        const isAuthor = String(comment.authorId) === String(me._id);
        const isNoteOwner = note && note.uploaderId && String(note.uploaderId) === String(me._id);
        if (!isAuthor && !isNoteOwner) {
            return res.status(403).json({ success: false, msg: 'Not allowed to delete this comment.' });
        }

        comment.deleted = true;
        comment.body = '[deleted]';
        comment.updatedAt = new Date();
        await comment.save();
        res.status(200).json({ success: true, comment: serializeComment(comment, { userId: me._id }) });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to delete comment' });
    }
});

// ——— Notifications (Mongo + client polling; no Redis) ———
router.get('/notifications', user_jwt, async (req, res) => {
    try {
        const me = await loadUser(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
        const filter = { userId: me._id };
        if (unreadOnly) filter.read = false;

        const [items, unreadCount] = await Promise.all([
            Notification.find(filter).sort({ createdAt: -1 }).limit(limit),
            Notification.countDocuments({ userId: me._id, read: false })
        ]);

        res.status(200).json({
            success: true,
            notifications: items.map(serializeNotification),
            unreadCount
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load notifications' });
    }
});

router.get('/notifications/unread-count', user_jwt, async (req, res) => {
    try {
        const me = await loadUser(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const unreadCount = await Notification.countDocuments({ userId: me._id, read: false });
        res.status(200).json({ success: true, unreadCount });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load unread count' });
    }
});

router.post('/notifications/read', user_jwt, async (req, res) => {
    try {
        const me = await loadUser(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const ids = Array.isArray(req.body.ids) ? req.body.ids.filter((id) => mongoose.isValidObjectId(id)) : [];
        if (!ids.length) {
            return res.status(400).json({ success: false, msg: 'ids array is required.' });
        }
        await Notification.updateMany(
            { userId: me._id, _id: { $in: ids } },
            { $set: { read: true } }
        );
        const unreadCount = await Notification.countDocuments({ userId: me._id, read: false });
        res.status(200).json({ success: true, unreadCount });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to mark notifications read' });
    }
});

router.post('/notifications/read-all', user_jwt, async (req, res) => {
    try {
        const me = await loadUser(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        await Notification.updateMany({ userId: me._id, read: false }, { $set: { read: true } });
        res.status(200).json({ success: true, unreadCount: 0 });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to mark all read' });
    }
});

// ——— Activity (following feed, write-light) ———
router.get('/activity', user_jwt, async (req, res) => {
    try {
        const me = await loadUser(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const following = await Follow.find({ followerId: me._id }).select('followingId');
        const ids = following.map((f) => f.followingId);
        if (!ids.length) {
            return res.status(200).json({ success: true, notes: [], page: 1, total: 0, totalPages: 1 });
        }

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 12));
        const skip = (page - 1) * limit;
        const filter = { uploaderId: { $in: ids }, isLatest: { $ne: false } };
        const [total, notes] = await Promise.all([
            Note.countDocuments(filter),
            Note.find(filter).sort({ uploadedAt: -1 }).skip(skip).limit(limit)
        ]);
        const sets = await loadFavoriteSets(me);
        res.status(200).json({
            success: true,
            notes: notes.map((n) => serializeNote(n, {
                userId: String(me._id),
                username: me.username,
                ...sets
            })),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit))
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load activity' });
    }
});

module.exports = router;
