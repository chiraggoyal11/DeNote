const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Collection = require('../models/collection');
const Note = require('../models/note');
const User = require('../models/user');
const user_jwt = require('../middleware/jwt');
const optionalJwt = require('../middleware/optionalJwt');
const {
    makeShareId,
    serializeCollection,
    loadSerializedNotes,
    canViewCollection,
    assertOwner
} = require('../utils/collections');
const { loadFavoriteSets } = require('../utils/notesHelpers');
const { purgeIfDue } = require('../utils/accountDeletion');

async function viewerCtx(req) {
    if (!req.user?.id) {
        return { user: null, userId: null, username: null, favoriteCids: new Set(), favoriteNoteIds: new Set() };
    }
    const user = await User.findById(req.user.id);
    if (!user) {
        return { user: null, userId: null, username: null, favoriteCids: new Set(), favoriteNoteIds: new Set() };
    }
    const sets = await loadFavoriteSets(user);
    return { user, userId: String(user._id), username: user.username, ...sets };
}

async function hydrateCollection(collection, ctx, { isOwner = false } = {}) {
    const notes = await loadSerializedNotes(collection.notes, ctx);
    const serialized = serializeCollection(collection, { includeNotes: true, notes });
    // attach note objects into ordered items
    serialized.notes = (collection.notes || [])
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((item, idx) => ({
            noteId: item.noteId,
            cid: item.cid || '',
            order: typeof item.order === 'number' ? item.order : idx,
            note: notes.find((n) => String(n._id) === String(item.noteId)) || null
        }));
    serialized.isOwner = isOwner;
    return serialized;
}

