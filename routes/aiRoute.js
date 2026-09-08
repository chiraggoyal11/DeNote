const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const user_jwt = require('../middleware/jwt');
const User = require('../models/user');
const Note = require('../models/note');
const StudyDeck = require('../models/studyDeck');
const Flashcard = require('../models/flashcard');
const { purgeIfDue } = require('../utils/accountDeletion');
const { getAiStatus, getProvider } = require('../utils/ai');
const { AiDisabledError } = require('../utils/ai/disabledProvider');

async function loadMe(req) {
    if (!req.user?.id) return null;
    const user = await User.findById(req.user.id);
    if (!user) return null;
    if (await purgeIfDue(user)) return null;
    return user;
}

async function loadNoteForUser(noteId) {
    if (!mongoose.isValidObjectId(noteId)) return null;
    return Note.findById(noteId);
}

function handleAiError(err, res) {
    if (err instanceof AiDisabledError || err.code === 'AI_DISABLED') {
        return res.status(503).json({
            success: false,
            code: 'AI_DISABLED',
            msg: err.message,
            ai: getAiStatus()
        });
    }
    console.log(err);
    return res.status(500).json({ success: false, msg: 'AI request failed' });
}

router.get('/ai/status', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        res.status(200).json({ success: true, ai: getAiStatus() });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to read AI status' });
    }
});

router.post('/ai/summarize', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const note = await loadNoteForUser(req.body.noteId);
        if (!note) return res.status(404).json({ success: false, msg: 'Note not found.' });

        const provider = await getProvider();
        const result = await provider.summarize({ note });
        res.status(200).json({
            success: true,
            provider: provider.name,
            noteId: note._id,
            ...result
        });
    } catch (err) {
        return handleAiError(err, res);
    }
});

router.post('/ai/assist', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const note = await loadNoteForUser(req.body.noteId);
        if (!note) return res.status(404).json({ success: false, msg: 'Note not found.' });
        const question = String(req.body.question || '').trim().slice(0, 500);

        const provider = await getProvider();
        const result = await provider.assist({ note, question });
        res.status(200).json({
            success: true,
            provider: provider.name,
            noteId: note._id,
            question,
            ...result
        });
    } catch (err) {
        return handleAiError(err, res);
    }
});

router.post('/ai/search', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const query = String(req.body.query || req.body.q || '').trim().slice(0, 200);
        if (!query) return res.status(400).json({ success: false, msg: 'query is required.' });
        const limit = Math.min(20, Math.max(1, parseInt(req.body.limit, 10) || 10));

        const notes = await Note.find({ isLatest: { $ne: false } })
            .sort({ likeCount: -1, viewCount: -1 })
            .limit(200)
            .select('title subject branch sem description tags resourceType cid likeCount viewCount qualityScore isVerified college');

        const provider = await getProvider();
        const result = await provider.semanticSearch({ notes, query, limit });
        res.status(200).json({
            success: true,
            provider: provider.name,
            query,
            ...result
        });
    } catch (err) {
        return handleAiError(err, res);
    }
});

router.post('/ai/generate-quiz', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const note = await loadNoteForUser(req.body.noteId);
        if (!note) return res.status(404).json({ success: false, msg: 'Note not found.' });
        const count = Math.min(12, Math.max(3, parseInt(req.body.count, 10) || 5));

        const provider = await getProvider();
        const result = await provider.generateQuiz({ note, count });
        res.status(200).json({
            success: true,
            provider: provider.name,
            noteId: note._id,
            ...result
        });
    } catch (err) {
        return handleAiError(err, res);
    }
});

router.post('/ai/generate-flashcards', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const note = await loadNoteForUser(req.body.noteId);
        if (!note) return res.status(404).json({ success: false, msg: 'Note not found.' });
        const count = Math.min(20, Math.max(3, parseInt(req.body.count, 10) || 6));
        const saveToDeck = Boolean(req.body.saveToDeck);

        const provider = await getProvider();
        const result = await provider.generateFlashcards({ note, count });

        let deck = null;
        if (saveToDeck && Array.isArray(result.cards) && result.cards.length) {
            deck = await StudyDeck.create({
                ownerId: me._id,
                title: `AI · ${String(note.title || 'Note').slice(0, 80)}`,
                subject: note.subject || '',
                description: `Generated via ${provider.name} from note ${note._id}`,
                noteId: note._id,
                cardCount: 0
            });
            for (const c of result.cards) {
                await Flashcard.create({
                    deckId: deck._id,
                    ownerId: me._id,
                    front: String(c.front || '').slice(0, 1000),
                    back: String(c.back || '').slice(0, 2000),
                    subject: String(c.subject || note.subject || '').slice(0, 80),
                    dueAt: new Date()
                });
            }
            const cardCount = await Flashcard.countDocuments({ deckId: deck._id });
            deck.cardCount = cardCount;
            deck.updatedAt = new Date();
            await deck.save();
        }

        res.status(200).json({
            success: true,
            provider: provider.name,
            noteId: note._id,
            ...result,
            savedDeck: deck
                ? { _id: deck._id, title: deck.title, cardCount: deck.cardCount }
                : null
        });
    } catch (err) {
        return handleAiError(err, res);
    }
});

router.get('/ai/recommendations', user_jwt, async (req, res) => {
    try {
        const me = await loadMe(req);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 8));

        const likedNotes = await Note.find({ likes: me._id }).select('subject tags').limit(50);
        const favIds = (me.fav || []).map((f) => f.noteId).filter(Boolean);
        const favNotes = favIds.length
            ? await Note.find({ _id: { $in: favIds } }).select('subject tags').limit(50)
            : [];

        const likedSubjects = likedNotes.map((n) => n.subject).filter(Boolean);
        const favoriteSubjects = favNotes.map((n) => n.subject).filter(Boolean);
        for (const n of [...likedNotes, ...favNotes]) {
            for (const t of n.tags || []) {
                likedSubjects.push(t);
            }
        }

        const exclude = new Set([
            ...likedNotes.map((n) => String(n._id)),
            ...favIds.map(String)
        ]);

        const notes = await Note.find({ isLatest: { $ne: false } })
            .sort({ likeCount: -1, uploadedAt: -1 })
            .limit(150)
            .select('title subject branch sem description tags resourceType cid likeCount viewCount qualityScore isVerified');

        const candidates = notes.filter((n) => !exclude.has(String(n._id)));
        const provider = await getProvider();
        const result = await provider.recommend({
            notes: candidates,
            likedSubjects,
            favoriteSubjects,
            limit
        });

        res.status(200).json({
            success: true,
            provider: provider.name,
            ...result
        });
    } catch (err) {
        return handleAiError(err, res);
    }
});

module.exports = router;
