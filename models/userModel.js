const mongoose = require('mongoose')

const userSchema  = mongoose.Schema({
    firstName : String,
    lastName : String,
    phone : {type: String , required : true } ,
    password : String,
    profilePic : String,

})


const userModel = mongoose.model('user', userSchema)
module.exports = userModel;
