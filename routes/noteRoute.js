const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/user');
const Note = require('../models/note');
const bcryptjs= require('bcryptjs');
const user_jwt=require('../middleware/jwt');
const optionalJwt = require('../middleware/optionalJwt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const axios=require('axios');
const FormData=require('form-data');
const fs=require('fs');
const { OAuth2Client } = require('google-auth-library');
const { generateOtp, hashOtp, verifyOtp, useHardcodedOtp, HARDCODED_OTP } = require('../utils/otp');
const { sendEmailOtp, sendSmsOtp } = require('../utils/notify');
const { signUserToken, publicUser } = require('../utils/authTokens');
const { ipfsUrl, fetchIpfsContent } = require('../utils/ipfs');
const { scheduleDeletionDate, purgeIfDue } = require('../utils/accountDeletion');
const {
    isNoteOwner,
    serializeNote,
    loadFavoriteSets,
    buildNotesQuery,
    sortSpec
} = require('../utils/notesHelpers');
const {
    isAllowedCollegeEmail,
    collegeEmailRequiredMsg,
    collegeEmailDeniedMsg
} = require('../utils/collegeEmail');
const {
    RESOURCE_TYPES,
    normalizeResourceType,
    parseTags
} = require('../utils/resourceTypes');
const { authLimiter, otpLimiter, uploadLimiter } = require('../middleware/rateLimit');
const crypto = require('crypto');
const { createNotification } = require('../utils/notifications');
const { maybeBootstrapAdmin } = require('../utils/roles');

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const memory = multer.memoryStorage();
const upload = multer({
    storage: memory,
    limits: { fileSize: MAX_UPLOAD_BYTES },
    fileFilter: (req, file, cb) => {
        const name = (file.originalname || '').toLowerCase();
        const isPdf =
            file.mimetype === 'application/pdf' ||
            name.endsWith('.pdf');
        if (!isPdf) {
            return cb(new Error('Only PDF files are allowed'));
        }
        return cb(null, true);
    }
});
const googleClient = process.env.GOOGLE_CLIENT_ID
    ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
    : null;

function normalizeEmail(email) {
    return email ? String(email).trim().toLowerCase() : '';
}

function normalizePhone(phone) {
    return phone ? String(phone).trim().replace(/\s+/g, '') : '';
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function assertCollegeEmail(email) {
    if (!email || !isValidEmail(email)) {
        return { ok: false, msg: collegeEmailRequiredMsg() };
    }
    if (!isAllowedCollegeEmail(email)) {
        return { ok: false, msg: collegeEmailDeniedMsg() };
    }
    return { ok: true };
}

function isValidPhone(phone) {
    return /^\+?[0-9]{8,15}$/.test(phone);
}

function normalizeUsername(username) {
    return username ? String(username).trim() : '';
}

function isValidUsername(username) {
    return /^[a-zA-Z0-9_]{3,24}$/.test(username);
}

router.get('/', user_jwt, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                msg: "User not found."
            });
        }

        if (await purgeIfDue(user)) {
            return res.status(401).json({
                success: false,
                msg: "This account was deleted after the scheduled grace period.",
                accountDeleted: true
            });
        }

        res.status(200).json({
            success: true,
            user: publicUser(user)
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "error hogya bhai"
        });
        next();
    }

});

