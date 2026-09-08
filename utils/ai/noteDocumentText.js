/**
 * Fetch note PDF from IPFS and extract plain text for Study AI.
 * Free-tier: in-memory cache by CID, no Redis.
 */

const pdfParse = require('pdf-parse');
const axios = require('axios');
const { ipfsCandidateUrls } = require('../ipfs');

const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1h
const MAX_CACHE_ENTRIES = 40;
const MAX_TEXT_CHARS = 120_000;

function cacheGet(cid) {
    const hit = cache.get(cid);
    if (!hit) return null;
    if (Date.now() - hit.at > CACHE_TTL_MS) {
        cache.delete(cid);
        return null;
    }
    return hit;
}

function cacheSet(cid, value) {
    if (cache.size >= MAX_CACHE_ENTRIES) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
    }
    cache.set(cid, { ...value, at: Date.now() });
}

function cleanExtractedText(raw) {
    return String(raw || '')
        .replace(/\u0000/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim()
        .slice(0, MAX_TEXT_CHARS);
}

/**
 * Extract text for a note. Returns { text, pageCount, source, chars, error? }
 * source: pdf | metadata | empty
 */
async function extractNoteDocumentText(note, { force = false } = {}) {
    const cid = note?.cid;
    if (!cid) {
        return { text: '', pageCount: 0, source: 'empty', chars: 0, error: 'missing_cid' };
    }

    if (!force) {
        const cached = cacheGet(cid);
        if (cached) {
            return {
                text: cached.text,
                pageCount: cached.pageCount || 0,
                source: cached.source || 'pdf',
                chars: cached.text.length,
                cached: true
            };
        }
    }

    const errors = [];

    for (const url of ipfsCandidateUrls(cid)) {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 400
            });
            const buffer = Buffer.from(response.data || []);
            if (buffer.length < 100) {
                errors.push(`${url}: too small (${buffer.length}b)`);
                continue;
            }
            if (buffer.slice(0, 5).toString('utf8') !== '%PDF-') {
                errors.push(`${url}: not a PDF magic header`);
                continue;
            }

            const parsed = await pdfParse(buffer);
            const text = cleanExtractedText(parsed.text);
            const pageCount = parsed.numpages || 0;
            const source = text.length >= 80 ? 'pdf' : 'sparse_pdf';
            cacheSet(cid, { text, pageCount, source });
            return {
                text,
                pageCount,
                source,
                chars: text.length,
                gatewayUrl: url,
                cached: false
            };
        } catch (err) {
            errors.push(`${url}: ${err.message}`);
        }
    }

    return {
        text: '',
        pageCount: 0,
        source: 'empty',
        chars: 0,
        error: errors[0] || 'extract_failed',
        details: errors.slice(0, 4)
    };
}

/**
 * Attach documentText (+ meta) onto a plain note object for AI providers.
 */
async function enrichNoteWithDocumentText(note) {
    const plain = note && typeof note.toObject === 'function' ? note.toObject() : { ...(note || {}) };
    const extracted = await extractNoteDocumentText(plain);
    plain.documentText = extracted.text || '';
    plain.documentMeta = {
        source: extracted.source,
        pageCount: extracted.pageCount,
        chars: extracted.chars,
        cached: Boolean(extracted.cached),
        error: extracted.error || null
    };
    return plain;
}

function suggestedQuizCount(documentText, requested) {
    if (requested != null && !Number.isNaN(Number(requested)) && Number(requested) > 0) {
        return Math.min(20, Math.max(3, parseInt(requested, 10)));
    }
    const text = String(documentText || '');
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (words < 80) return 3;
    if (words < 250) return 5;
    if (words < 600) return 8;
    if (words < 1200) return 10;
    if (words < 2500) return 12;
    return 15;
}

function suggestedSummarySentenceCount(documentText) {
    const words = String(documentText || '').trim().split(/\s+/).filter(Boolean).length;
    if (words < 120) return 3;
    if (words < 400) return 5;
    if (words < 900) return 7;
    if (words < 2000) return 9;
    return 12;
}

module.exports = {
    extractNoteDocumentText,
    enrichNoteWithDocumentText,
    suggestedQuizCount,
    suggestedSummarySentenceCount,
    cleanExtractedText,
    // test helpers
    _cache: cache
};
