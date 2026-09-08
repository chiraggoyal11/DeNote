const crypto = require('crypto');
const Collection = require('../models/collection');
const Note = require('../models/note');
const { serializeNote, isNoteOwner } = require('./notesHelpers');

function makeShareId() {
    return crypto.randomBytes(9).toString('base64url');
}

function serializeCollection(doc, { includeNotes = false, notes = [] } = {}) {
    const c = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    return {
        _id: c._id,
        name: c.name,
        description: c.description || '',
        ownerId: c.ownerId,
        ownerUsername: c.ownerUsername || '',
        isPublic: Boolean(c.isPublic),
        shareId: c.shareId || null,
        sharePath: c.shareId ? `/collections/share/${c.shareId}` : null,
        noteCount: Array.isArray(c.notes) ? c.notes.length : 0,
        notes: includeNotes
            ? (c.notes || []).map((item, idx) => ({
                noteId: item.noteId,
                cid: item.cid || '',
                order: typeof item.order === 'number' ? item.order : idx,
                note: notes.find((n) => String(n._id) === String(item.noteId)) || null
            }))
            : undefined,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        isOwner: false
    };
}

async function loadSerializedNotes(items, ctx) {
    const ids = (items || []).map((i) => i.noteId).filter(Boolean);
    if (!ids.length) return [];
    const docs = await Note.find({ _id: { $in: ids } });
    const byId = new Map(docs.map((d) => [String(d._id), serializeNote(d, ctx)]));
    return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

async function canViewCollection(collection, userId) {
    if (!collection) return false;
    if (collection.isPublic) return true;
    if (userId && String(collection.ownerId) === String(userId)) return true;
    return false;
}

function assertOwner(collection, userId) {
    return collection && userId && String(collection.ownerId) === String(userId);
}

module.exports = {
    makeShareId,
    serializeCollection,
    loadSerializedNotes,
    canViewCollection,
    assertOwner,
    Collection,
    isNoteOwner
};
