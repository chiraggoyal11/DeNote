const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    actorUsername: {
        type: String,
        default: ''
    },
    action: {
        type: String,
        required: true,
        index: true
    },
    targetType: {
        type: String,
        default: ''
    },
    targetId: {
        type: String,
        default: ''
    },
    meta: {
        type: Object,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
