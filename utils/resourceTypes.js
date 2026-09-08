const RESOURCE_TYPES = [
    { value: 'note', label: 'Notes' },
    { value: 'pyq', label: 'PYQs' },
    { value: 'assignment', label: 'Assignments' },
    { value: 'lab_manual', label: 'Lab Manuals' },
    { value: 'cheat_sheet', label: 'Cheat Sheets' },
    { value: 'question_bank', label: 'Question Banks' },
    { value: 'project', label: 'Projects' },
    { value: 'book', label: 'Books/References' },
    { value: 'other', label: 'Other' }
];

const RESOURCE_TYPE_VALUES = RESOURCE_TYPES.map((t) => t.value);
const DEFAULT_RESOURCE_TYPE = 'note';

function normalizeResourceType(value) {
    if (!value) return DEFAULT_RESOURCE_TYPE;
    const raw = String(value).trim().toLowerCase().replace(/[\s/-]+/g, '_');
    const aliases = {
        notes: 'note',
        pyqs: 'pyq',
        lab: 'lab_manual',
        lab_manuals: 'lab_manual',
        cheat: 'cheat_sheet',
        cheatsheet: 'cheat_sheet',
        cheat_sheets: 'cheat_sheet',
        questionbanks: 'question_bank',
        question_banks: 'question_bank',
        projects: 'project',
        books: 'book',
        book_references: 'book',
        references: 'book',
        books_references: 'book'
    };
    const mapped = aliases[raw] || raw;
    return RESOURCE_TYPE_VALUES.includes(mapped) ? mapped : DEFAULT_RESOURCE_TYPE;
}

function resourceTypeLabel(value) {
    const found = RESOURCE_TYPES.find((t) => t.value === normalizeResourceType(value));
    return found ? found.label : 'Notes';
}

function parseTags(input) {
    if (!input) return [];
    const list = Array.isArray(input) ? input : String(input).split(/[,#]+/);
    const tags = [];
    const seen = new Set();
    for (const item of list) {
        const tag = String(item || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .slice(0, 32);
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);
        tags.push(tag);
        if (tags.length >= 12) break;
    }
    return tags;
}

/**
 * Lightweight quality score (0–100) for free-tier MVP.
 * Signals: metadata completeness, likes, views, downloads, verified, description.
 */
function computeQualityScore(note) {
    const doc = note && typeof note.toObject === 'function' ? note.toObject() : (note || {});
    let score = 20;

    const metaFields = [doc.title, doc.subject, doc.branch, doc.sem, doc.description, doc.college];
    const filled = metaFields.filter((v) => v && String(v).trim()).length;
    score += filled * 6; // up to +36

    if (Array.isArray(doc.tags) && doc.tags.length) {
        score += Math.min(8, doc.tags.length * 2);
    }

    const likes = typeof doc.likeCount === 'number' ? doc.likeCount : (doc.likes || []).length;
    score += Math.min(18, likes * 3);

    const views = doc.viewCount || 0;
    score += Math.min(10, Math.floor(views / 5));

    const downloads = doc.downloadCount || 0;
    score += Math.min(8, downloads * 2);

    if (doc.isVerified) score += 10;
    if (doc.fileHash) score += 2;

    return Math.max(0, Math.min(100, Math.round(score)));
}

function qualityScoreExplanation(note) {
    return 'Based on metadata completeness, tags, upvotes, views, downloads, and verification status.';
}

module.exports = {
    RESOURCE_TYPES,
    RESOURCE_TYPE_VALUES,
    DEFAULT_RESOURCE_TYPE,
    normalizeResourceType,
    resourceTypeLabel,
    parseTags,
    computeQualityScore,
    qualityScoreExplanation
};
