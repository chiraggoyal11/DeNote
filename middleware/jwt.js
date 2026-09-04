const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({
            msg: "Auth. denied"
        });
    }

    // Frontend sends "Bearer <token>"; accept raw token too.
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const token = (match ? match[1] : authHeader).trim();

    if (!token) {
        return res.status(401).json({
            msg: "Auth. denied"
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (error) {
        return res.status(401).json({
            msg: "Error"
        });
    }
}
