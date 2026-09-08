/**
 * Optional OpenAI provider. Requires OPENAI_API_KEY.
 * Uses full PDF document text when available; falls back to heuristic on failure.
 */

const heuristic = require('./heuristicProvider');
const { suggestedQuizCount, suggestedSummarySentenceCount } = require('./noteDocumentText');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function chat(messages, { temperature = 0.3, max_tokens = 900 } = {}) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY missing');
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const res = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens })
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
}

function noteContext(note, maxChars = 14000) {
    const meta = [
        `Title: ${note.title || ''}`,
        `Subject: ${note.subject || ''}`,
        `Branch/Sem: ${note.branch || ''} / ${note.sem || ''}`,
        `Description: ${note.description || ''}`,
        `Tags: ${(note.tags || []).join(', ')}`
    ].join('\n');
    const doc = String(note.documentText || '').trim();
    const combined = doc ? `${meta}\n\nDocument text:\n${doc}` : meta;
    return combined.slice(0, maxChars);
}

async function summarize({ note }) {
    try {
        const target = suggestedSummarySentenceCount(note.documentText || note.description || '');
        const content = await chat([
            {
                role: 'system',
                content: `Summarize the full academic document for students. Cover the whole document, not just the title. Return JSON {"summary":"...","bullets":["..."]} only. Aim for about ${target} key points in bullets.`
            },
            { role: 'user', content: noteContext(note) }
        ], { max_tokens: 1200 });
        const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
        return {
            summary: parsed.summary || content,
            bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 12) : [],
            method: 'openai-document',
            document: note.documentMeta || null
        };
    } catch (err) {
        const fallback = await heuristic.summarize({ note });
        return { ...fallback, method: `heuristic-fallback:${err.message.slice(0, 80)}` };
    }
}

async function assist({ note, question }) {
    try {
        const content = await chat([
            {
                role: 'system',
                content: 'You are a concise study assistant. Answer using the provided document text when present. If the answer is not in the document, say so.'
            },
            {
                role: 'user',
                content: `${noteContext(note)}\n\nQuestion: ${question || 'Give an overview of the full document.'}`
            }
        ]);
        return {
            answer: content,
            citations: [{ noteId: note._id, title: note.title, cid: note.cid }],
            method: 'openai-document',
            document: note.documentMeta || null
        };
    } catch (err) {
        const fallback = await heuristic.assist({ note, question });
        return { ...fallback, method: `heuristic-fallback:${err.message.slice(0, 80)}` };
    }
}

async function semanticSearch(args) {
    return heuristic.semanticSearch(args);
}

async function generateQuiz({ note, count }) {
    const n = suggestedQuizCount(note.documentText || note.description || '', count);
    try {
        const content = await chat([
            {
                role: 'system',
                content: 'Create study quiz questions grounded in the document content (not just the title). Return JSON {"questions":[{"prompt":"...","answer":"...","subject":"..."}]} only.'
            },
            {
                role: 'user',
                content: `Make ${n} questions from this document. Scale difficulty to the material:\n${noteContext(note)}`
            }
        ], { max_tokens: 1600 });
        const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
        if (Array.isArray(parsed.questions) && parsed.questions.length) {
            return {
                questions: parsed.questions.slice(0, n),
                method: 'openai-document',
                document: {
                    ...(note.documentMeta || {}),
                    questionCount: Math.min(parsed.questions.length, n)
                }
            };
        }
    } catch (err) {
        const fallback = await heuristic.generateQuiz({ note, count: n });
        return { ...fallback, method: 'heuristic-fallback' };
    }
    return heuristic.generateQuiz({ note, count: n });
}

async function generateFlashcards({ note, count }) {
    const n = count != null
        ? Math.min(20, Math.max(3, parseInt(count, 10) || 6))
        : suggestedQuizCount(note.documentText || note.description || '');
    try {
        const content = await chat([
            {
                role: 'system',
                content: 'Create flashcards from the document content. Return JSON {"cards":[{"front":"...","back":"...","subject":"..."}]} only.'
            },
            { role: 'user', content: `Make ${n} flashcards from:\n${noteContext(note)}` }
        ], { max_tokens: 1600 });
        const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
        if (Array.isArray(parsed.cards) && parsed.cards.length) {
            return {
                cards: parsed.cards.slice(0, n),
                method: 'openai-document',
                document: note.documentMeta || null
            };
        }
    } catch (err) {
        const fallback = await heuristic.generateFlashcards({ note, count: n });
        return { ...fallback, method: 'heuristic-fallback' };
    }
    return heuristic.generateFlashcards({ note, count: n });
}

async function recommend(args) {
    return heuristic.recommend(args);
}

module.exports = {
    name: 'openai',
    summarize,
    assist,
    semanticSearch,
    generateQuiz,
    generateFlashcards,
    recommend
};
