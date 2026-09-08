/**
 * Free-tier local AI: extractive summarization + quiz/flashcards from PDF text
 * (falls back to metadata when PDF text is unavailable).
 */

const {
    suggestedQuizCount,
    suggestedSummarySentenceCount
} = require('./noteDocumentText');

const STOP = new Set(
    'a an the and or of to in on for with from by is are was were be been being this that these those it its as at into about over under not no yes you your we our they their i me my which who whom whose what when where why how also such than then there here into through during before after above below between out off over again further once each few more most other some such only own same so than too very can will just should now'.split(' ')
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
    const doc = String(note.documentText || '').trim();
    const meta = [note.title, note.subject, note.branch, note.sem, note.college, note.description, tags, note.resourceType]
        .filter(Boolean)
        .join(' ');
    return doc ? `${meta}\n\n${doc}` : meta;
}

function bodyText(note) {
    const doc = String(note.documentText || '').trim();
    if (doc.length >= 80) return doc;
    return String(note.description || '').trim();
}

function sentencesFrom(text) {
    const raw = String(text || '').replace(/\f/g, '\n');
    const lines = raw.split(/\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const avgLen = lines.length
        ? lines.reduce((a, b) => a + b.length, 0) / lines.length
        : 0;

    // Cheat sheets / command lists: treat lines as units even when short
    if (lines.length >= 8 && avgLen < 80) {
        return uniquePreserve(
            lines
                .filter((s) => s.length >= 12 && s.length <= 420)
                .filter((s) => /[a-zA-Z]/.test(s))
        );
    }

    return uniquePreserve(
        raw
            .split(/(?<=[.!?])\s+|\n+/)
            .map((s) => s.replace(/\s+/g, ' ').trim())
            .filter((s) => s.length >= 25 && s.length <= 420)
            .filter((s) => /[a-zA-Z]/.test(s))
    );
}

function uniquePreserve(items) {
    const seen = new Set();
    const out = [];
    for (const item of items) {
        const key = String(item).toLowerCase().slice(0, 120);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}

function extractiveSummary(note, maxSentences) {
    const body = bodyText(note);
    const hasPdf = String(note.documentText || '').trim().length >= 80;
    const sentences = sentencesFrom(body);
    const target = maxSentences || suggestedSummarySentenceCount(body);

    if (sentences.length === 0) {
        return {
            summary: `${note.title || 'This note'} covers ${note.subject || 'coursework'} for ${note.branch || 'your'} semester ${note.sem || '?'}.`,
            bullets: [
                `Subject: ${note.subject || 'N/A'}`,
                `Type: ${note.resourceType || 'notes'}`,
                note.tags?.length ? `Tags: ${note.tags.slice(0, 6).join(', ')}` : 'No tags yet',
                note.documentMeta?.error
                    ? `PDF text unavailable (${note.documentMeta.error}). Showing metadata-only summary.`
                    : null
            ].filter(Boolean),
            method: hasPdf ? 'heuristic-sparse-pdf' : 'heuristic-metadata',
            document: note.documentMeta || null
        };
    }

    // Spread coverage across the full document (beginning / middle / end)
    const picks = [];
    if (sentences.length <= target) {
        picks.push(...sentences);
    } else {
        const step = Math.max(1, Math.floor(sentences.length / target));
        for (let i = 0; i < sentences.length && picks.length < target; i += step) {
            picks.push(sentences[i]);
        }
        // Fill remaining with highest-scoring leftovers vs title/subject
        if (picks.length < target) {
            const queryTf = termFreq(tokenize(`${note.title} ${note.subject} ${note.tags || ''}`));
            const leftover = sentences
                .filter((s) => !picks.includes(s))
                .map((s) => ({ s, score: cosine(queryTf, termFreq(tokenize(s))) }))
                .sort((a, b) => b.score - a.score);
            for (const x of leftover) {
                if (picks.length >= target) break;
                picks.push(x.s);
            }
        }
    }

    const ordered = sentences.filter((s) => picks.includes(s)).slice(0, target);
    const summary = ordered.join(' ');
    const bullets = ordered.slice(0, Math.min(10, ordered.length));

    return {
        summary,
        bullets,
        method: hasPdf ? 'heuristic-pdf-extractive' : 'heuristic-description-extractive',
        document: {
            ...(note.documentMeta || {}),
            usedChars: body.length,
            sentenceCount: sentences.length,
            summarySentences: ordered.length
        }
    };
}

function assistNote(note, question) {
    const q = String(question || '').trim();
    const summary = extractiveSummary(note, 4);
    const hay = noteCorpusText(note).toLowerCase();
    const body = bodyText(note);
    const sentences = sentencesFrom(body);
    const qTokens = tokenize(q);
    const hits = qTokens.filter((t) => hay.includes(t));

    let answer;
    if (!q) {
        answer = `Here is an overview of “${note.title}”: ${summary.summary}`;
    } else {
        const qTf = termFreq(qTokens);
        const best = sentences
            .map((s) => ({ s, score: cosine(qTf, termFreq(tokenize(s))) }))
            .filter((x) => x.score > 0.05)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((x) => x.s);
        if (best.length) {
            answer = `Regarding “${q}”: ${best.join(' ')}`;
        } else if (hits.length === 0) {
            answer = `I could not find a clear match for “${q}” in the document text. Overview: ${summary.summary}`;
        } else {
            answer = `Regarding “${q}”, related terms in this note: ${hits.slice(0, 8).join(', ')}. Context: ${summary.summary}`;
        }
    }

    return {
        answer,
        citations: [
            {
                noteId: note._id,
                title: note.title,
                cid: note.cid,
                fields: note.documentText ? ['documentText', 'title', 'subject'] : ['title', 'subject', 'description', 'tags']
            }
        ],
        method: note.documentText ? 'heuristic-pdf-rag-lite' : 'heuristic-rag-lite',
        document: note.documentMeta || null
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

function blankKeyPhrase(sentence) {
    const tokens = String(sentence)
        .replace(/[^a-zA-Z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 5 && !STOP.has(t.toLowerCase()));
    if (!tokens.length) return null;
    // Prefer a mid-length content word
    const ranked = [...tokens].sort((a, b) => b.length - a.length);
    const answer = ranked[0];
    const prompt = sentence.replace(new RegExp(`\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), '______');
    if (prompt === sentence) return null;
    return { prompt: `Fill in the blank: ${prompt}`, answer, subject: null };
}

function generateFlashcards(note, count = 6) {
    const body = bodyText(note);
    const subject = note.subject || 'General';
    const sentences = uniquePreserve(sentencesFrom(body));
    const cards = [];

    for (const s of sentences) {
        if (cards.length >= count) break;
        const blank = blankKeyPhrase(s);
        if (blank) {
            cards.push({
                front: blank.prompt,
                back: `${blank.answer} — ${s}`,
                subject
            });
            continue;
        }
        const short = s.length > 100 ? `${s.slice(0, 97)}…` : s;
        cards.push({
            front: `Explain / recall: ${short}`,
            back: s,
            subject
        });
    }

    if (note.title && cards.length < count) {
        cards.unshift({
            front: `What is the main topic of “${note.title}”?`,
            back: `${note.title} — ${subject}${note.branch ? ` (${note.branch}, sem ${note.sem || '?'})` : ''}`,
            subject
        });
    }

    while (cards.length < Math.min(3, count)) {
        cards.push({
            front: `Key takeaway from ${note.title || 'this note'}?`,
            back: extractiveSummary(note, 2).summary,
            subject
        });
    }

    return {
        cards: cards.slice(0, count),
        method: note.documentText ? 'heuristic-pdf-cards' : 'heuristic-templates',
        document: note.documentMeta || null
    };
}

function generateQuiz(note, count) {
    const body = bodyText(note);
    const n = suggestedQuizCount(body, count);
    const { cards, method, document } = generateFlashcards(note, n);
    const questions = cards.map((c, i) => ({
        id: `q${i + 1}`,
        prompt: c.front.startsWith('Fill in the blank:')
            ? c.front
            : c.front.replace(/^Explain \/ recall:\s*/i, 'What does this note say about: ').replace(/\?$/, '') + '?',
        answer: c.back,
        subject: c.subject
    }));
    return {
        questions,
        method: method.includes('pdf') ? 'heuristic-pdf-quiz' : 'heuristic-from-content',
        document: {
            ...(document || {}),
            requestedCount: count ?? null,
            questionCount: questions.length
        }
    };
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
    generateFlashcards: async ({ note, count }) => {
        const body = bodyText(note);
        const n = count != null ? Math.min(20, Math.max(3, parseInt(count, 10) || 6)) : suggestedQuizCount(body);
        return generateFlashcards(note, n);
    },
    recommend: async (args) => ({
        recommendations: recommend(args.notes, args),
        method: 'heuristic-affinity'
    })
};
