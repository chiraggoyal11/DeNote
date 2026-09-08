const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema({
    deckId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudyDeck',
        required: true,
        index: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    front: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    back: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    subject: {
        type: String,
        trim: true,
        default: '',
        index: true
    },
    // SM-2 spaced repetition fields
    easeFactor: {
        type: Number,
        default: 2.5
    },
    intervalDays: {
        type: Number,
        default: 0
    },
    repetitions: {
        type: Number,
        default: 0
    },
    lapses: {
        type: Number,
        default: 0
    },
    dueAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastReviewedAt: {
        type: Date,
        default: null
    },
    reviewCount: {
        type: Number,
        default: 0
    },
    correctCount: {
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

flashcardSchema.index({ ownerId: 1, dueAt: 1 });
flashcardSchema.index({ deckId: 1, dueAt: 1 });

module.exports = mongoose.model('Flashcard', flashcardSchema);
