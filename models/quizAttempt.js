const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    deckId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StudyDeck',
        required: true,
        index: true
    },
    subject: {
        type: String,
        trim: true,
        default: '',
        index: true
    },
    total: {
        type: Number,
        required: true,
        min: 1
    },
    correct: {
        type: Number,
        required: true,
        min: 0
    },
    scorePercent: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    // Per-card outcomes for weak-topic detection
    results: [{
        cardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Flashcard' },
        subject: { type: String, default: '' },
        correct: { type: Boolean, default: false }
    }],
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

quizAttemptSchema.index({ ownerId: 1, createdAt: -1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
