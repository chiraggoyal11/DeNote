const jwt = require('jsonwebtoken');

module.exports = async function(req, res, next) {
    const authHeader = req.header('Authorization');

    if (!authHeader) {
        return res.status(401).json({
            msg: "Auth. denied"
        });
    }

    // Frontend sends "Bearer <token>"; accept raw token too for compatibility.
    const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : authHeader.trim();

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
