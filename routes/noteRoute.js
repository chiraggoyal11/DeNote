const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Note = require('../models/note');
const bcryptjs= require('bcryptjs');
const user_jwt=require('../middleware/jwt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const axios=require('axios');
const FormData=require('form-data');
const fs=require('fs');
const { OAuth2Client } = require('google-auth-library');
const { generateOtp, hashOtp, verifyOtp, useHardcodedOtp, HARDCODED_OTP } = require('../utils/otp');
const { sendEmailOtp, sendSmsOtp } = require('../utils/notify');
const { signUserToken, publicUser } = require('../utils/authTokens');

const memory=multer.memoryStorage();
const upload=multer({memory: memory});
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

function isValidPhone(phone) {
    return /^\+?[0-9]{8,15}$/.test(phone);
}

router.get('/', user_jwt, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.status(200).json({
            success: true,
            user: user
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "error hogya bhai"
        });
        next();
    }

});

router.post('/register', async (req,res,next) => {
    const { username , password, email, phone }=req.body;

    try{
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                msg: "Username and password are required."
            });
        }

        const normalizedEmail = normalizeEmail(email);
        const normalizedPhone = normalizePhone(phone);

        if (!normalizedEmail && !normalizedPhone) {
            return res.status(400).json({
                success: false,
                msg: "Provide an email or phone number for verification and password recovery."
            });
        }

        if (normalizedEmail && !isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                msg: "Invalid email address."
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

        if (normalizedEmail) {
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
        if (normalizedEmail) user.email = normalizedEmail;
        if (normalizedPhone) user.phone = normalizedPhone;
        user.authProvider = 'local';

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

router.post('/login' , async (req,res,next)=> {
    const {username , password}=req.body;

    try{
        let user = await User.findOne({username : username});
        if(!user){
            return res.status(400).json({
                success: false,
                msg: "Invalid username."
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

router.post('/forgot-password', async (req, res) => {
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
        const user = await User.findOne(query);

        if (!user) {
            return res.status(404).json({
                success: false,
                msg: email
                    ? "No account found with this email."
                    : "No account found with this phone number."
            });
        }

        const otp = generateOtp();
        user.otpHash = await hashOtp(otp);
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        user.otpPurpose = 'reset_password';
        await user.save();

        // Hardcoded OTP mode: skip SendGrid/Twilio until they are configured later.
        if (useHardcodedOtp) {
            console.log(`[OTP] Hardcoded mode — use OTP ${HARDCODED_OTP} for ${email || phone}`);
            return res.status(200).json({
                success: true,
                msg: `Account verified. Use OTP ${HARDCODED_OTP} to reset your password.`,
                channel: 'hardcoded',
                otp: HARDCODED_OTP
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

router.post('/reset-password', async (req, res) => {
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

router.post('/auth/google', async (req, res) => {
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
        const name = payload.name || (email ? email.split('@')[0] : `user_${googleId.slice(0, 8)}`);

        let user = await User.findOne({
            $or: [
                { googleId },
                ...(email ? [{ email }] : [])
            ]
        });

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
                authProvider: 'google'
            });
            await user.save();
        } else {
            if (!user.googleId) user.googleId = googleId;
            if (email && !user.email) user.email = email;
            if (!user.authProvider) user.authProvider = 'google';
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

//IPFS
router.post('/ifps/upload', upload.single('File_Note') , async(req,res,next)=>{
    try {
        const title=req.body.title;
        const subject=req.body.subject;
        const branch=req.body.branch;
        const sem=req.body.sem;
        const uploader=req.body.uploader;
        const rating=req.body.rating;
        let note=new Note();
        note.title=title;
        note.subject=subject;
        note.branch=branch;
        note.sem=sem;
        note.uploader=uploader;
        note.rating=rating;
        if(req.file){
            
            const data=new FormData();
            data.append('file',req.file.buffer, req.file.originalname);
            const response= await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS',data,
                {
                    maxBodyLength : 'Infinity',
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                        'Authorization': `Bearer ${process.env.PINATA}`
                    }
                }
            );
            
            note.cid=response.data.IpfsHash;
            await note.save();
            res.status(200).json({
                success: true,
                msg : "Notes Uploaded.",
                cid: response.data.IpfsHash,
                url: `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`
            });
        }  else {
            res.status(401).json({
                success: false,
                msg: "Choose File."
            });
        }  

    }catch(error) {
        console.log(error);
    }
});

//GetOne
router.get('/ifps/get/:id', async(req,res,next)=>{
    try{
        const {id} = req.params;
        const note = await Note.findOne({ cid : id});
        if(note){
            return res.status(200).json({
                success : true,
                url : `https://gateway.pinata.cloud/ipfs/${note.cid}`,
                note : note
            });
        }
        res.status(400).json({
            success : false,
            msg : "Note doesn't exist"
        });
    }catch(err){
        console.log(err);
        res.status(500).json({
            msg : "Failed"
        });
    }
});

//GetQuery
router.get('/ifps/get',async(req,res,next)=>{
    try{
        const {title} = req.query;
        const {branch} = req.query;
        const {sem} = req.query;
        const {subject} = req.query;
        const {rating}=req.query;
        const queryObject={};
        if(title){
            queryObject.title={$regex : title , $options : "i"}
        }
        if(branch){
            queryObject.branch={$regex : branch , $options : "i"}
        }
        if(sem){
            queryObject.sem={$regex : sem , $options : "i"}
        }
        if(subject){
            queryObject.subject={$regex : subject , $options : "i"}
        }
        if(rating){
            queryObject.rating={$regex : rating , $options : "i"}
        }
        const note=await Note.find(queryObject);
        if(note){
            for(const n of note){
                n.fileUrl=`https://gateway.pinata.cloud/ipfs/${n.cid}`
            }  
            res.status(200).json({
                success : true,
                notes : note
            }); 
        }
        
    }catch(err){
        console.log(err);
        res.status(500).json({
            msg: "Failed"
        });
    }
});

router.put('/ifps/update/:id', upload.single('File_Note') ,async(req,res,next) => {
    try {
        const {id}=req.params;
        const note=await Note.findById(id);
        if(!note){
                return res.status(500).json({
                    success:false,
                    msg : "no note found to update"
                });
            }
        if(req.file){
            const data=new FormData();
            data.append('file',req.file.buffer, req.file.originalname);
            const response= await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS',data,
                {
                    maxBodyLength : 'Infinity',
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${data._boundary}`,
                        'Authorization': `Bearer ${process.env.PINATA}`
                    }
                }
            );

            await axios.delete(`https://api.pinata.cloud/pinning/unpin/${note.cid}`, {
                headers: {
                    Authorization: `Bearer ${process.env.PINATA}`
                }
            });

            note.cid = response.data.IpfsHash;
        }
        
        note.title = req.body.title || note.title;
        note.subject = req.body.subject || note.subject;
        note.branch = req.body.branch || note.branch;
        note.sem = req.body.sem || note.sem;
        note.uploader = req.body.uploader || note.uploader;
        note.rating=req.body.rating || note.rating;

        note.save();
        
        res.status(200).json({
            success : true,
            msg : "Updated"
        })
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "Failed."
        });
    }
});

router.delete('/ifps/delete',async(req,res,next)=>{
    try {
        const {id}=req.body;

        if (!Array.isArray(id) || id.length === 0) {
            return res.status(400).json({
                success: false,
                msg: "Invalid request. 'id' must be a non-empty array."
            });
        }

        let deleteErrors = [];
        for(const i of id){
            const note=await Note.findByIdAndDelete(i);
            if(!note){
                deleteErrors.push({ id: i, msg: "Note doesn't exist." });
                continue;
            }
            try {
                await axios.delete(`https://api.pinata.cloud/pinning/unpin/${note.cid}`, {
                    headers: {
                    Authorization: `Bearer ${process.env.PINATA}`
                    }
                });
            } catch (error) {
                deleteErrors.push({ id: i, msg: `Failed to delete note ${note.title}` });
            }
        }
        if (deleteErrors.length > 0) {
            return res.status(500).json({
                success: false,
                msg: "Some Notes failed to delete.",
                errors: deleteErrors
            });
        }
        res.status(200).json({
            success : true,
            msg : "Notes deleted."
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            msg: "Failed."
        });
    }
});

module.exports = router;