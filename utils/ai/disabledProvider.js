class AiDisabledError extends Error {
    constructor(message = 'AI features are disabled. Set AI_ENABLED=true to turn them on.') {
        super(message);
        this.name = 'AiDisabledError';
        this.code = 'AI_DISABLED';
        this.status = 503;
    }
}

async function unavailable() {
    throw new AiDisabledError();
}

module.exports = {
    name: 'disabled',
    summarize: unavailable,
    assist: unavailable,
    semanticSearch: unavailable,
    recommend: unavailable,
    AiDisabledError
};