router.put('/account/profile', user_jwt, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                msg: "User not found."
            });
        }

        if (await purgeIfDue(user)) {
            return res.status(401).json({
                success: false,
                msg: "This account was deleted after the scheduled grace period.",
                accountDeleted: true
            });
        }

        const previousUsername = user.username;
        const usernameRaw = req.body.username != null
            ? normalizeUsername(req.body.username)
            : user.username;
        const displayName = req.body.displayName != null ? String(req.body.displayName).trim() : user.displayName;
        const bio = req.body.bio != null ? String(req.body.bio).trim() : user.bio;
        const college = req.body.college != null ? String(req.body.college).trim() : user.college;
        const branch = req.body.branch != null ? String(req.body.branch).trim() : user.branch;
        const semester = req.body.semester != null ? String(req.body.semester).trim() : user.semester;
        const emailRaw = req.body.email != null ? normalizeEmail(req.body.email) : (user.email || '');
        const phoneRaw = req.body.phone != null ? normalizePhone(req.body.phone) : (user.phone || '');

        if (!usernameRaw) {
            return res.status(400).json({
                success: false,
                msg: "Username is required."
            });
        }

        if (!isValidUsername(usernameRaw)) {
            return res.status(400).json({
                success: false,
                msg: "Username must be 3–24 characters: letters, numbers, or underscore."
            });
        }

        if (usernameRaw !== previousUsername) {
            const usernameTaken = await User.findOne({
                username: usernameRaw,
                _id: { $ne: user._id }
            });
            if (usernameTaken) {
                return res.status(400).json({
                    success: false,
                    msg: "Username is already taken."
                });
            }
        }

        if (displayName && displayName.length > 60) {
            return res.status(400).json({
                success: false,
                msg: "Display name must be 60 characters or fewer."
            });
        }

        if (bio && bio.length > 280) {
            return res.status(400).json({
                success: false,
                msg: "Bio must be 280 characters or fewer."
            });
        }

        if (college && college.length > 100) {
            return res.status(400).json({
                success: false,
                msg: "College name must be 100 characters or fewer."
            });
        }

        if (branch && branch.length > 80) {
            return res.status(400).json({
                success: false,
                msg: "Branch must be 80 characters or fewer."
            });
        }

        if (semester && semester.length > 40) {
            return res.status(400).json({
                success: false,
                msg: "Semester must be 40 characters or fewer."
            });
        }

        const emailCheck = assertCollegeEmail(emailRaw);
        if (!emailCheck.ok) {
            return res.status(400).json({
                success: false,
                msg: emailCheck.msg
            });
        }

        if (phoneRaw && !isValidPhone(phoneRaw)) {
            return res.status(400).json({
                success: false,
                msg: "Invalid phone number. Use digits with optional leading +."
            });
        }

        {
            const emailTaken = await User.findOne({
                email: emailRaw,
                _id: { $ne: user._id }
            });
            if (emailTaken) {
                return res.status(400).json({
                    success: false,
                    msg: "Email is already used by another account."
                });
            }
        }

        if (phoneRaw) {
            const phoneTaken = await User.findOne({
                phone: phoneRaw,
                _id: { $ne: user._id }
            });
            if (phoneTaken) {
                return res.status(400).json({
                    success: false,
                    msg: "Phone number is already used by another account."
                });
            }
        }

        user.username = usernameRaw;
        user.displayName = displayName || undefined;
        user.bio = bio || undefined;
        user.college = college || undefined;
        user.branch = branch || undefined;
        user.semester = semester || undefined;
        user.email = emailRaw;

        if (phoneRaw) user.phone = phoneRaw;
        else user.phone = undefined;

        await user.save();

        if (usernameRaw !== previousUsername) {
            await Note.updateMany(
                {
                    $or: [
                        { uploaderId: user._id },
                        { uploader: previousUsername }
                    ]
                },
                { $set: { uploader: usernameRaw, uploaderId: user._id } }
            );
        }

        // Ensure cleared unique fields are removed from the document.
        // College email is required — never unset email.
        const unset = {};
        if (!phoneRaw) unset.phone = 1;
        if (!displayName) unset.displayName = 1;
        if (!bio) unset.bio = 1;
        if (!college) unset.college = 1;
        if (!branch) unset.branch = 1;
        if (!semester) unset.semester = 1;
        if (Object.keys(unset).length) {
            await User.updateOne({ _id: user._id }, { $unset: unset });
            const refreshed = await User.findById(user._id);
            return res.status(200).json({
                success: true,
                msg: "Profile updated.",
                user: publicUser(refreshed)
            });
        }

        res.status(200).json({
            success: true,
            msg: "Profile updated.",
            user: publicUser(user)
        });
    } catch (err) {
        console.log(err);
        if (err && err.code === 11000) {
            return res.status(400).json({
                success: false,
                msg: "Username, email, or phone is already used by another account."
            });
        }
        res.status(500).json({
            success: false,
            msg: "Failed to update profile"
        });
    }
});

router.post('/register', authLimiter, async (req,res,next) => {
    const { username , password, email, phone }=req.body;

    try{
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                msg: "Username and password are required."
            });
        }

        if (String(password).length < 6) {
            return res.status(400).json({
                success: false,
                msg: "Password must be at least 6 characters."
            });
        }

        const normalizedEmail = normalizeEmail(email);
        const normalizedPhone = normalizePhone(phone);

        const emailCheck = assertCollegeEmail(normalizedEmail);
        if (!emailCheck.ok) {
            return res.status(400).json({
                success: false,
                msg: emailCheck.msg
            });
        }

        if (normalizedPhone && !isValidPhone(normalizedPhone)) {
            return res.status(400).json({
                success: false,
                msg: "Invalid phone number. Use digits with optional leading +."
            });
        }

        let user_exist=await User.findOne({ username : username});
        if(user_exist){
            return res.status(400).json({
                success : false,
                msg : "Username already exists."
            });
        }

        {
            const emailExists = await User.findOne({ email: normalizedEmail });
            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    msg: "Email already registered."
                });
            }
        }

        if (normalizedPhone) {
            const phoneExists = await User.findOne({ phone: normalizedPhone });
            if (phoneExists) {
                return res.status(400).json({
                    success: false,
                    msg: "Phone number already registered."
                });
            }
        }

        let user=new User();
        user.username=username;
        user.email = normalizedEmail;
        if (normalizedPhone) user.phone = normalizedPhone;
        user.authProvider = 'local';
        user.role = 'student';
        maybeBootstrapAdmin(user);

        const salt = await bcryptjs.genSalt(10);
        user.password=await bcryptjs.hash(password,salt);

        await user.save();

        const token = await signUserToken(user);
        res.status(200).json({
            success : true,
            token : token,
            user : publicUser(user)
        });
    }catch(err){
        console.log(err);
        return res.status(500).json({
            success: false,
            msg: "Registration failed"
        });
    }
    
});

