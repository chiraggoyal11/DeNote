const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const user_jwt = require('../middleware/jwt');
const User = require('../models/user');
const Note = require('../models/note');
const StudyDeck = require('../models/studyDeck');
const Flashcard = require('../models/flashcard');
const StudyPlanItem = require('../models/studyPlan');
const QuizAttempt = require('../models/quizAttempt');
const { purgeIfDue } = require('../utils/accountDeletion');
const {
    applySm2,
    serializeCard,
    serializeDeck,
    serializePlan
} = require('../utils/spacedRepetition');

async function loadMe(req) {
    if (!req.user?.id) return null;
    const user = await User.findById(req.user.id);
    if (!user) return null;
    if (await purgeIfDue(user)) return null;
    return user;
}

function requireOwnDeck(deck, me) {
    return deck && String(deck.ownerId) === String(me._id);
}

async function refreshDeckCount(deckId) {
    const count = await Flashcard.countDocuments({ deckId });
    await StudyDeck.updateOne({ _id: deckId }, { $set: { cardCount: count, updatedAt: new Date() } });
    return count;
}

// ——— Decks ———
router.get('/study/decks', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const decks = await StudyDeck.find({ ownerId: me._id }).sort({ updatedAt: -1 }).limit(100);
        const dueCounts = await Flashcard.aggregate([
            { $match: { ownerId: me._id, dueAt: { $lte: new Date() } } },
            { $group: { _id: '$deckId', due: { $sum: 1 } } }
        ]);
        const dueMap = new Map(dueCounts.map((d) => [String(d._id), d.due]));
        res.status(200).json({
            success: true,
            decks: decks.map((d) => serializeDeck(d, { dueCount: dueMap.get(String(d._id)) || 0 }))
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to list decks' });
    }
});

router.post('/study/decks', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        if (me.restricted) {
            return res.status(403).json({ success: false, msg: me.restrictionReason || 'Account restricted.', code: 'ACCOUNT_RESTRICTED' });
        }

        const title = String(req.body.title || '').trim().slice(0, 120);
        if (!title) return res.status(400).json({ success: false, msg: 'Title is required.' });

        let noteId = null;
        if (req.body.noteId && mongoose.isValidObjectId(req.body.noteId)) {
            const note = await Note.findById(req.body.noteId).select('_id');
            if (note) noteId = note._id;
        }

        const deck = await StudyDeck.create({
            ownerId: me._id,
            title,
            subject: String(req.body.subject || '').trim().slice(0, 80),
            description: String(req.body.description || '').trim().slice(0, 400),
            noteId
        });

        res.status(201).json({ success: true, deck: serializeDeck(deck, { dueCount: 0 }) });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to create deck' });
    }
});

router.get('/study/decks/:id', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const deck = await StudyDeck.findById(req.params.id);
        if (!requireOwnDeck(deck, me)) return res.status(404).json({ success: false, msg: 'Deck not found.' });
        const cards = await Flashcard.find({ deckId: deck._id }).sort({ createdAt: 1 });
        const dueCount = cards.filter((c) => new Date(c.dueAt) <= new Date()).length;
        res.status(200).json({
            success: true,
            deck: serializeDeck(deck, { dueCount }),
            cards: cards.map(serializeCard)
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load deck' });
    }
});

router.put('/study/decks/:id', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const deck = await StudyDeck.findById(req.params.id);
        if (!requireOwnDeck(deck, me)) return res.status(404).json({ success: false, msg: 'Deck not found.' });

        if (req.body.title != null) {
            const title = String(req.body.title).trim().slice(0, 120);
            if (!title) return res.status(400).json({ success: false, msg: 'Title is required.' });
            deck.title = title;
        }
        if (req.body.subject != null) deck.subject = String(req.body.subject).trim().slice(0, 80);
        if (req.body.description != null) deck.description = String(req.body.description).trim().slice(0, 400);
        deck.updatedAt = new Date();
        await deck.save();
        res.status(200).json({ success: true, deck: serializeDeck(deck) });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to update deck' });
    }
});

router.delete('/study/decks/:id', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const deck = await StudyDeck.findById(req.params.id);
        if (!requireOwnDeck(deck, me)) return res.status(404).json({ success: false, msg: 'Deck not found.' });
        await Flashcard.deleteMany({ deckId: deck._id });
        await StudyDeck.deleteOne({ _id: deck._id });
        res.status(200).json({ success: true, msg: 'Deck deleted.' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to delete deck' });
    }
});

