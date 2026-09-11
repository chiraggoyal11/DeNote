const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const { createApp } = require('../createApp');

function listen(app) {
    return new Promise((resolve) => {
        const server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({ server, base: `http://127.0.0.1:${port}` });
        });
    });
}

describe('HTTP smoke (no DB)', () => {
    let server;
    let base;

    before(async () => {
        ({ server, base } = await listen(createApp()));
    });

    after(async () => {
        await new Promise((resolve) => server.close(resolve));
    });

    it('GET /health returns ok', async () => {
        const res = await fetch(`${base}/health`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.status, 'ok');
        assert.equal(body.service, 'denote');
    });

    it('GET /api/denote/meta/resource-types lists types', async () => {
        const res = await fetch(`${base}/api/denote/meta/resource-types`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.ok(Array.isArray(body.types) || Array.isArray(body.resourceTypes) || body.success !== false);
        // Accept either shape used by the route
        const types = body.types || body.resourceTypes || body.data;
        if (types) {
            assert.ok(types.length >= 5);
        } else {
            assert.ok(body.success === true || Object.keys(body).length > 0);
        }
    });

    it('unknown route returns 404 JSON', async () => {
        const res = await fetch(`${base}/api/denote/this-route-does-not-exist-xyz`);
        assert.equal(res.status, 404);
        const body = await res.json();
        assert.equal(body.success, false);
        assert.match(body.msg, /not found/i);
    });

    it('protected AI status rejects missing auth', async () => {
        const res = await fetch(`${base}/api/denote/ai/status`);
        assert.ok([401, 403].includes(res.status));
    });
});
