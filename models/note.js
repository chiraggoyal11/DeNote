const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    title : {
        type :String,
        required : true
    },
    subject : {
        type : String,
        required : true
    },
    branch : { 
        type : String,
        required : true
    },
    sem : {
        type : String,
        required : true
    },
    uploader : {
        type : String,
        default : "Anon."
    },
    cid : {
        type : String,
        required : true
    },
    fileUrl : {
        type : String
    },
    uploadedAt : {
        type : Date,
        default : Date.now
    },
    rating : {
        type : String
    }
});

module.exports=mongoose.model('Note',noteSchema);