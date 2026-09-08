const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getAiStatus, resolveProviderName, envFlag } = require('../utils/ai');

describe('ai provider config', () => {
    it('envFlag parses truthy values', () => {
        process.env.AI_TEST_FLAG = 'true';
        assert.equal(envFlag('AI_TEST_FLAG', false), true);
        process.env.AI_TEST_FLAG = '0';
        assert.equal(envFlag('AI_TEST_FLAG', true), false);
        delete process.env.AI_TEST_FLAG;
        assert.equal(envFlag('AI_TEST_FLAG', true), true);
    });

    it('defaults to disabled when AI_ENABLED is unset', () => {
        const prevEnabled = process.env.AI_ENABLED;
        const prevProvider = process.env.AI_PROVIDER;
        const prevKey = process.env.OPENAI_API_KEY;
        delete process.env.AI_ENABLED;
        delete process.env.AI_PROVIDER;
        delete process.env.OPENAI_API_KEY;
        assert.equal(resolveProviderName(), 'disabled');
        const status = getAiStatus();
        assert.equal(status.enabled, false);
        assert.equal(status.mode, 'disabled');
        if (prevEnabled != null) process.env.AI_ENABLED = prevEnabled;
        if (prevProvider != null) process.env.AI_PROVIDER = prevProvider;
        if (prevKey != null) process.env.OPENAI_API_KEY = prevKey;
    });

    it('uses heuristic when enabled without OpenAI key', () => {
        const prevEnabled = process.env.AI_ENABLED;
        const prevProvider = process.env.AI_PROVIDER;
        const prevKey = process.env.OPENAI_API_KEY;
        process.env.AI_ENABLED = 'true';
        process.env.AI_PROVIDER = 'openai';
        delete process.env.OPENAI_API_KEY;
        assert.equal(resolveProviderName(), 'heuristic');
        if (prevEnabled == null) delete process.env.AI_ENABLED;
        else process.env.AI_ENABLED = prevEnabled;
        if (prevProvider == null) delete process.env.AI_PROVIDER;
        else process.env.AI_PROVIDER = prevProvider;
        if (prevKey == null) delete process.env.OPENAI_API_KEY;
        else process.env.OPENAI_API_KEY = prevKey;
    });
});