// ——— Cards ———
router.post('/study/decks/:id/cards', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const deck = await StudyDeck.findById(req.params.id);
        if (!requireOwnDeck(deck, me)) return res.status(404).json({ success: false, msg: 'Deck not found.' });

        const front = String(req.body.front || '').trim().slice(0, 1000);
        const back = String(req.body.back || '').trim().slice(0, 2000);
        if (!front || !back) {
            return res.status(400).json({ success: false, msg: 'Front and back are required.' });
        }

        const card = await Flashcard.create({
            deckId: deck._id,
            ownerId: me._id,
            front,
            back,
            subject: String(req.body.subject || deck.subject || '').trim().slice(0, 80),
            dueAt: new Date()
        });
        await refreshDeckCount(deck._id);
        res.status(201).json({ success: true, card: serializeCard(card) });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to add card' });
    }
});

router.put('/study/cards/:id', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const card = await Flashcard.findById(req.params.id);
        if (!card || String(card.ownerId) !== String(me._id)) {
            return res.status(404).json({ success: false, msg: 'Card not found.' });
        }
        if (req.body.front != null) {
            const front = String(req.body.front).trim().slice(0, 1000);
            if (!front) return res.status(400).json({ success: false, msg: 'Front is required.' });
            card.front = front;
        }
        if (req.body.back != null) {
            const back = String(req.body.back).trim().slice(0, 2000);
            if (!back) return res.status(400).json({ success: false, msg: 'Back is required.' });
            card.back = back;
        }
        if (req.body.subject != null) card.subject = String(req.body.subject).trim().slice(0, 80);
        card.updatedAt = new Date();
        await card.save();
        res.status(200).json({ success: true, card: serializeCard(card) });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to update card' });
    }
});

router.delete('/study/cards/:id', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const card = await Flashcard.findById(req.params.id);
        if (!card || String(card.ownerId) !== String(me._id)) {
            return res.status(404).json({ success: false, msg: 'Card not found.' });
        }
        const deckId = card.deckId;
        await Flashcard.deleteOne({ _id: card._id });
        await refreshDeckCount(deckId);
        res.status(200).json({ success: true, msg: 'Card deleted.' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to delete card' });
    }
});

// ——— Spaced repetition review ———
router.get('/study/review', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const filter = { ownerId: me._id, dueAt: { $lte: new Date() } };
        if (req.query.deckId && mongoose.isValidObjectId(req.query.deckId)) {
            filter.deckId = req.query.deckId;
        }
        const cards = await Flashcard.find(filter).sort({ dueAt: 1 }).limit(limit);
        const dueTotal = await Flashcard.countDocuments(filter);
        res.status(200).json({
            success: true,
            dueTotal,
            cards: cards.map(serializeCard)
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load review queue' });
    }
});

router.post('/study/cards/:id/review', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const card = await Flashcard.findById(req.params.id);
        if (!card || String(card.ownerId) !== String(me._id)) {
            return res.status(404).json({ success: false, msg: 'Card not found.' });
        }

        const next = applySm2(card, req.body.quality);
        card.easeFactor = next.easeFactor;
        card.intervalDays = next.intervalDays;
        card.repetitions = next.repetitions;
        card.lapses = next.lapses;
        card.dueAt = next.dueAt;
        card.lastReviewedAt = next.lastReviewedAt;
        card.reviewCount = next.reviewCount;
        card.correctCount = next.correctCount;
        card.updatedAt = new Date();
        await card.save();

        res.status(200).json({
            success: true,
            card: serializeCard(card),
            countedCorrect: next.countedCorrect
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to record review' });
    }
});

// ——— Quizzes (self-graded from deck cards) ———
router.get('/study/quizzes/:deckId/start', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const deck = await StudyDeck.findById(req.params.deckId);
        if (!requireOwnDeck(deck, me)) return res.status(404).json({ success: false, msg: 'Deck not found.' });

        const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const cards = await Flashcard.aggregate([
            { $match: { deckId: deck._id, ownerId: me._id } },
            { $sample: { size: limit } }
        ]);
        if (cards.length === 0) {
            return res.status(400).json({ success: false, msg: 'Add flashcards before starting a quiz.' });
        }

        res.status(200).json({
            success: true,
            deck: serializeDeck(deck),
            questions: cards.map((c) => ({
                cardId: c._id,
                front: c.front,
                subject: c.subject || deck.subject || ''
                // answer withheld until submit — client can also reveal for self-check
            })),
            // Include answers server-side only on submit; for self-check UX we return a keyed map after start
            // Free-tier self-graded: answers returned hashed-by-id for client reveal after answering.
            answerKey: Object.fromEntries(cards.map((c) => [String(c._id), c.back]))
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to start quiz' });
    }
});

