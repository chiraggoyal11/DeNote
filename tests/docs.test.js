const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('docs artifacts', () => {
    it('ships OpenAPI 3 spec', () => {
        const file = path.join(__dirname, '..', 'docs', 'openapi.yaml');
        const raw = fs.readFileSync(file, 'utf8');
        assert.match(raw, /^openapi:\s*3\./m);
        assert.match(raw, /\/health/);
        assert.match(raw, /bearerAuth/);
        assert.match(raw, /\/api\/denote\/login/);
    });

    it('ships testing guide', () => {
        const file = path.join(__dirname, '..', 'docs', 'TESTING.md');
        assert.ok(fs.existsSync(file));
        const raw = fs.readFileSync(file, 'utf8');
        assert.match(raw, /npm test/);
    });

    it('ships CD workflow and deploy guide', () => {
        const workflow = path.join(__dirname, '..', '.github', 'workflows', 'cd.yml');
        const guide = path.join(__dirname, '..', 'docs', 'DEPLOY.md');
        assert.ok(fs.existsSync(workflow));
        assert.ok(fs.existsSync(guide));
        const yml = fs.readFileSync(workflow, 'utf8');
        assert.match(yml, /workflow_run/);
        assert.match(yml, /VERCEL_TOKEN/);
        assert.match(yml, /RENDER_DEPLOY_HOOK_URL/);
        assert.match(fs.readFileSync(guide, 'utf8'), /VERCEL_ORG_ID/);
    });
});
