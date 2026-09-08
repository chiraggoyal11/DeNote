const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    getAllowedEmailDomains,
    emailDomain,
    isAllowedCollegeEmail
} = require('../utils/collegeEmail');

describe('collegeEmail', () => {
    it('parses domains from ALLOWED_EMAIL_DOMAIN', () => {
        const prev = process.env.ALLOWED_EMAIL_DOMAIN;
        const prevMulti = process.env.ALLOWED_EMAIL_DOMAINS;
        process.env.ALLOWED_EMAIL_DOMAIN = 'bmsce.ac.in';
        delete process.env.ALLOWED_EMAIL_DOMAINS;
        assert.deepEqual(getAllowedEmailDomains(), ['bmsce.ac.in']);
        process.env.ALLOWED_EMAIL_DOMAIN = prev;
        if (prevMulti == null) delete process.env.ALLOWED_EMAIL_DOMAINS;
        else process.env.ALLOWED_EMAIL_DOMAINS = prevMulti;
    });

    it('extracts email domain case-insensitively', () => {
        assert.equal(emailDomain('Student@BMSCE.AC.IN'), 'bmsce.ac.in');
        assert.equal(emailDomain('bad'), '');
        assert.equal(emailDomain(null), '');
    });

    it('allows only configured college domains', () => {
        const prev = process.env.ALLOWED_EMAIL_DOMAINS;
        process.env.ALLOWED_EMAIL_DOMAINS = 'bmsce.ac.in,other.edu';
        assert.equal(isAllowedCollegeEmail('a@bmsce.ac.in'), true);
        assert.equal(isAllowedCollegeEmail('a@other.edu'), true);
        assert.equal(isAllowedCollegeEmail('a@gmail.com'), false);
        if (prev == null) delete process.env.ALLOWED_EMAIL_DOMAINS;
        else process.env.ALLOWED_EMAIL_DOMAINS = prev;
    });
});
