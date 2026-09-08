/**
 * Free-tier analytics helpers — aggregate existing Note counters.
 * No Redis, no event stream, no time-series store.
 */

function emptyTotals() {
    return {
        views: 0,
        downloads: 0,
        likes: 0,
        saves: 0,
        shares: 0,
        notes: 0
    };
}

function mapEngagementAgg(row) {
    return {
        views: row?.views || 0,
        downloads: row?.downloads || 0,
        likes: row?.likes || 0,
        saves: row?.saves || 0,
        shares: row?.shares || 0,
        notes: row?.notes || 0
    };
}

async function aggregateNoteEngagement(Note, match = {}) {
    const rows = await Note.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                views: { $sum: { $ifNull: ['$viewCount', 0] } },
                downloads: { $sum: { $ifNull: ['$downloadCount', 0] } },
                likes: { $sum: { $ifNull: ['$likeCount', 0] } },
                saves: { $sum: { $ifNull: ['$favoriteCount', 0] } },
                shares: { $sum: { $ifNull: ['$shareCount', 0] } },
                notes: { $sum: 1 }
            }
        }
    ]);
    return mapEngagementAgg(rows[0]);
}

function serializeCreatorNoteRow(note) {
    const doc = typeof note.toObject === 'function' ? note.toObject() : { ...note };
    return {
        _id: doc._id,
        title: doc.title,
        cid: doc.cid,
        subject: doc.subject || '',
        resourceType: doc.resourceType || 'notes',
        uploadedAt: doc.uploadedAt,
        isVerified: Boolean(doc.isVerified),
        viewCount: doc.viewCount || 0,
        downloadCount: doc.downloadCount || 0,
        likeCount: doc.likeCount || 0,
        favoriteCount: doc.favoriteCount || 0,
        shareCount: doc.shareCount || 0
    };
}

module.exports = {
    emptyTotals,
    mapEngagementAgg,
    aggregateNoteEngagement,
    serializeCreatorNoteRow
};
