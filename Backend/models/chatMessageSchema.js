const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        trim: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    senderName: {
        type: String,
        required: true
    },
    senderType: {
        type: String,
        enum: ["system_admin", "manager", "admin", "valet"],
        required: true
    },
    senderParkZoneCode: {
        type: String,
        default: ''
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatMessage',
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

chatMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);