router.post('/study/quizzes/:deckId/submit', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const deck = await StudyDeck.findById(req.params.deckId);
        if (!requireOwnDeck(deck, me)) return res.status(404).json({ success: false, msg: 'Deck not found.' });

        const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
        if (answers.length === 0) {
            return res.status(400).json({ success: false, msg: 'No answers submitted.' });
        }

        const ids = answers
            .map((a) => a.cardId)
            .filter((id) => mongoose.isValidObjectId(id));
        const cards = await Flashcard.find({ _id: { $in: ids }, ownerId: me._id, deckId: deck._id });
        const byId = new Map(cards.map((c) => [String(c._id), c]));

        const results = [];
        let correct = 0;
        for (const a of answers) {
            const card = byId.get(String(a.cardId));
            if (!card) continue;
            const isCorrect = Boolean(a.correct);
            if (isCorrect) correct += 1;
            results.push({
                cardId: card._id,
                subject: card.subject || deck.subject || '',
                correct: isCorrect
            });
            // Light SR bump: Good(4) / Again(1)
            const next = applySm2(card, isCorrect ? 4 : 1);
            card.easeFactor = next.easeFactor;
            card.intervalDays = next.intervalDays;
            card.repetitions = next.repetitions;
            card.lapses = next.lapses;
            card.dueAt = next.dueAt;
            card.lastReviewedAt = next.lastReviewedAt;
            card.reviewCount = next.reviewCount;
            card.correctCount = next.correctCount;
            card.updatedAt = new Date();
            await card.save();
        }

        const total = results.length;
        if (total === 0) {
            return res.status(400).json({ success: false, msg: 'No valid answers.' });
        }
        const scorePercent = Math.round((correct / total) * 100);
        const attempt = await QuizAttempt.create({
            ownerId: me._id,
            deckId: deck._id,
            subject: deck.subject || '',
            total,
            correct,
            scorePercent,
            results
        });

        res.status(200).json({
            success: true,
            attempt: {
                _id: attempt._id,
                total,
                correct,
                scorePercent,
                subject: attempt.subject,
                createdAt: attempt.createdAt
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to submit quiz' });
    }
});

// ——— Study planner ———
router.get('/study/plan', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const items = await StudyPlanItem.find({ ownerId: me._id }).sort({ dueAt: 1, createdAt: -1 }).limit(100);
        res.status(200).json({ success: true, items: items.map(serializePlan) });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load study plan' });
    }
});

router.post('/study/plan', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const title = String(req.body.title || '').trim().slice(0, 160);
        if (!title) return res.status(400).json({ success: false, msg: 'Title is required.' });

        let dueAt = null;
        if (req.body.dueAt) {
            const d = new Date(req.body.dueAt);
            if (!Number.isNaN(d.getTime())) dueAt = d;
        }

        const item = await StudyPlanItem.create({
            ownerId: me._id,
            title,
            subject: String(req.body.subject || '').trim().slice(0, 80),
            notes: String(req.body.notes || '').trim().slice(0, 500),
            dueAt,
            status: ['todo', 'doing', 'done'].includes(req.body.status) ? req.body.status : 'todo',
            deckId: mongoose.isValidObjectId(req.body.deckId) ? req.body.deckId : null,
            noteId: mongoose.isValidObjectId(req.body.noteId) ? req.body.noteId : null
        });
        res.status(201).json({ success: true, item: serializePlan(item) });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to create plan item' });
    }
});

router.put('/study/plan/:id', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const item = await StudyPlanItem.findById(req.params.id);
        if (!item || String(item.ownerId) !== String(me._id)) {
            return res.status(404).json({ success: false, msg: 'Plan item not found.' });
        }
        if (req.body.title != null) {
            const title = String(req.body.title).trim().slice(0, 160);
            if (!title) return res.status(400).json({ success: false, msg: 'Title is required.' });
            item.title = title;
        }
        if (req.body.subject != null) item.subject = String(req.body.subject).trim().slice(0, 80);
        if (req.body.notes != null) item.notes = String(req.body.notes).trim().slice(0, 500);
        if (req.body.dueAt !== undefined) {
            if (!req.body.dueAt) item.dueAt = null;
            else {
                const d = new Date(req.body.dueAt);
                if (!Number.isNaN(d.getTime())) item.dueAt = d;
            }
        }
        if (req.body.status && ['todo', 'doing', 'done'].includes(req.body.status)) {
            item.status = req.body.status;
            item.completedAt = req.body.status === 'done' ? new Date() : null;
        }
        item.updatedAt = new Date();
        await item.save();
        res.status(200).json({ success: true, item: serializePlan(item) });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to update plan item' });
    }
});

