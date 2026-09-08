const AuditLog = require('../models/auditLog');

async function writeAudit({
    actorId = null,
    actorUsername = '',
    action,
    targetType = '',
    targetId = '',
    meta = {}
}) {
    try {
        return await AuditLog.create({
            actorId,
            actorUsername,
            action,
            targetType,
            targetId: targetId ? String(targetId) : '',
            meta
        });
    } catch (err) {
        console.log('audit write failed:', err.message);
        return null;
    }
}

function serializeAudit(doc) {
    const a = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    return {
        _id: a._id,
        actorId: a.actorId || null,
        actorUsername: a.actorUsername || '',
        action: a.action,
        targetType: a.targetType || '',
        targetId: a.targetId || '',
        meta: a.meta || {},
        createdAt: a.createdAt
    };
}

module.exports = {
    writeAudit,
    serializeAudit
};
