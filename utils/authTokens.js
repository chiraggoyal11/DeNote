const jwt = require('jsonwebtoken');

function signUserToken(user) {
    return new Promise((resolve, reject) => {
        const payload = {
            user: {
                id: user.id || user._id
            }
        };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: 3600 }, (err, token) => {
            if (err) reject(err);
            else resolve(token);
        });
    });
}

function publicUser(user) {
    return {
        _id: user.id || user._id,
        username: user.username,
        email: user.email || null,
        phone: user.phone || null,
        authProvider: user.authProvider || 'local',
        hasPassword: Boolean(user.password),
        deletionScheduledAt: user.deletionScheduledAt || null
    };
}

module.exports = {
    signUserToken,
    publicUser
};