router.post('/login' , authLimiter, async (req,res,next)=> {
    const {username , password}=req.body;

    try{
        let user = await User.findOne({username : username});
        if(!user){
            return res.status(400).json({
                success: false,
                msg: "Invalid username."
            });
        }

        if (await purgeIfDue(user)) {
            return res.status(400).json({
                success: false,
                msg: "This account was deleted after the scheduled grace period."
            });
        }

        const loginEmailCheck = assertCollegeEmail(normalizeEmail(user.email));
        if (!loginEmailCheck.ok) {
            return res.status(403).json({
                success: false,
                msg: collegeEmailDeniedMsg()
            });
        }

        if (!user.password) {
            return res.status(400).json({
                success: false,
                msg: "This account uses Google sign-in. Please continue with Google."
            });
        }

        const isMatch = await bcryptjs.compare(password , user.password);
        if(!isMatch){
            return res.status(400).json({
                success: false,
                msg: "Invalid password"
            });
        }

        if (user.restricted) {
            return res.status(403).json({
                success: false,
                msg: user.restrictionReason || 'Your account is restricted. Contact an admin.',
                code: 'ACCOUNT_RESTRICTED'
            });
        }

        const beforeRole = user.role;
        maybeBootstrapAdmin(user);
        if (user.role !== beforeRole) await user.save();

        const token = await signUserToken(user);
        res.status(200).json({
            success: true,
            token: token,
            user : publicUser(user)
        });
    }catch(err){
        console.log(err);
        res.status(500).json({
            success: false,
            msg: "Failed"
        });
    }
});

router.post('/forgot-password', otpLimiter, async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const phone = normalizePhone(req.body.phone);

        if (!email && !phone) {
            return res.status(400).json({
                success: false,
                msg: "Provide the email or phone number used at registration."
            });
        }

        const query = email ? { email } : { phone };
        if (email) {
            const emailCheck = assertCollegeEmail(email);
            if (!emailCheck.ok) {
                return res.status(403).json({
                    success: false,
                    msg: emailCheck.msg
                });
            }
        }

        const user = await User.findOne(query);

        if (!user) {
            return res.status(404).json({
                success: false,
                msg: email
                    ? "No account found with this email."
                    : "No account found with this phone number."
            });
        }

        const accountEmailCheck = assertCollegeEmail(normalizeEmail(user.email));
        if (!accountEmailCheck.ok) {
            return res.status(403).json({
                success: false,
                msg: collegeEmailDeniedMsg()
            });
        }

        const otp = generateOtp();
        user.otpHash = await hashOtp(otp);
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.otpPurpose = 'reset_password';
        await user.save();

        // Hardcoded OTP is local/dev only — never echo OTP in API responses.
        if (useHardcodedOtp) {
            console.log(`[OTP] Hardcoded mode — use OTP ${HARDCODED_OTP} for ${email || phone}`);
            return res.status(200).json({
                success: true,
                msg: 'Account verified. Check the server console for the development OTP.',
                channel: 'hardcoded'
            });
        }

        if (email) {
            await sendEmailOtp(email, otp);
        } else {
            await sendSmsOtp(phone, otp);
        }

        res.status(200).json({
            success: true,
            msg: email
                ? "OTP sent to your registered email."
                : "OTP sent to your registered phone number.",
            channel: email ? 'email' : 'sms'
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            msg: "Failed to send OTP"
        });
    }
});

router.post('/reset-password', otpLimiter, async (req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const phone = normalizePhone(req.body.phone);
        const { otp, newPassword } = req.body;

        if ((!email && !phone) || !otp || !newPassword) {
            return res.status(400).json({
                success: false,
                msg: "Email or phone, OTP, and new password are required."
            });
        }

        if (String(newPassword).length < 6) {
            return res.status(400).json({
                success: false,
                msg: "Password must be at least 6 characters."
            });
        }

        const query = email ? { email } : { phone };
        const user = await User.findOne(query);

        if (!user || !user.otpHash || user.otpPurpose !== 'reset_password') {
            return res.status(400).json({
                success: false,
                msg: !user
                    ? (email ? "No account found with this email." : "No account found with this phone number.")
                    : "Invalid or expired OTP. Request a new OTP first."
            });
        }

        const resetEmailCheck = assertCollegeEmail(normalizeEmail(user.email));
        if (!resetEmailCheck.ok) {
            return res.status(403).json({
                success: false,
                msg: collegeEmailDeniedMsg()
            });
        }

        if (!user.otpExpires || user.otpExpires.getTime() < Date.now()) {
            return res.status(400).json({
                success: false,
                msg: "OTP has expired. Request a new one."
            });
        }

        const ok = await verifyOtp(otp, user.otpHash);
        if (!ok) {
            return res.status(400).json({
                success: false,
                msg: "Invalid or expired OTP."
            });
        }

        const salt = await bcryptjs.genSalt(10);
        user.password = await bcryptjs.hash(newPassword, salt);
        user.otpHash = undefined;
        user.otpExpires = undefined;
        user.otpPurpose = undefined;
        await user.save();

        res.status(200).json({
            success: true,
            msg: "Password updated. You can log in now."
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            msg: "Failed to reset password"
        });
    }
});