// List my collections (+ optional public discover)
router.get('/', user_jwt, async (req, res) => {
    try {
        const ctx = await viewerCtx(req);
        if (!ctx.user) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        if (await purgeIfDue(ctx.user)) {
            return res.status(401).json({ success: false, msg: 'This account was deleted after the scheduled grace period.', accountDeleted: true });
        }

        const mine = await Collection.find({ ownerId: ctx.userId }).sort({ updatedAt: -1 });
        const publicOnly = String(req.query.public || '') === '1';
        let discover = [];
        if (publicOnly || req.query.discover === '1') {
            discover = await Collection.find({
                isPublic: true,
                ownerId: { $ne: ctx.userId }
            }).sort({ updatedAt: -1 }).limit(30);
        }

        res.status(200).json({
            success: true,
            collections: mine.map((c) => {
                const s = serializeCollection(c);
                s.isOwner = true;
                return s;
            }),
            discover: discover.map((c) => serializeCollection(c))
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load collections' });
    }
});

router.post('/', user_jwt, async (req, res) => {
    try {
        const ctx = await viewerCtx(req);
        if (!ctx.user) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const name = String(req.body.name || '').trim().slice(0, 80);
        if (!name) {
            return res.status(400).json({ success: false, msg: 'Collection name is required.' });
        }

        const collection = new Collection({
            name,
            description: String(req.body.description || '').trim().slice(0, 400),
            ownerId: ctx.user._id,
            ownerUsername: ctx.user.username,
            isPublic: Boolean(req.body.isPublic),
            shareId: makeShareId(),
            notes: []
        });
        await collection.save();

        const serialized = serializeCollection(collection);
        serialized.isOwner = true;
        res.status(201).json({ success: true, collection: serialized });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to create collection' });
    }
});

router.get('/share/:shareId', optionalJwt, async (req, res) => {
    try {
        const collection = await Collection.findOne({ shareId: req.params.shareId });
        if (!collection || !collection.isPublic) {
            return res.status(404).json({ success: false, msg: 'Shared collection not found.' });
        }
        const ctx = await viewerCtx(req);
        const isOwner = assertOwner(collection, ctx.userId);
        res.status(200).json({
            success: true,
            collection: await hydrateCollection(collection, ctx, { isOwner })
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load shared collection' });
    }
});

router.get('/:id', optionalJwt, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, msg: 'Invalid collection id.' });
        }
        const collection = await Collection.findById(req.params.id);
        if (!collection) {
            return res.status(404).json({ success: false, msg: 'Collection not found.' });
        }
        const ctx = await viewerCtx(req);
        if (!(await canViewCollection(collection, ctx.userId))) {
            return res.status(403).json({ success: false, msg: 'This collection is private.' });
        }
        const isOwner = assertOwner(collection, ctx.userId);
        res.status(200).json({
            success: true,
            collection: await hydrateCollection(collection, ctx, { isOwner })
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load collection' });
    }
});

router.put('/:id', user_jwt, async (req, res) => {
    try {
        const ctx = await viewerCtx(req);
        if (!ctx.user) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const collection = await Collection.findById(req.params.id);
        if (!collection) return res.status(404).json({ success: false, msg: 'Collection not found.' });
        if (!assertOwner(collection, ctx.userId)) {
            return res.status(403).json({ success: false, msg: 'Only the owner can edit this collection.' });
        }

        if (typeof req.body.name === 'string') {
            const name = req.body.name.trim().slice(0, 80);
            if (!name) return res.status(400).json({ success: false, msg: 'Collection name is required.' });
            collection.name = name;
        }
        if (typeof req.body.description === 'string') {
            collection.description = req.body.description.trim().slice(0, 400);
        }
        if (typeof req.body.isPublic === 'boolean') {
            collection.isPublic = req.body.isPublic;
            if (collection.isPublic && !collection.shareId) {
                collection.shareId = makeShareId();
            }
        }
        if (req.body.rotateShareId) {
            collection.shareId = makeShareId();
        }
        collection.updatedAt = new Date();
        await collection.save();

        const serialized = serializeCollection(collection);
        serialized.isOwner = true;
        res.status(200).json({ success: true, collection: serialized });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to update collection' });
    }
});

router.delete('/:id', user_jwt, async (req, res) => {
    try {
        const ctx = await viewerCtx(req);
        if (!ctx.user) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const collection = await Collection.findById(req.params.id);
        if (!collection) return res.status(404).json({ success: false, msg: 'Collection not found.' });
        if (!assertOwner(collection, ctx.userId)) {
            return res.status(403).json({ success: false, msg: 'Only the owner can delete this collection.' });
        }

        await collection.deleteOne();
        res.status(200).json({ success: true, msg: 'Collection deleted.' });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to delete collection' });
    }
});

router.post('/:id/notes', user_jwt, async (req, res) => {
    try {
        const ctx = await viewerCtx(req);
        if (!ctx.user) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const collection = await Collection.findById(req.params.id);
        if (!collection) return res.status(404).json({ success: false, msg: 'Collection not found.' });
        if (!assertOwner(collection, ctx.userId)) {
            return res.status(403).json({ success: false, msg: 'Only the owner can add notes.' });
        }

        const noteId = req.body.noteId;
        if (!mongoose.isValidObjectId(noteId)) {
            return res.status(400).json({ success: false, msg: 'Valid noteId is required.' });
        }
        const note = await Note.findById(noteId);
        if (!note) return res.status(404).json({ success: false, msg: 'Note not found.' });

        if (collection.notes.some((n) => String(n.noteId) === String(noteId))) {
            return res.status(200).json({
                success: true,
                msg: 'Note already in collection.',
                collection: await hydrateCollection(collection, ctx, { isOwner: true })
            });
        }

        const order = collection.notes.length;
        collection.notes.push({ noteId: note._id, cid: note.cid, order });
        collection.updatedAt = new Date();
        await collection.save();

        res.status(200).json({
            success: true,
            msg: 'Note added.',
            collection: await hydrateCollection(collection, ctx, { isOwner: true })
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to add note to collection' });
    }
});

router.delete('/:id/notes/:noteId', user_jwt, async (req, res) => {
    try {
        const ctx = await viewerCtx(req);
        if (!ctx.user) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const collection = await Collection.findById(req.params.id);
        if (!collection) return res.status(404).json({ success: false, msg: 'Collection not found.' });
        if (!assertOwner(collection, ctx.userId)) {
            return res.status(403).json({ success: false, msg: 'Only the owner can remove notes.' });
        }

        collection.notes = (collection.notes || []).filter(
            (n) => String(n.noteId) !== String(req.params.noteId)
        );
        collection.notes.forEach((n, idx) => { n.order = idx; });
        collection.updatedAt = new Date();
        await collection.save();

        res.status(200).json({
            success: true,
            msg: 'Note removed.',
            collection: await hydrateCollection(collection, ctx, { isOwner: true })
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to remove note' });
    }
});

router.put('/:id/reorder', user_jwt, async (req, res) => {
    try {
        const ctx = await viewerCtx(req);
        if (!ctx.user) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const collection = await Collection.findById(req.params.id);
        if (!collection) return res.status(404).json({ success: false, msg: 'Collection not found.' });
        if (!assertOwner(collection, ctx.userId)) {
            return res.status(403).json({ success: false, msg: 'Only the owner can reorder notes.' });
        }

        const noteIds = Array.isArray(req.body.noteIds) ? req.body.noteIds.map(String) : null;
        if (!noteIds || !noteIds.length) {
            return res.status(400).json({ success: false, msg: 'noteIds array is required.' });
        }

        const byId = new Map((collection.notes || []).map((n) => [String(n.noteId), n]));
        const next = [];
        for (const id of noteIds) {
            const item = byId.get(id);
            if (item) {
                next.push({ noteId: item.noteId, cid: item.cid, order: next.length });
                byId.delete(id);
            }
        }
        // Append any missing items at the end
        for (const item of byId.values()) {
            next.push({ noteId: item.noteId, cid: item.cid, order: next.length });
        }
        collection.notes = next;
        collection.updatedAt = new Date();
        await collection.save();

        res.status(200).json({
            success: true,
            msg: 'Reordered.',
            collection: await hydrateCollection(collection, ctx, { isOwner: true })
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to reorder collection' });
    }
});

module.exports = router;