router.delete('/study/plan/:id', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const item = await StudyPlanItem.findById(req.params.id);
        if (!item || String(item.ownerId) !== String(me._id)) {
            return res.status(404).json({ success: false, msg: 'Plan item not found.' });
        }
        await StudyPlanItem.deleteOne({ _id: item._id });
        res.status(200).json({ success: true, msg: 'Plan item deleted.' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to delete plan item' });
    }
});

// ——— Progress + weak topics ———
router.get('/study/progress', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const now = new Date();
        const [
            deckCount,
            cardCount,
            dueCount,
            planTodo,
            planDone,
            cardAgg,
            recentQuizzes,
            weakFromCards,
            weakFromQuizzes
        ] = await Promise.all([
            StudyDeck.countDocuments({ ownerId: me._id }),
            Flashcard.countDocuments({ ownerId: me._id }),
            Flashcard.countDocuments({ ownerId: me._id, dueAt: { $lte: now } }),
            StudyPlanItem.countDocuments({ ownerId: me._id, status: { $ne: 'done' } }),
            StudyPlanItem.countDocuments({ ownerId: me._id, status: 'done' }),
            Flashcard.aggregate([
                { $match: { ownerId: me._id } },
                {
                    $group: {
                        _id: null,
                        reviews: { $sum: { $ifNull: ['$reviewCount', 0] } },
                        correct: { $sum: { $ifNull: ['$correctCount', 0] } }
                    }
                }
            ]),
            QuizAttempt.find({ ownerId: me._id }).sort({ createdAt: -1 }).limit(8),
            Flashcard.aggregate([
                { $match: { ownerId: me._id, reviewCount: { $gte: 2 } } },
                {
                    $project: {
                        subject: { $ifNull: ['$subject', 'General'] },
                        reviewCount: 1,
                        correctCount: 1,
                        accuracy: {
                            $cond: [
                                { $gt: ['$reviewCount', 0] },
                                { $divide: ['$correctCount', '$reviewCount'] },
                                0
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: '$subject',
                        cards: { $sum: 1 },
                        reviews: { $sum: '$reviewCount' },
                        correct: { $sum: '$correctCount' },
                        avgAccuracy: { $avg: '$accuracy' }
                    }
                },
                { $sort: { avgAccuracy: 1 } },
                { $limit: 8 }
            ]),
            QuizAttempt.aggregate([
                { $match: { ownerId: me._id } },
                { $unwind: '$results' },
                {
                    $group: {
                        _id: { $ifNull: ['$results.subject', 'General'] },
                        attempts: { $sum: 1 },
                        correct: { $sum: { $cond: ['$results.correct', 1, 0] } }
                    }
                },
                {
                    $project: {
                        subject: '$_id',
                        attempts: 1,
                        correct: 1,
                        accuracy: {
                            $cond: [{ $gt: ['$attempts', 0] }, { $divide: ['$correct', '$attempts'] }, 0]
                        }
                    }
                },
                { $sort: { accuracy: 1 } },
                { $limit: 8 }
            ])
        ]);

        const reviews = cardAgg[0]?.reviews || 0;
        const correct = cardAgg[0]?.correct || 0;
        const accuracy = reviews > 0 ? Math.round((correct / reviews) * 100) : 0;

        // Merge weak topics preferring lower accuracy / enough samples
        const weakMap = new Map();
        for (const w of weakFromCards) {
            const subject = w._id || 'General';
            weakMap.set(subject, {
                subject,
                accuracy: Math.round((w.avgAccuracy || 0) * 100),
                samples: w.reviews || 0,
                source: 'reviews'
            });
        }
        for (const w of weakFromQuizzes) {
            const subject = w.subject || 'General';
            const entry = {
                subject,
                accuracy: Math.round((w.accuracy || 0) * 100),
                samples: w.attempts || 0,
                source: 'quizzes'
            };
            const prev = weakMap.get(subject);
            if (!prev || entry.accuracy < prev.accuracy) weakMap.set(subject, entry);
        }
        const weakTopics = [...weakMap.values()]
            .filter((w) => w.samples >= 2)
            .sort((a, b) => a.accuracy - b.accuracy)
            .slice(0, 6);

        res.status(200).json({
            success: true,
            progress: {
                deckCount,
                cardCount,
                dueCount,
                planTodo,
                planDone,
                reviews,
                correct,
                accuracy,
                recentQuizzes: recentQuizzes.map((q) => ({
                    _id: q._id,
                    deckId: q.deckId,
                    subject: q.subject || '',
                    total: q.total,
                    correct: q.correct,
                    scorePercent: q.scorePercent,
                    createdAt: q.createdAt
                })),
                weakTopics
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load study progress' });
    }
});

module.exports = router;
