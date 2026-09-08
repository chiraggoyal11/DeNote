/**
 * Optional OpenAI provider. Requires OPENAI_API_KEY.
 * Falls back to heuristic methods on failure / missing key.
 */

const heuristic = require('./heuristicProvider');

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function chat(messages, { temperature = 0.3, max_tokens = 500 } = {}) {
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

function noteContext(note) {
    return heuristic.noteCorpusText(note).slice(0, 3500);
}

async function summarize({ note }) {
    try {
        const content = await chat([
            { role: 'system', content: 'Summarize academic notes briefly for students. Return JSON {"summary":"...","bullets":["..."]} only.' },
            { role: 'user', content: noteContext(note) }
        ]);
        const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
        return {
            summary: parsed.summary || content,
            bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 6) : [],
            method: 'openai'
        };
    } catch (err) {
        const fallback = await heuristic.summarize({ note });
        return { ...fallback, method: `heuristic-fallback:${err.message.slice(0, 80)}` };
    }
}

async function assist({ note, question }) {
    try {
        const content = await chat([
            { role: 'system', content: 'You are a concise study assistant. Answer using only the provided note context. Cite that you used note metadata.' },
            { role: 'user', content: `Note context:\n${noteContext(note)}\n\nQuestion: ${question || 'Give an overview.'}` }
        ]);
        return {
            answer: content,
            citations: [{ noteId: note._id, title: note.title, cid: note.cid }],
            method: 'openai'
        };
    } catch (err) {
        const fallback = await heuristic.assist({ note, question });
        return { ...fallback, method: `heuristic-fallback:${err.message.slice(0, 80)}` };
    }
}

async function semanticSearch(args) {
    // Embeddings would cost money / extra infra — use heuristic retrieval on free tier
    // even when openai is selected, unless OPENAI_EMBEDDINGS=true later.
    return heuristic.semanticSearch(args);
}

async function generateQuiz({ note, count }) {
    try {
        const content = await chat([
            {
                role: 'system',
                content: 'Create short study quiz questions. Return JSON {"questions":[{"prompt":"...","answer":"...","subject":"..."}]} only.'
            },
            { role: 'user', content: `Make ${count || 5} questions from:\n${noteContext(note)}` }
        ], { max_tokens: 800 });
        const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
        if (Array.isArray(parsed.questions) && parsed.questions.length) {
            return { questions: parsed.questions.slice(0, count || 5), method: 'openai' };
        }
    } catch (err) {
        const fallback = await heuristic.generateQuiz({ note, count });
        return { ...fallback, method: `heuristic-fallback` };
    }
    return heuristic.generateQuiz({ note, count });
}

async function generateFlashcards({ note, count }) {
    try {
        const content = await chat([
            {
                role: 'system',
                content: 'Create flashcards. Return JSON {"cards":[{"front":"...","back":"...","subject":"..."}]} only.'
            },
            { role: 'user', content: `Make ${count || 6} flashcards from:\n${noteContext(note)}` }
        ], { max_tokens: 800 });
        const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
        if (Array.isArray(parsed.cards) && parsed.cards.length) {
            return { cards: parsed.cards.slice(0, count || 6), method: 'openai' };
        }
    } catch (err) {
        const fallback = await heuristic.generateFlashcards({ note, count });
        return { ...fallback, method: `heuristic-fallback` };
    }
    return heuristic.generateFlashcards({ note, count });
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
