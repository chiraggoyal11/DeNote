const Notification = require('../models/notification');

async function createNotification({
    userId,
    type,
    actorId = null,
    actorUsername = '',
    noteId = null,
    noteCid = '',
    commentId = null,
    message
}) {
    if (!userId || !message) return null;
    // Don't notify yourself
    if (actorId && String(userId) === String(actorId)) return null;

    try {
        return await Notification.create({
            userId,
            type,
            actorId,
            actorUsername,
            noteId,
            noteCid,
            commentId,
            message: String(message).slice(0, 280),
            read: false
        });
    } catch (err) {
        console.log('createNotification failed:', err.message);
        return null;
    }
}

function serializeNotification(doc) {
    const n = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    return {
        _id: n._id,
        type: n.type,
        actorId: n.actorId || null,
        actorUsername: n.actorUsername || '',
        noteId: n.noteId || null,
        noteCid: n.noteCid || '',
        commentId: n.commentId || null,
        message: n.message,
        read: Boolean(n.read),
        createdAt: n.createdAt
    };
}

module.exports = {
    createNotification,
    serializeNotification
};
