/**
 * Compute free-tier badges from contribution stats (no separate badge store).
 */
function computeBadges(stats = {}) {
    const {
        uploadCount = 0,
        likeReceived = 0,
        downloadCount = 0,
        followerCount = 0,
        commentCount = 0,
        isVerifiedUploader = false
    } = stats;

    const badges = [];
    if (uploadCount >= 1) {
        badges.push({ id: 'first_upload', label: 'First Upload', description: 'Uploaded your first resource' });
    }
    if (uploadCount >= 5) {
        badges.push({ id: 'top_contributor', label: 'Top Contributor', description: 'Uploaded 5+ resources' });
    }
    if (likeReceived >= 10) {
        badges.push({ id: 'helpful_uploader', label: 'Helpful Uploader', description: 'Received 10+ upvotes' });
    }
    if (likeReceived >= 25 || followerCount >= 10) {
        badges.push({ id: 'community_favorite', label: 'Community Favorite', description: 'Popular with classmates' });
    }
    if (downloadCount >= 100) {
        badges.push({ id: 'hundred_downloads', label: '100 Downloads', description: 'Notes opened 100+ times' });
    }
    if (isVerifiedUploader) {
        badges.push({ id: 'verified_contributor', label: 'Verified Contributor', description: 'Has a verified note' });
    }
    if (commentCount >= 10) {
        badges.push({ id: 'conversationalist', label: 'Conversationalist', description: 'Left 10+ comments' });
    }
    return badges;
}

module.exports = {
    computeBadges
};
