const mongoose = require('mongoose');

const collectionItemSchema = new mongoose.Schema({
    noteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
        required: true
    },
    cid: {
        type: String,
        default: ''
    },
    order: {
        type: Number,
        default: 0
    }
}, { _id: false });

const collectionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 80
    },
    description: {
        type: String,
        trim: true,
        maxlength: 400,
        default: ''
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    ownerUsername: {
        type: String,
        trim: true,
        default: ''
    },
    isPublic: {
        type: Boolean,
        default: false,
        index: true
    },
    shareId: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    notes: {
        type: [collectionItemSchema],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

collectionSchema.index({ ownerId: 1, updatedAt: -1 });
collectionSchema.index({ isPublic: 1, updatedAt: -1 });

module.exports = mongoose.model('Collection', collectionSchema);
