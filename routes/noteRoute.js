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

const memory=multer.memoryStorage();
const upload=multer({memory: memory});

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
    const { username , password }=req.body;

    try{
        let user_exist=await User.findOne({ username : username});
        if(user_exist){
            return res.json({
                success : false,
                msg : "Username already exists."
            });
        }
        let user=new User();
        user.username=username;
        user.password=password;

        const salt = await bcryptjs.genSalt(10);
        user.password=await bcryptjs.hash(password,salt);

        await user.save();

        const payload={
            user:{
                id : user.id
            }
        };

        jwt.sign(payload, process.env.jwtSecret ,{ expiresIn : 3600},
            (err,token)=>{
                if(err) throw err;
                res.status(200).json({
                    success : true,
                    token : token,
                    user : user
                });
            }
        );
    }catch(err){
        console.log(err);
    }
    
});

router.post('/login' , async (req,res,next)=> {
    const {username , password}=req.body;

    try{
        let user = await User.findOne({username : username});
        if(!user){
            return res.status(400).json({
                sucess: false,
                msg: "Invalid username."
            });
        }

        const isMatch = await bcryptjs.compare(password , user.password);
        if(!isMatch){
            return res.status(400).json({
                success: false,
                msg: "Invalid password"
            });
        }

        const payload={
            user : {
                id: user.id
            }
        };

        jwt.sign(payload,process.env.jwtSecret,{expiresIn:3600},
            (err,token)=>{
                if(err) throw err;
                res.status(200).json({
                    success: true,
                    token: token,
                    user : user
                });
            }
        );
    }catch(err){
        console.log(err);
        res.status(500).json({
            success: false,
            msg: "Failed"
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