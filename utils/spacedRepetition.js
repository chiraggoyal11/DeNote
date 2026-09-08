/**
 * Simplified SM-2 spaced repetition (free-tier, local scheduling).
 * quality: 0–5 (Again=0/1, Hard=2/3, Good=4, Easy=5)
 */

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function applySm2(card, quality) {
    const q = clamp(Number(quality) || 0, 0, 5);
    let ease = typeof card.easeFactor === 'number' ? card.easeFactor : 2.5;
    let reps = card.repetitions || 0;
    let interval = card.intervalDays || 0;
    let lapses = card.lapses || 0;

    if (q < 3) {
        reps = 0;
        interval = 1;
        lapses += 1;
    } else {
        if (reps === 0) interval = 1;
        else if (reps === 1) interval = 6;
        else interval = Math.round(interval * ease) || 1;
        reps += 1;
    }

    ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    ease = clamp(ease, 1.3, 3.0);

    const dueAt = new Date(Date.now() + interval * 24 * 60 * 60 * 1000);
    const countedCorrect = q >= 3;

    return {
        easeFactor: Number(ease.toFixed(2)),
        intervalDays: interval,
        repetitions: reps,
        lapses,
        dueAt,
        lastReviewedAt: new Date(),
        reviewCount: (card.reviewCount || 0) + 1,
        correctCount: (card.correctCount || 0) + (countedCorrect ? 1 : 0),
        countedCorrect
    };
}

function serializeCard(doc) {
    const c = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    return {
        _id: c._id,
        deckId: c.deckId,
        front: c.front,
        back: c.back,
        subject: c.subject || '',
        easeFactor: c.easeFactor ?? 2.5,
        intervalDays: c.intervalDays || 0,
        repetitions: c.repetitions || 0,
        lapses: c.lapses || 0,
        dueAt: c.dueAt,
        lastReviewedAt: c.lastReviewedAt || null,
        reviewCount: c.reviewCount || 0,
        correctCount: c.correctCount || 0,
        createdAt: c.createdAt
    };
}

function serializeDeck(doc, extras = {}) {
    const d = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    return {
        _id: d._id,
        title: d.title,
        subject: d.subject || '',
        description: d.description || '',
        noteId: d.noteId || null,
        cardCount: d.cardCount || 0,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        ...extras
    };
}

function serializePlan(doc) {
    const p = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    return {
        _id: p._id,
        title: p.title,
        subject: p.subject || '',
        notes: p.notes || '',
        dueAt: p.dueAt || null,
        status: p.status || 'todo',
        deckId: p.deckId || null,
        noteId: p.noteId || null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        completedAt: p.completedAt || null
    };
}

module.exports = {
    applySm2,
    serializeCard,
    serializeDeck,
    serializePlan
};
