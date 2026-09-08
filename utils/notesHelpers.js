const mongoose = require('mongoose');
const {
    normalizeResourceType,
    resourceTypeLabel,
    computeQualityScore,
    qualityScoreExplanation
} = require('./resourceTypes');

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
    const resourceType = normalizeResourceType(doc.resourceType);

    let favoritedByMe = false;
    if (favoriteNoteIds && favoriteNoteIds.has(noteId)) favoritedByMe = true;
    else if (favoriteCids && cid && favoriteCids.has(cid)) favoritedByMe = true;

    const qualityScore = computeQualityScore(doc);

    return {
        _id: doc._id,
        title: doc.title,
        subject: doc.subject,
        branch: doc.branch,
        sem: doc.sem,
        description: doc.description || '',
        resourceType,
        resourceTypeLabel: resourceTypeLabel(resourceType),
        tags: Array.isArray(doc.tags) ? doc.tags : [],
        college: doc.college || '',
        university: doc.university || '',
        examYear: doc.examYear || '',
        examType: doc.examType || '',
        uploader: doc.uploader,
        uploaderId: doc.uploaderId || null,
        cid: doc.cid,
        fileUrl: doc.fileUrl || null,
        fileHash: doc.fileHash || null,
        uploadedAt: doc.uploadedAt,
        likeCount,
        viewCount: doc.viewCount || 0,
        downloadCount: doc.downloadCount || 0,
        favoriteCount: doc.favoriteCount || 0,
        shareCount: doc.shareCount || 0,
        isVerified: Boolean(doc.isVerified),
        verifiedAt: doc.verifiedAt || null,
        qualityScore,
        qualityScoreExplanation: qualityScoreExplanation(doc),
        version: doc.version || 1,
        isLatest: doc.isLatest !== false,
        rootNoteId: doc.rootNoteId || doc._id || null,
        parentVersionId: doc.parentVersionId || null,
        changelog: doc.changelog || '',
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
        userId,
        resourceType,
        tag,
        tags,
        college,
        university,
        examYear,
        examType,
        verified
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
    if (college) filter.college = { $regex: escapeRegex(college), $options: 'i' };
    if (university) filter.university = { $regex: escapeRegex(university), $options: 'i' };
    if (examYear) filter.examYear = String(examYear).trim();
    if (examType) filter.examType = { $regex: escapeRegex(examType), $options: 'i' };

    if (resourceType && resourceType !== 'all') {
        filter.resourceType = normalizeResourceType(resourceType);
    }

    const tagList = [];
    if (tag) tagList.push(String(tag).trim().toLowerCase());
    if (tags) {
        String(tags)
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
            .forEach((t) => tagList.push(t));
    }
    if (tagList.length === 1) {
        filter.tags = tagList[0];
    } else if (tagList.length > 1) {
        filter.tags = { $all: [...new Set(tagList)] };
    }

    if (verified === '1' || verified === 'true') {
        filter.isVerified = true;
    }

    // Default browse/mine shows only latest versions (legacy notes without isLatest still appear)
    const includeVersions = query.includeVersions === '1' || query.includeVersions === 'true';
    if (!includeVersions) {
        filter.isLatest = { $ne: false };
    }

    if (q) {
        const rx = { $regex: escapeRegex(q), $options: 'i' };
        const textOr = [
            { title: rx },
            { subject: rx },
            { uploader: rx },
            { branch: rx },
            { sem: rx },
            { description: rx },
            { college: rx },
            { tags: rx },
            { university: rx },
            { examType: rx }
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

function sortSpec(sort) {
    switch (String(sort || 'recent')) {
        case 'likes':
        case 'most_liked':
            return { likeCount: -1, uploadedAt: -1 };
        case 'views':
        case 'most_viewed':
            return { viewCount: -1, uploadedAt: -1 };
        case 'downloads':
        case 'most_downloaded':
            return { downloadCount: -1, uploadedAt: -1 };
        case 'quality':
        case 'highest_rated':
            // Approximate via likes+views until stored score exists
            return { likeCount: -1, viewCount: -1, uploadedAt: -1 };
        case 'oldest':
            return { uploadedAt: 1 };
        case 'recent':
        case 'newest':
        default:
            return { uploadedAt: -1 };
    }
}

module.exports = {
    viewerId,
    isNoteOwner,
    serializeNote,
    loadFavoriteSets,
    escapeRegex,
    buildNotesQuery,
    sortSpec
};
