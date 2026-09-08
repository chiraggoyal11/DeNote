const mongoose = require('mongoose');

function viewerId(req) {
    return req.user?.id ? String(req.user.id) : null;
}

function isNoteOwner(note, userId, username) {
    if (!note || !userId) return false;
    if (note.uploaderId && String(note.uploaderId) === String(userId)) return true;
    // Legacy notes without uploaderId: fall back to username match
    if (!note.uploaderId && username && note.uploader && note.uploader === username) return true;
    return false;
}

function serializeNote(note, { userId = null, username = null, favoriteCids = null, favoriteNoteIds = null } = {}) {
    const doc = typeof note.toObject === 'function' ? note.toObject() : { ...note };
    const likes = Array.isArray(doc.likes) ? doc.likes.map(String) : [];
    const likeCount = typeof doc.likeCount === 'number' ? doc.likeCount : likes.length;
    const cid = doc.cid;
    const noteId = String(doc._id);

    let favoritedByMe = false;
    if (favoriteNoteIds && favoriteNoteIds.has(noteId)) favoritedByMe = true;
    else if (favoriteCids && cid && favoriteCids.has(cid)) favoritedByMe = true;

    return {
        _id: doc._id,
        title: doc.title,
        subject: doc.subject,
        branch: doc.branch,
        sem: doc.sem,
        description: doc.description || '',
        uploader: doc.uploader,
        uploaderId: doc.uploaderId || null,
        cid: doc.cid,
        fileUrl: doc.fileUrl || null,
        uploadedAt: doc.uploadedAt,
        likeCount,
        likedByMe: userId ? likes.includes(String(userId)) : false,
        favoritedByMe,
        isOwner: isNoteOwner(doc, userId, username)
    };
}

async function loadFavoriteSets(user) {
    const favoriteCids = new Set();
    const favoriteNoteIds = new Set();
    if (!user?.fav) return { favoriteCids, favoriteNoteIds };
    for (const item of user.fav) {
        if (item?.cid) favoriteCids.add(item.cid);
        if (item?.noteId) favoriteNoteIds.add(String(item.noteId));
    }
    return { favoriteCids, favoriteNoteIds };
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildNotesQuery(query) {
    const {
        q,
        title,
        branch,
        sem,
        subject,
        uploader,
        mine,
        userId
    } = query;

    const filter = {};

    if (mine === '1' || mine === 'true') {
        if (userId && mongoose.isValidObjectId(userId)) {
            filter.$or = [
                { uploaderId: userId },
                { uploaderId: { $exists: false }, uploader: query.username }
            ];
        } else if (query.username) {
            filter.uploader = query.username;
        }
    }

    if (uploader) {
        filter.uploader = { $regex: escapeRegex(uploader), $options: 'i' };
    }
    if (branch) filter.branch = { $regex: escapeRegex(branch), $options: 'i' };
    if (sem) filter.sem = { $regex: escapeRegex(sem), $options: 'i' };
    if (subject) filter.subject = { $regex: escapeRegex(subject), $options: 'i' };
    if (title) filter.title = { $regex: escapeRegex(title), $options: 'i' };

    if (q) {
        const rx = { $regex: escapeRegex(q), $options: 'i' };
        const textOr = [
            { title: rx },
            { subject: rx },
            { uploader: rx },
            { branch: rx },
            { sem: rx },
            { description: rx }
        ];
        if (filter.$or) {
            filter.$and = [{ $or: filter.$or }, { $or: textOr }];
            delete filter.$or;
        } else {
            filter.$or = textOr;
        }
    }

    return filter;
}

module.exports = {
    viewerId,
    isNoteOwner,
    serializeNote,
    loadFavoriteSets,
    escapeRegex,
    buildNotesQuery
};
