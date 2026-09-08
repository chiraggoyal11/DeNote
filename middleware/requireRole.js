const User = require('../models/user');
const { roleAtLeast, normalizeRole, maybeBootstrapAdmin } = require('../utils/roles');

/**
 * Require authenticated user with at least `minimumRole`.
 * Loads fresh user from DB (role/restriction) — never trust JWT claims alone.
 */
function requireRole(minimumRole = 'moderator') {
    return async function roleGuard(req, res, next) {
        try {
            if (!req.user?.id) {
                return res.status(401).json({ success: false, msg: 'Auth. denied', code: 'NO_TOKEN' });
            }

            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(401).json({ success: false, msg: 'Auth. denied', code: 'INVALID_TOKEN' });
            }

            const before = user.role;
            maybeBootstrapAdmin(user);
            if (user.role !== before) {
                await user.save();
            }

            if (user.restricted) {
                return res.status(403).json({
                    success: false,
                    msg: user.restrictionReason || 'Your account is restricted.',
                    code: 'ACCOUNT_RESTRICTED'
                });
            }

            if (!roleAtLeast(user.role, minimumRole)) {
                return res.status(403).json({
                    success: false,
                    msg: 'Insufficient permissions.',
                    code: 'FORBIDDEN_ROLE'
                });
            }

            req.dbUser = user;
            req.userRole = normalizeRole(user.role);
            next();
        } catch (err) {
            console.log(err);
            res.status(500).json({ success: false, msg: 'Authorization failed' });
        }
    };
}

module.exports = requireRole;