router.post('/auth/google', authLimiter, async (req, res) => {
    try {
        const { credential } = req.body;

        if (!process.env.GOOGLE_CLIENT_ID || !googleClient) {
            return res.status(503).json({
                success: false,
                msg: "Google sign-in is not configured on the server."
            });
        }

        if (!credential) {
            return res.status(400).json({
                success: false,
                msg: "Missing Google credential."
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const googleId = payload.sub;
        const email = normalizeEmail(payload.email);
        const displayName = payload.name || payload.given_name || (email ? email.split('@')[0] : `user_${googleId.slice(0, 8)}`);
        const picture = payload.picture || '';
        const name = displayName;

        const googleEmailCheck = assertCollegeEmail(email);
        if (!googleEmailCheck.ok) {
            return res.status(403).json({
                success: false,
                msg: googleEmailCheck.msg
            });
        }

        let user = await User.findOne({
            $or: [
                { googleId },
                ...(email ? [{ email }] : [])
            ]
        });

        if (user && await purgeIfDue(user)) {
            user = null;
        }

        if (!user) {
            let username = name.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || `user_${googleId.slice(0, 8)}`;
            const base = username;
            let i = 1;
            while (await User.findOne({ username })) {
                username = `${base}${i++}`.slice(0, 24);
            }

            user = new User({
                username,
                email: email || undefined,
                googleId,
                authProvider: 'google',
                displayName,
                picture: picture || undefined,
                role: 'student'
            });
            maybeBootstrapAdmin(user);
            await user.save();
        } else {
            if (!user.googleId) user.googleId = googleId;
            if (email) user.email = email;
            if (displayName) user.displayName = displayName;
            if (picture) user.picture = picture;
            if (!user.authProvider) user.authProvider = 'google';

            if (user.restricted) {
                return res.status(403).json({
                    success: false,
                    msg: user.restrictionReason || 'Your account is restricted. Contact an admin.',
                    code: 'ACCOUNT_RESTRICTED'
                });
            }

            maybeBootstrapAdmin(user);
            await user.save();
        }

        const token = await signUserToken(user);
        res.status(200).json({
            success: true,
            token,
            user: publicUser(user)
        });
    } catch (err) {
        console.log(err);
        res.status(401).json({
            success: false,
            msg: "Google authentication failed."
        });
    }
});

router.post('/account/schedule-deletion', user_jwt, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                msg: "User not found."
            });
        }

        if (await purgeIfDue(user)) {
            return res.status(401).json({
                success: false,
                msg: "This account was deleted after the scheduled grace period.",
                accountDeleted: true
            });
        }

        const { password, credential, confirmUsername } = req.body;

        if (!confirmUsername || confirmUsername !== user.username) {
            return res.status(400).json({
                success: false,
                msg: "Type your username to confirm account deletion."
            });
        }

        let verified = false;

        if (user.password && password) {
            verified = await bcryptjs.compare(password, user.password);
            if (!verified) {
                return res.status(400).json({
                    success: false,
                    msg: "Incorrect password."
                });
            }
        } else if (credential && googleClient && process.env.GOOGLE_CLIENT_ID) {
            try {
                const ticket = await googleClient.verifyIdToken({
                    idToken: credential,
                    audience: process.env.GOOGLE_CLIENT_ID
                });
                const payload = ticket.getPayload();
                const googleId = payload.sub;
                const email = normalizeEmail(payload.email);
                verified = Boolean(
                    (user.googleId && user.googleId === googleId) ||
                    (user.email && email && user.email === email)
                );
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    msg: "Google verification failed."
                });
            }
            if (!verified) {
                return res.status(400).json({
                    success: false,
                    msg: "Google account does not match this profile."
                });
            }
        } else if (user.password) {
            return res.status(400).json({
                success: false,
                msg: "Password is required to delete this account."
            });
        } else {
            return res.status(400).json({
                success: false,
                msg: "Confirm with Google sign-in to delete this account."
            });
        }

        user.deletionScheduledAt = scheduleDeletionDate();
        await user.save();

        res.status(200).json({
            success: true,
            msg: "Account scheduled for deletion in 30 days. You can cancel anytime before then.",
            user: publicUser(user)
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            msg: "Failed to schedule account deletion"
        });
    }
});

router.post('/account/cancel-deletion', user_jwt, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                msg: "User not found."
            });
        }

        if (await purgeIfDue(user)) {
            return res.status(401).json({
                success: false,
                msg: "This account was deleted after the scheduled grace period.",
                accountDeleted: true
            });
        }

        if (!user.deletionScheduledAt) {
            return res.status(400).json({
                success: false,
                msg: "No deletion is scheduled for this account."
            });
        }

        user.deletionScheduledAt = null;
        await user.save();

        res.status(200).json({
            success: true,
            msg: "Account deletion cancelled.",
            user: publicUser(user)
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            success: false,
            msg: "Failed to cancel account deletion"
        });
    }
});

//IPFS
async function attachViewerContext(req) {
    if (!req.user?.id) {
        return { user: null, userId: null, username: null, favoriteCids: new Set(), favoriteNoteIds: new Set() };
    }
    const user = await User.findById(req.user.id);
    if (!user) {
        return { user: null, userId: null, username: null, favoriteCids: new Set(), favoriteNoteIds: new Set() };
    }
    const sets = await loadFavoriteSets(user);
    return {
        user,
        userId: String(user._id),
        username: user.username,
        ...sets
    };
}

