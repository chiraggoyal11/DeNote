const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            msg: 'Please sign in to continue.',
            code: 'NO_TOKEN'
        });
    }

    // Frontend sends "Bearer <token>"; accept raw token too.
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = (match ? match[1] : authHeader).trim();

    if (!token) {
        return res.status(401).json({
            success: false,
            msg: 'Please sign in to continue.',
            code: 'NO_TOKEN'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded?.user?.id) {
            return res.status(401).json({
                success: false,
                msg: 'Invalid session. Please sign in again.',
                code: 'INVALID_TOKEN'
            });
        }
        req.user = decoded.user;
        next();
    } catch (error) {
        const expired = error?.name === 'TokenExpiredError';
        return res.status(401).json({
            success: false,
            msg: expired
                ? 'Session expired. Please sign in again.'
                : 'Invalid session. Please sign in again.',
            code: expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
        });
    }
}
