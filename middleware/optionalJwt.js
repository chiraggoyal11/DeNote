const jwt = require('jsonwebtoken');

/**
 * Optional JWT: attaches req.user when a valid token is present,
 * otherwise continues as anonymous (req.user unset).
 */
module.exports = function optionalJwt(req, res, next) {
    const authHeader = req.header('Authorization');
    if (!authHeader) return next();

    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = (match ? match[1] : authHeader).trim();
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
    } catch (error) {
        // Ignore invalid tokens for public endpoints.
    }
    next();
};
