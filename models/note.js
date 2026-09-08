const mongoose = require('mongoose');
const { RESOURCE_TYPE_VALUES, DEFAULT_RESOURCE_TYPE } = require('../utils/resourceTypes');

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
    description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
    },
    resourceType: {
        type: String,
        enum: RESOURCE_TYPE_VALUES,
        default: DEFAULT_RESOURCE_TYPE,
        index: true
    },
    tags: {
        type: [String],
        default: [],
        index: true
    },
    college: {
        type: String,
        trim: true,
        default: '',
        index: true
    },
    // Exact-file duplicate detection (SHA-256 hex)
    fileHash: {
        type: String,
        index: true,
        sparse: true
    },
    viewCount: {
        type: Number,
        default: 0,
        index: true
    },
    downloadCount: {
        type: Number,
        default: 0,
        index: true
    },
    // Denormalized save/share counters (Phase 5 analytics)
    favoriteCount: {
        type: Number,
        default: 0,
        index: true
    },
    shareCount: {
        type: Number,
        default: 0,
        index: true
    },
    // Role-gated verification (Phase 4 roles can flip this)
    isVerified: {
        type: Boolean,
        default: false,
        index: true
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    verifiedAt: {
        type: Date,
        default: null
    },
    // Optional PYQ metadata
    university: {
        type: String,
        trim: true,
        default: ''
    },
    examYear: {
        type: String,
        trim: true,
        default: ''
    },
    examType: {
        type: String,
        trim: true,
        default: ''
    },
    // Versioning — root chain + parent pointer
    rootNoteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
        index: true,
        default: null
    },
    parentVersionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
        default: null
    },
    version: {
        type: Number,
        default: 1,
        min: 1
    },
    isLatest: {
        type: Boolean,
        default: true,
        index: true
    },
    changelog: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
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

noteSchema.index({
    title: 'text',
    subject: 'text',
    uploader: 'text',
    branch: 'text',
    description: 'text',
    college: 'text',
    tags: 'text'
});
noteSchema.index({ branch: 1, sem: 1, subject: 1, uploadedAt: -1 });
noteSchema.index({ uploaderId: 1, uploadedAt: -1 });
noteSchema.index({ resourceType: 1, uploadedAt: -1 });
noteSchema.index({ resourceType: 1, likeCount: -1 });
noteSchema.index({ fileHash: 1, uploadedAt: -1 });
noteSchema.index({ rootNoteId: 1, version: 1 });
noteSchema.index({ rootNoteId: 1, isLatest: 1 });

module.exports = mongoose.model('Note', noteSchema);
