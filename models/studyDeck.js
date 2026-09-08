const mongoose = require('mongoose');

const studyDeckSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    subject: {
        type: String,
        trim: true,
        default: '',
        index: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: 400,
        default: ''
    },
    noteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
        default: null
    },
    cardCount: {
        type: Number,
        default: 0
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

studyDeckSchema.index({ ownerId: 1, updatedAt: -1 });

module.exports = mongoose.model('StudyDeck', studyDeckSchema);
