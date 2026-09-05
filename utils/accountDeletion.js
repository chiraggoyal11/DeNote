const axios = require('axios');
const User = require('../models/user');
const Note = require('../models/note');

const DELETION_DELAY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function scheduleDeletionDate(from = new Date()) {
    return new Date(from.getTime() + DELETION_DELAY_MS);
}

async function permanentlyDeleteUser(user) {
    if (!user) return;

    const notes = await Note.find({ uploader: user.username });
    for (const note of notes) {
        if (note.cid && process.env.PINATA) {
            try {
                await axios.delete(`https://api.pinata.cloud/pinning/unpin/${note.cid}`, {
                    headers: { Authorization: `Bearer ${process.env.PINATA}` }
                });
            } catch (err) {
                console.log(`Failed to unpin ${note.cid}:`, err.message);
            }
        }
    }
    await Note.deleteMany({ uploader: user.username });
    await User.deleteOne({ _id: user._id });
}

/**
 * If deletion was scheduled and the grace period has ended, hard-delete and return true.
 */
async function purgeIfDue(user) {
    if (!user?.deletionScheduledAt) return false;
    if (new Date(user.deletionScheduledAt).getTime() > Date.now()) return false;
    await permanentlyDeleteUser(user);
    return true;
}

module.exports = {
    DELETION_DELAY_MS,
    scheduleDeletionDate,
    permanentlyDeleteUser,
    purgeIfDue
};