function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

function truthyFlag(value) {
    return value === true || value === 'true' || value === '1' || value === 'yes';
}

router.get('/meta/resource-types', (req, res) => {
    res.status(200).json({
        success: true,
        resourceTypes: RESOURCE_TYPES
    });
});

router.post('/ifps/upload', user_jwt, uploadLimiter, upload.single('File_Note'), async (req, res) => {
    try {
        const owner = await User.findById(req.user.id);
        if (!owner) {
            return res.status(401).json({ success: false, msg: 'Auth. denied' });
        }
        if (owner.restricted) {
            return res.status(403).json({
                success: false,
                msg: owner.restrictionReason || 'Your account is restricted.',
                code: 'ACCOUNT_RESTRICTED'
            });
        }
        if (await purgeIfDue(owner)) {
            return res.status(401).json({
                success: false,
                msg: 'This account was deleted after the scheduled grace period.',
                accountDeleted: true
            });
        }

        const title = req.body.title;
        const subject = req.body.subject;
        const branch = req.body.branch;
        const sem = req.body.sem;
        const description = req.body.description
            ? String(req.body.description).trim().slice(0, 500)
            : '';
        const resourceType = normalizeResourceType(req.body.resourceType);
        const tags = parseTags(req.body.tags);
        const college = req.body.college
            ? String(req.body.college).trim().slice(0, 100)
            : (owner.college || '').trim().slice(0, 100);
        const university = req.body.university
            ? String(req.body.university).trim().slice(0, 100)
            : '';
        const examYear = req.body.examYear ? String(req.body.examYear).trim().slice(0, 16) : '';
        const examType = req.body.examType ? String(req.body.examType).trim().slice(0, 60) : '';
        const changelog = req.body.changelog ? String(req.body.changelog).trim().slice(0, 500) : '';
        const forceDuplicate = truthyFlag(req.body.forceDuplicate);
        const versionOfRaw = req.body.versionOf || req.body.parentNoteId || '';

        if (!title || !subject || !branch || !sem) {
            return res.status(400).json({
                success: false,
                msg: 'Title, subject, branch, and semester are required.'
            });
        }
        if (!req.file) {
            return res.status(400).json({
                success: false,
                msg: 'Choose File.'
            });
        }

        let parentNote = null;
        let rootNoteId = null;
        let nextVersion = 1;
        if (versionOfRaw) {
            parentNote = mongoose.isValidObjectId(versionOfRaw)
                ? await Note.findById(versionOfRaw)
                : await Note.findOne({ cid: String(versionOfRaw) });
            if (!parentNote) {
                return res.status(404).json({ success: false, msg: 'Parent note for versioning not found.' });
            }
            if (!isNoteOwner(parentNote, owner._id, owner.username)) {
                return res.status(403).json({
                    success: false,
                    msg: 'Only the uploader can publish a new version of this note.'
                });
            }
            rootNoteId = parentNote.rootNoteId || parentNote._id;
            const latest = await Note.findOne({
                $or: [{ _id: rootNoteId }, { rootNoteId }]
            }).sort({ version: -1 });
            nextVersion = (latest?.version || parentNote.version || 1) + 1;
        }

        const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
        const existingByHash = await Note.findOne({ fileHash }).sort({ uploadedAt: 1 });

        if (existingByHash && !forceDuplicate) {
            return res.status(409).json({
                success: false,
                duplicate: true,
                msg: 'This exact file was already uploaded. Open the existing note, or confirm to publish again without re-pinning.',
                existing: serializeNote(existingByHash, {
                    userId: String(owner._id),
                    username: owner.username
                }),
                fileHash
            });
        }

        let cid;
        let reusedCid = false;
        if (existingByHash && forceDuplicate) {
            cid = existingByHash.cid;
            reusedCid = true;
        } else {
            const data = new FormData();
            data.append('file', req.file.buffer, req.file.originalname);
            const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', data, {
                maxBodyLength: Infinity,
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                    Authorization: `Bearer ${process.env.PINATA}`
                }
            });
            cid = response.data.IpfsHash;
        }

        const note = new Note({
            title,
            subject,
            branch,
            sem,
            description,
            resourceType,
            tags,
            college,
            university,
            examYear,
            examType,
            fileHash,
            uploader: owner.username,
            uploaderId: owner._id,
            cid,
            likeCount: 0,
            likes: [],
            viewCount: 0,
            downloadCount: 0,
            favoriteCount: 0,
            shareCount: 0,
            version: nextVersion,
            isLatest: true,
            parentVersionId: parentNote ? parentNote._id : null,
            rootNoteId: rootNoteId || null,
            changelog: parentNote ? (changelog || `Version ${nextVersion}`) : ''
        });
        await note.save();

        if (!note.rootNoteId) {
            note.rootNoteId = note._id;
            await note.save();
        } else {
            await Note.updateMany(
                {
                    _id: { $ne: note._id },
                    $or: [{ _id: note.rootNoteId }, { rootNoteId: note.rootNoteId }]
                },
                { $set: { isLatest: false } }
            );
        }

        res.status(200).json({
            success: true,
            msg: reusedCid
                ? 'Notes Uploaded (reused existing IPFS pin for identical file).'
                : (parentNote ? `Version ${nextVersion} uploaded.` : 'Notes Uploaded.'),
            cid,
            reusedCid,
            fileHash,
            url: ipfsUrl(cid),
            note: serializeNote(note, { userId: String(owner._id), username: owner.username })
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            msg: 'Upload failed.'
        });
    }
});

