const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeRole,
    roleAtLeast,
    isStaff,
    maybeBootstrapAdmin,
    bootstrapAdminUsernames
} = require('../utils/roles');

describe('roles', () => {
    it('normalizes unknown roles to student', () => {
        assert.equal(normalizeRole('ADMIN'), 'admin');
        assert.equal(normalizeRole('nope'), 'student');
        assert.equal(normalizeRole(undefined), 'student');
    });

    it('compares role ranks', () => {
        assert.equal(roleAtLeast('admin', 'moderator'), true);
        assert.equal(roleAtLeast('student', 'moderator'), false);
        assert.equal(isStaff('moderator'), true);
        assert.equal(isStaff('contributor'), false);
    });

    it('bootstraps admin usernames from env', () => {
        const prev = process.env.ADMIN_USERNAMES;
        process.env.ADMIN_USERNAMES = 'phase4admin, OtherAdmin';
        assert.deepEqual(bootstrapAdminUsernames(), ['phase4admin', 'otheradmin']);
        const user = maybeBootstrapAdmin({ username: 'phase4admin', role: 'student' });
        assert.equal(user.role, 'admin');
        if (prev == null) delete process.env.ADMIN_USERNAMES;
        else process.env.ADMIN_USERNAMES = prev;
    });
});
