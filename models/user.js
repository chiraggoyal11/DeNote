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
    bio: {
        type: String,
        trim: true,
        maxlength: 280
    },
    college: {
        type: String,
        trim: true
    },
    branch: {
        type: String,
        trim: true
    },
    semester: {
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
        noteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Note'
        },
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
