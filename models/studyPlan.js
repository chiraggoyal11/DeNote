const mongoose = require('mongoose');

const studyPlanSchema = new mongoose.Schema({
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
        maxlength: 160
    },
    subject: {
        type: String,
        trim: true,
        default: '',
        index: true
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ''
    },
    dueAt: {
        type: Date,
        default: null,
        index: true
    },
    status: {
        type: String,
        enum: ['todo', 'doing', 'done'],
        default: 'todo',
        index: true
    },
    deckId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudyDeck',
        default: null
    },
    noteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Note',
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date,
        default: null
    }
});

studyPlanSchema.index({ ownerId: 1, dueAt: 1, status: 1 });

module.exports = mongoose.model('StudyPlanItem', studyPlanSchema);
