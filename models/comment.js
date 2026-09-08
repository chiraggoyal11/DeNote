const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    noteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
        required: true,
        index: true
    },
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    authorUsername: {
        type: String,
        trim: true,
        default: ''
    },
    body: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null,
        index: true
    },
    deleted: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

commentSchema.index({ noteId: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
