const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeResourceType,
    parseTags,
    computeQualityScore,
    resourceTypeLabel
} = require('../utils/resourceTypes');

describe('resourceTypes', () => {
    it('normalizes aliases', () => {
        assert.equal(normalizeResourceType('PYQs'), 'pyq');
        assert.equal(normalizeResourceType('lab manuals'), 'lab_manual');
        assert.equal(normalizeResourceType('unknown-thing'), 'note');
        assert.equal(resourceTypeLabel('pyq'), 'PYQs');
    });

    it('parses and dedupes tags', () => {
        assert.deepEqual(parseTags('OS, os, #DBMS, Networks'), ['os', 'dbms', 'networks']);
        assert.deepEqual(parseTags(''), []);
    });

    it('scores notes with metadata and engagement', () => {
        const low = computeQualityScore({ title: 'T' });
        const high = computeQualityScore({
            title: 'Networks',
            subject: 'CN',
            branch: 'CSE',
            sem: '5',
            description: 'Full notes',
            college: 'BMSCE',
            tags: ['cn', 'osi'],
            likeCount: 5,
            viewCount: 40,
            downloadCount: 3,
            isVerified: true,
            fileHash: 'abc'
        });
        assert.ok(high > low);
        assert.ok(high <= 100);
        assert.ok(low >= 20);
    });
});
