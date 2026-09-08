const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    branch: {
        type: String,
        required: true,
        trim: true
    },
    sem: {
        type: String,
        required: true,
        trim: true
    },
    // Display name (kept in sync with username for older notes / browse UI)
    uploader: {
        type: String,
        default: 'Anon.'
    },
    // Canonical owner — used for edit/delete authorization
    uploaderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    cid: {
        type: String,
        required: true,
        index: true
    },
    fileUrl: {
        type: String
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    // Legacy field (string rating). Prefer likes / likeCount going forward.
    rating: {
        type: String
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    likeCount: {
        type: Number,
        default: 0,
        index: true
    }
});

noteSchema.index({ title: 'text', subject: 'text', uploader: 'text', branch: 'text' });

module.exports = mongoose.model('Note', noteSchema);