//GetOne
router.get('/ifps/get/:id', optionalJwt, async (req, res) => {
    try {
        const { id } = req.params;
        const note = await Note.findOneAndUpdate(
            { cid: id },
            { $inc: { viewCount: 1 } },
            { new: true }
        );
        if (!note) {
            return res.status(400).json({
                success: false,
                msg: "Note doesn't exist"
            });
        }

        const ctx = await attachViewerContext(req);
        const serialized = serializeNote(note, ctx);
        serialized.fileUrl = ipfsUrl(note.cid);

        return res.status(200).json({
            success: true,
            url: ipfsUrl(note.cid),
            previewUrl: `/api/denote/ifps/preview/${note.cid}`,
            note: serialized
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            msg: 'Failed'
        });
    }
});

// Stream note file through our API so the browser can preview it in an iframe
router.get('/ifps/preview/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const note = await Note.findOne({ cid: id });
        if (!note) {
            return res.status(404).json({
                success: false,
                msg: "Note doesn't exist"
            });
        }

        // Count preview/open as a download signal (write-light single $inc)
        Note.updateOne({ _id: note._id }, { $inc: { downloadCount: 1 } }).catch(() => {});

        const { response: upstream, url: sourceUrl } = await fetchIpfsContent(note.cid, {
            responseType: 'stream',
            timeout: 45000
        });

        const contentType = upstream.headers['content-type'] || 'application/pdf';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-IPFS-Source', sourceUrl);
        res.removeHeader('X-Frame-Options');

        upstream.data.on('error', (err) => {
            console.log('IPFS stream error:', err.message);
            if (!res.headersSent) {
                res.status(502).json({ success: false, msg: 'Failed to stream file from IPFS' });
            } else {
                res.end();
            }
        });

        upstream.data.pipe(res);
    } catch (err) {
        console.log('IPFS preview failed:', err.message, err.details || '');
        if (!res.headersSent) {
            res.status(502).json({
                success: false,
                msg: 'Failed to load preview from IPFS'
            });
        }
    }
});

// Browse / search with pagination
router.get('/ifps/get', optionalJwt, async (req, res) => {
    try {
        const ctx = await attachViewerContext(req);
        const { page, limit, skip } = parsePagination(req.query);
        const filter = buildNotesQuery({
            ...req.query,
            userId: ctx.userId,
            username: ctx.username
        });

        const [total, notes] = await Promise.all([
            Note.countDocuments(filter),
            Note.find(filter)
                .sort(sortSpec(req.query.sort))
                .skip(skip)
                .limit(limit)
        ]);

        const serialized = notes.map((n) => {
            const item = serializeNote(n, ctx);
            item.fileUrl = ipfsUrl(n.cid);
            return item;
        });

        res.status(200).json({
            success: true,
            notes: serialized,
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit))
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            msg: 'Failed'
        });
    }
});

// My uploads
router.get('/ifps/mine', user_jwt, async (req, res) => {
    try {
        const ctx = await attachViewerContext(req);
        if (!ctx.user) {
            return res.status(401).json({ success: false, msg: 'Auth. denied' });
        }

        const { page, limit, skip } = parsePagination(req.query);
        const filter = buildNotesQuery({
            mine: '1',
            userId: ctx.userId,
            username: ctx.username,
            q: req.query.q,
            branch: req.query.branch,
            sem: req.query.sem,
            subject: req.query.subject,
            resourceType: req.query.resourceType,
            tag: req.query.tag,
            tags: req.query.tags
        });

        const [total, notes] = await Promise.all([
            Note.countDocuments(filter),
            Note.find(filter).sort(sortSpec(req.query.sort)).skip(skip).limit(limit)
        ]);

        res.status(200).json({
            success: true,
            notes: notes.map((n) => {
                const item = serializeNote(n, ctx);
                item.fileUrl = ipfsUrl(n.cid);
                return item;
            }),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit))
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load your uploads' });
    }
});

// Favorites list
router.get('/ifps/favorites', user_jwt, async (req, res) => {
    try {
        const ctx = await attachViewerContext(req);
        if (!ctx.user) {
            return res.status(401).json({ success: false, msg: 'Auth. denied' });
        }

        const noteIds = (ctx.user.fav || []).map((f) => f.noteId).filter(Boolean);
        const cids = (ctx.user.fav || []).map((f) => f.cid).filter(Boolean);

        const filter = noteIds.length || cids.length
            ? {
                $or: [
                    ...(noteIds.length ? [{ _id: { $in: noteIds } }] : []),
                    ...(cids.length ? [{ cid: { $in: cids } }] : [])
                ]
            }
            : { _id: { $in: [] } };

        const { page, limit, skip } = parsePagination(req.query);
        const [total, notes] = await Promise.all([
            Note.countDocuments(filter),
            Note.find(filter).sort({ uploadedAt: -1 }).skip(skip).limit(limit)
        ]);

        res.status(200).json({
            success: true,
            notes: notes.map((n) => {
                const item = serializeNote(n, ctx);
                item.fileUrl = ipfsUrl(n.cid);
                item.favoritedByMe = true;
                return item;
            }),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit))
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load favorites' });
    }
});

