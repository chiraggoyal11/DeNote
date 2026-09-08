/**
 * AI provider abstraction (Phase 7).
 * Current free-tier options: disabled | heuristic | openai
 * Swap providers later without rewriting routes.
 */

function envFlag(name, fallback = false) {
    const raw = process.env[name];
    if (raw == null || raw === '') return fallback;
    return /^(1|true|yes|on)$/i.test(String(raw).trim());
}

function resolveProviderName() {
    if (!envFlag('AI_ENABLED', false)) return 'disabled';
    const named = String(process.env.AI_PROVIDER || 'heuristic').trim().toLowerCase();
    if (named === 'openai' && process.env.OPENAI_API_KEY) return 'openai';
    if (named === 'openai' && !process.env.OPENAI_API_KEY) return 'heuristic';
    if (named === 'disabled') return 'disabled';
    return 'heuristic';
}

function getAiStatus() {
    const enabled = envFlag('AI_ENABLED', false);
    const provider = resolveProviderName();
    return {
        enabled: enabled && provider !== 'disabled',
        provider,
        configuredProvider: String(process.env.AI_PROVIDER || 'heuristic').trim().toLowerCase() || 'heuristic',
        hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
        mode: !enabled || provider === 'disabled' ? 'disabled' : provider,
        limitations: [
            'AI is optional and off by default (AI_ENABLED=false).',
            'heuristic mode uses local extractive/RAG-lite over note metadata (no paid API).',
            'openai mode requires OPENAI_API_KEY; falls back to heuristic if unset.',
            'PDF body text is not OCR’d on the free tier — summaries use title/description/tags/subject.'
        ]
    };
}

async function getProvider() {
    const status = getAiStatus();
    if (!status.enabled) {
        return require('./disabledProvider');
    }
    if (status.provider === 'openai') {
        return require('./openaiProvider');
    }
    return require('./heuristicProvider');
}

module.exports = {
    envFlag,
    resolveProviderName,
    getAiStatus,
    getProvider
};
