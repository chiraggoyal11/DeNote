const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true,
        unique: true
    },
    phone: {
        type: String,
        trim: true,
        sparse: true,
        unique: true
    },
    password: {
        type: String,
        // Not required for Google-only accounts
        required: false
    },
    googleId: {
        type: String,
        sparse: true,
        unique: true
    },
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    displayName: {
        type: String,
        trim: true
    },
    picture: {
        type: String,
        trim: true
    },
    otpHash: {
        type: String
    },
    otpExpires: {
        type: Date
    },
    otpPurpose: {
        type: String
    },
    fav: [{
        cid: {
            type: String
        }
    }],
    deletionScheduledAt: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model('User', userSchema);