// Version history for a note (by Mongo id or CID)
router.get('/ifps/:id/versions', optionalJwt, async (req, res) => {
    try {
        const raw = req.params.id;
        const note = mongoose.isValidObjectId(raw)
            ? await Note.findById(raw)
            : await Note.findOne({ cid: raw });
        if (!note) {
            return res.status(404).json({ success: false, msg: 'Note not found' });
        }

        const rootId = note.rootNoteId || note._id;
        const versions = await Note.find({
            $or: [{ _id: rootId }, { rootNoteId: rootId }]
        }).sort({ version: 1 });

        const ctx = await attachViewerContext(req);
        res.status(200).json({
            success: true,
            rootNoteId: rootId,
            currentVersion: versions.find((v) => v.isLatest !== false)?.version || note.version || 1,
            versions: versions.map((v) => serializeNote(v, ctx))
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load versions' });
    }
});

// Toggle favorite
router.post('/ifps/:id/favorite', user_jwt, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const note = await Note.findById(req.params.id);
        if (!note) {
            return res.status(404).json({ success: false, msg: 'Note not found' });
        }

        user.fav = Array.isArray(user.fav) ? user.fav : [];
        const existingIdx = user.fav.findIndex(
            (f) =>
                (f.noteId && String(f.noteId) === String(note._id)) ||
                (f.cid && f.cid === note.cid)
        );

        let favorited;
        if (existingIdx >= 0) {
            user.fav.splice(existingIdx, 1);
            favorited = false;
            await Note.updateOne({ _id: note._id }, { $inc: { favoriteCount: -1 } });
            note.favoriteCount = Math.max(0, (note.favoriteCount || 0) - 1);
        } else {
            user.fav.push({ noteId: note._id, cid: note.cid });
            favorited = true;
            await Note.updateOne({ _id: note._id }, { $inc: { favoriteCount: 1 } });
            note.favoriteCount = (note.favoriteCount || 0) + 1;
        }
        if ((note.favoriteCount || 0) < 0) {
            note.favoriteCount = 0;
            await Note.updateOne({ _id: note._id }, { $set: { favoriteCount: 0 } });
        }
        await user.save();

        const ctx = {
            userId: String(user._id),
            username: user.username,
            ...(await loadFavoriteSets(user))
        };

        res.status(200).json({
            success: true,
            favorited,
            note: serializeNote(note, ctx),
            favoriteCount: user.fav.length
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to update favorite' });
    }
});

// Record a share / copy-link (idempotent enough: cheap $inc, no payload store)
router.post('/ifps/:id/share', user_jwt, async (req, res) => {
    try {
        const note = await Note.findByIdAndUpdate(
            req.params.id,
            { $inc: { shareCount: 1 } },
            { new: true }
        );
        if (!note) {
            return res.status(404).json({ success: false, msg: 'Note not found' });
        }
        const ctx = await attachViewerContext(req);
        res.status(200).json({
            success: true,
            shareCount: note.shareCount || 0,
            note: serializeNote(note, ctx)
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to record share' });
    }
});

// Creator analytics — aggregates existing counters (free-tier, no event stream)
router.get('/me/analytics', user_jwt, async (req, res) => {
    try {
        const me = await User.findById(req.user.id);
        if (!me) return res.status(401).json({ success: false, msg: 'Auth. denied' });
        if (await purgeIfDue(me)) {
            return res.status(401).json({ success: false, msg: 'Account deleted', accountDeleted: true });
        }

        const { aggregateNoteEngagement, serializeCreatorNoteRow } = require('../utils/analytics');
        const match = { uploaderId: me._id, isLatest: { $ne: false } };
        const totals = await aggregateNoteEngagement(Note, match);

        const notes = await Note.find(match)
            .sort({ viewCount: -1, likeCount: -1, uploadedAt: -1 })
            .limit(40)
            .select('title cid subject resourceType uploadedAt isVerified viewCount downloadCount likeCount favoriteCount shareCount');

        const topByViews = [...notes]
            .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
            .slice(0, 5)
            .map(serializeCreatorNoteRow);
        const topByLikes = [...notes]
            .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
            .slice(0, 5)
            .map(serializeCreatorNoteRow);

        res.status(200).json({
            success: true,
            analytics: {
                totals,
                notes: notes.map(serializeCreatorNoteRow),
                topByViews,
                topByLikes
            }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to load analytics' });
    }
});

// Toggle like / upvote
router.post('/ifps/:id/like', user_jwt, async (req, res) => {
    try {
        const userId = req.user.id;
        const note = await Note.findById(req.params.id);
        if (!note) {
            return res.status(404).json({ success: false, msg: 'Note not found' });
        }

        note.likes = Array.isArray(note.likes) ? note.likes : [];
        const idx = note.likes.findIndex((id) => String(id) === String(userId));
        let liked;
        if (idx >= 0) {
            note.likes.splice(idx, 1);
            liked = false;
        } else {
            note.likes.push(userId);
            liked = true;
        }
        note.likeCount = note.likes.length;
        await note.save();

        if (liked && note.uploaderId) {
            const actor = await User.findById(userId).select('username');
            await createNotification({
                userId: note.uploaderId,
                type: 'like',
                actorId: userId,
                actorUsername: actor?.username || '',
                noteId: note._id,
                noteCid: note.cid,
                message: `@${actor?.username || 'someone'} upvoted “${note.title}”`
            });
        }

        const ctx = await attachViewerContext(req);
        res.status(200).json({
            success: true,
            liked,
            likeCount: note.likeCount,
            note: serializeNote(note, ctx)
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, msg: 'Failed to update like' });
    }
});

router.put('/ifps/update/:id', user_jwt, uploadLimiter, upload.single('File_Note'), async (req, res) => {
    try {
        const owner = await User.findById(req.user.id);
        if (!owner) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const note = await Note.findById(req.params.id);
        if (!note) {
            return res.status(404).json({
                success: false,
                msg: 'no note found to update'
            });
        }

        if (!isNoteOwner(note, owner._id, owner.username)) {
            return res.status(403).json({
                success: false,
                msg: 'Only the uploader can edit this note.'
            });
        }

        // Backfill ownership on legacy notes
        if (!note.uploaderId) note.uploaderId = owner._id;

        if (req.file) {
            const data = new FormData();
            data.append('file', req.file.buffer, req.file.originalname);
            const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', data, {
                maxBodyLength: Infinity,
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                    Authorization: `Bearer ${process.env.PINATA}`
                }
            });

            try {
                await axios.delete(`https://api.pinata.cloud/pinning/unpin/${note.cid}`, {
                    headers: { Authorization: `Bearer ${process.env.PINATA}` }
                });
            } catch (unpinErr) {
                console.log('Unpin previous CID failed:', unpinErr.message);
            }

            note.cid = response.data.IpfsHash;
        }

        note.title = req.body.title || note.title;
        note.subject = req.body.subject || note.subject;
        note.branch = req.body.branch || note.branch;
        note.sem = req.body.sem || note.sem;
        if (typeof req.body.description === 'string') {
            note.description = req.body.description.trim().slice(0, 500);
        }
        if (req.body.resourceType) {
            note.resourceType = normalizeResourceType(req.body.resourceType);
        }
        if (typeof req.body.tags === 'string' || Array.isArray(req.body.tags)) {
            note.tags = parseTags(req.body.tags);
        }
        if (typeof req.body.college === 'string') {
            note.college = req.body.college.trim().slice(0, 100);
        }
        if (typeof req.body.university === 'string') {
            note.university = req.body.university.trim().slice(0, 100);
        }
        if (typeof req.body.examYear === 'string') {
            note.examYear = req.body.examYear.trim().slice(0, 16);
        }
        if (typeof req.body.examType === 'string') {
            note.examType = req.body.examType.trim().slice(0, 60);
        }
        note.uploader = owner.username;

        await note.save();

        const ctx = await attachViewerContext(req);
        res.status(200).json({
            success: true,
            msg: 'Updated',
            note: serializeNote(note, ctx)
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: 'Failed.'
        });
    }
});

router.delete('/ifps/delete', user_jwt, async (req, res) => {
    try {
        const owner = await User.findById(req.user.id);
        if (!owner) return res.status(401).json({ success: false, msg: 'Auth. denied' });

        const { id } = req.body;
        if (!Array.isArray(id) || id.length === 0) {
            return res.status(400).json({
                success: false,
                msg: "Invalid request. 'id' must be a non-empty array."
            });
        }

        const deleteErrors = [];
        for (const i of id) {
            const note = await Note.findById(i);
            if (!note) {
                deleteErrors.push({ id: i, msg: "Note doesn't exist." });
                continue;
            }
            if (!isNoteOwner(note, owner._id, owner.username)) {
                deleteErrors.push({ id: i, msg: 'Only the uploader can delete this note.' });
                continue;
            }

            try {
                if (process.env.PINATA && note.cid) {
                    await axios.delete(`https://api.pinata.cloud/pinning/unpin/${note.cid}`, {
                        headers: { Authorization: `Bearer ${process.env.PINATA}` }
                    });
                }
            } catch (error) {
                console.log(`Unpin failed for ${note.cid}:`, error.message);
            }

            await Note.findByIdAndDelete(i);
            await User.updateMany({}, { $pull: { fav: { noteId: note._id } } });
            await User.updateMany({}, { $pull: { fav: { cid: note.cid } } });
        }

        if (deleteErrors.length > 0) {
            return res.status(403).json({
                success: false,
                msg: 'Some notes could not be deleted.',
                errors: deleteErrors
            });
        }

        res.status(200).json({
            success: true,
            msg: 'Notes deleted.'
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: 'Failed.'
        });
    }
});

module.exports = router;
