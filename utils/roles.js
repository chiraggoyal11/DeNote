const ROLES = ['student', 'contributor', 'moderator', 'admin'];

const ROLE_RANK = {
    student: 1,
    contributor: 2,
    moderator: 3,
    admin: 4
};

function normalizeRole(role) {
    const value = String(role || 'student').trim().toLowerCase();
    return ROLES.includes(value) ? value : 'student';
}

function roleAtLeast(userRole, minimum) {
    return (ROLE_RANK[normalizeRole(userRole)] || 0) >= (ROLE_RANK[normalizeRole(minimum)] || 99);
}

function isStaff(role) {
    return roleAtLeast(role, 'moderator');
}

function bootstrapAdminUsernames() {
    const raw = process.env.ADMIN_USERNAMES || process.env.ADMIN_BOOTSTRAP_USERNAME || '';
    return raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}

function maybeBootstrapAdmin(user) {
    if (!user?.username) return user;
    const admins = bootstrapAdminUsernames();
    if (admins.includes(String(user.username).toLowerCase()) && user.role !== 'admin') {
        user.role = 'admin';
    }
    return user;
}

module.exports = {
    ROLES,
    ROLE_RANK,
    normalizeRole,
    roleAtLeast,
    isStaff,
    bootstrapAdminUsernames,
    maybeBootstrapAdmin
};
