/**
 * Free-tier local AI: extractive summarization, bag-of-words retrieval,
 * template quiz/flashcard generation, and affinity-based recommendations.
 * No external network calls.
 */

const STOP = new Set(
    'a an the and or of to in on for with from by is are was were be been being this that these those it its as at into about over under not no yes you your we our they their i me my'.split(' ')
);

function tokenize(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2 && !STOP.has(t));
}

function termFreq(tokens) {
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    return tf;
}

function cosine(a, b) {
    let dot = 0;
    let na = 0;
    let nb = 0;
    const keys = new Set([...a.keys(), ...b.keys()]);
    for (const k of keys) {
        const x = a.get(k) || 0;
        const y = b.get(k) || 0;
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function noteCorpusText(note) {
    const tags = Array.isArray(note.tags) ? note.tags.join(' ') : '';
    return [note.title, note.subject, note.branch, note.sem, note.college, note.description, tags, note.resourceType]
        .filter(Boolean)
        .join(' ');
}

function sentencesFrom(text) {
    return String(text || '')
        .split(/(?<=[.!?])\s+|[\n\r]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20);
}

function extractiveSummary(note, maxSentences = 3) {
    const base = noteCorpusText(note);
    const sentences = sentencesFrom(note.description || base);
    if (sentences.length === 0) {
        return {
            summary: `${note.title || 'This note'} covers ${note.subject || 'coursework'} for ${note.branch || 'your'} semester ${note.sem || '?'}.`,
            bullets: [
                `Subject: ${note.subject || 'N/A'}`,
                `Type: ${note.resourceType || 'notes'}`,
                note.tags?.length ? `Tags: ${note.tags.slice(0, 6).join(', ')}` : 'No tags yet'
            ].filter(Boolean),
            method: 'heuristic-metadata'
        };
    }
    const queryTf = termFreq(tokenize(`${note.title} ${note.subject} ${note.tags || ''}`));
    const ranked = sentences
        .map((s) => ({ s, score: cosine(queryTf, termFreq(tokenize(s))) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxSentences)
        .map((x) => x.s);
    return {
        summary: ranked.join(' '),
        bullets: ranked.slice(0, 5),
        method: 'heuristic-extractive'
    };
}

function assistNote(note, question) {
    const q = String(question || '').trim();
    const summary = extractiveSummary(note, 2);
    const hay = noteCorpusText(note).toLowerCase();
    const qTokens = tokenize(q);
    const hits = qTokens.filter((t) => hay.includes(t));
    let answer;
    if (!q) {
        answer = `Here is a quick overview of “${note.title}”: ${summary.summary}`;
    } else if (hits.length === 0) {
        answer = `I could not find “${q}” explicitly in the note metadata. Based on available fields: ${summary.summary}`;
    } else {
        answer = `Regarding “${q}”, this note (${note.subject || 'general'}) mentions: ${hits.slice(0, 8).join(', ')}. Context: ${summary.summary}`;
    }
    return {
        answer,
        citations: [
            {
                noteId: note._id,
                title: note.title,
                cid: note.cid,
                fields: ['title', 'subject', 'description', 'tags']
            }
        ],
        method: 'heuristic-rag-lite'
    };
}

function semanticSearch(notes, query, limit = 10) {
    const qTf = termFreq(tokenize(query));
    const scored = notes.map((n) => {
        const tf = termFreq(tokenize(noteCorpusText(n)));
        const score = cosine(qTf, tf);
        return { note: n, score };
    });
    return scored
        .filter((x) => x.score > 0.02)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => ({
            noteId: x.note._id,
            title: x.note.title,
            cid: x.note.cid,
            subject: x.note.subject,
            score: Number(x.score.toFixed(4)),
            snippet: (x.note.description || `${x.note.subject} · ${x.note.branch} · sem ${x.note.sem}`).slice(0, 160)
        }));
}

function generateFlashcards(note, count = 6) {
    const cards = [];
    const subject = note.subject || 'General';
    if (note.title) {
        cards.push({
            front: `What is the topic of “${note.title}”?`,
            back: `${note.title} — ${subject}${note.branch ? ` (${note.branch}, sem ${note.sem || '?'})` : ''}`,
            subject
        });
    }
    if (Array.isArray(note.tags)) {
        for (const tag of note.tags.slice(0, Math.max(0, count - cards.length))) {
            cards.push({
                front: `How does “${tag}” relate to ${subject}?`,
                back: `“${tag}” appears as a tag on ${note.title}. Review the note section covering ${tag}.`,
                subject
            });
        }
    }
    for (const s of sentencesFrom(note.description).slice(0, count)) {
        if (cards.length >= count) break;
        const short = s.length > 90 ? `${s.slice(0, 87)}…` : s;
        cards.push({
            front: `Explain: ${short}`,
            back: s,
            subject
        });
    }
    while (cards.length < Math.min(3, count)) {
        cards.push({
            front: `Key takeaway from ${note.title}?`,
            back: extractiveSummary(note, 1).summary,
            subject
        });
    }
    return { cards: cards.slice(0, count), method: 'heuristic-templates' };
}

function generateQuiz(note, count = 5) {
    const { cards } = generateFlashcards(note, count);
    const questions = cards.map((c, i) => ({
        id: `q${i + 1}`,
        prompt: c.front,
        answer: c.back,
        subject: c.subject
    }));
    return { questions, method: 'heuristic-from-flashcards' };
}

function recommend(notes, { likedSubjects = [], favoriteSubjects = [], limit = 8 } = {}) {
    const affinity = new Map();
    for (const s of likedSubjects) affinity.set(String(s).toLowerCase(), (affinity.get(String(s).toLowerCase()) || 0) + 2);
    for (const s of favoriteSubjects) affinity.set(String(s).toLowerCase(), (affinity.get(String(s).toLowerCase()) || 0) + 3);

    const scored = notes.map((n) => {
        const subj = String(n.subject || '').toLowerCase();
        let score = affinity.get(subj) || 0;
        score += Math.min(5, (n.likeCount || 0) * 0.3);
        score += Math.min(3, (n.viewCount || 0) * 0.05);
        score += n.isVerified ? 1.5 : 0;
        score += Math.min(2, (n.qualityScore || 0) / 50);
        for (const tag of n.tags || []) {
            score += (affinity.get(String(tag).toLowerCase()) || 0) * 0.4;
        }
        return { note: n, score };
    });

    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => ({
            noteId: x.note._id,
            title: x.note.title,
            cid: x.note.cid,
            subject: x.note.subject,
            score: Number(x.score.toFixed(2)),
            reason: affinity.has(String(x.note.subject || '').toLowerCase())
                ? `Matches subjects you engage with (${x.note.subject})`
                : 'Popular / high-quality on the platform'
        }));
}

module.exports = {
    name: 'heuristic',
    tokenize,
    noteCorpusText,
    summarize: async ({ note }) => extractiveSummary(note),
    assist: async ({ note, question }) => assistNote(note, question),
    semanticSearch: async ({ notes, query, limit }) => ({
        results: semanticSearch(notes, query, limit),
        method: 'heuristic-bow'
    }),
    generateQuiz: async ({ note, count }) => generateQuiz(note, count),
    generateFlashcards: async ({ note, count }) => generateFlashcards(note, count),
    recommend: async (args) => ({
        recommendations: recommend(args.notes, args),
        method: 'heuristic-affinity'
    })
};
