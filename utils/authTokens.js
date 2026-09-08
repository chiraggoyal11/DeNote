const jwt = require('jsonwebtoken');
const { normalizeRole, maybeBootstrapAdmin } = require('./roles');

function signUserToken(user) {
    return new Promise((resolve, reject) => {
        const payload = {
            user: {
                id: user.id || user._id
            }
        };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err) reject(err);
            else resolve(token);
        });
    });
}

function publicUser(user) {
    const fav = Array.isArray(user.fav) ? user.fav : [];
    maybeBootstrapAdmin(user);
    return {
        _id: user.id || user._id,
        username: user.username,
        email: user.email || null,
        phone: user.phone || null,
        displayName: user.displayName || null,
        picture: user.picture || null,
        bio: user.bio || null,
        college: user.college || null,
        branch: user.branch || null,
        semester: user.semester || null,
        authProvider: user.authProvider || 'local',
        role: normalizeRole(user.role),
        restricted: Boolean(user.restricted),
        hasPassword: Boolean(user.password),
        deletionScheduledAt: user.deletionScheduledAt || null,
        favoriteCount: fav.length,
        favorites: fav.map((f) => ({
            noteId: f.noteId || null,
            cid: f.cid || null
        }))
    };
}

module.exports = {
    signUserToken,
    publicUser
};
