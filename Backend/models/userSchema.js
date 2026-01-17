const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        unique: true,
        required: true
    },
    parkZoneCode: {
        type: String,
        default: ''
    },
    priceLevel: {
        type: String,
        default: null
    },
    password: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["system_admin", "manager", "admin", "valet"],
        required: true
    },
    cash: {
        type: Boolean,
        required: true,
        default: false
    },
    interac: {
        type: String,
        default: ''
    },
    profilePhoto: {
        type: String,
        default: ''
    }
})

module.exports = mongoose.model("User", userSchema)