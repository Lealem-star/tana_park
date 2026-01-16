const { Router } = require('express');
const ChatMessage = require('../models/chatMessageSchema');
const User = require('../models/userSchema');
const { isLoggedIn } = require('./middleware');

const chatRouter = Router();

// Get recent chat messages (for initial load / history)
chatRouter.get('/messages', isLoggedIn, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const before = req.query.before ? new Date(req.query.before) : null;

        const query = {};
        if (before && !isNaN(before.getTime())) {
            query.createdAt = { $lt: before };
        }

        const messages = await ChatMessage.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('sender', 'name parkZoneCode type')
            .populate('replyTo', 'text senderName senderType senderParkZoneCode createdAt');

        // Return messages in chronological order (oldest first)
        res.json(messages.reverse());
    } catch (error) {
        console.error('Error fetching chat messages:', error);
        res.status(400).json({ error: error.message });
    }
});

// Send a new chat message
chatRouter.post('/messages', isLoggedIn, async (req, res) => {
    try {
        const { text, replyTo } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Message text is required' });
        }

        const sender = await User.findOne({ phoneNumber: req.user?.phoneNumber });
        if (!sender) {
            return res.status(400).json({ error: 'Sender not found' });
        }

        // Validate replyTo if provided
        if (replyTo) {
            const replyToMessage = await ChatMessage.findById(replyTo);
            if (!replyToMessage) {
                return res.status(400).json({ error: 'Reply to message not found' });
            }
        }

        const message = await ChatMessage.create({
            text: text.trim(),
            sender: sender._id,
            senderName: sender.name,
            senderType: sender.type,
            senderParkZoneCode: sender.parkZoneCode || '',
            replyTo: replyTo || null
        });

        const populated = await ChatMessage.findById(message._id)
            .populate('sender', 'name parkZoneCode type')
            .populate('replyTo', 'text senderName senderType senderParkZoneCode createdAt');

        // Emit via Socket.IO to all connected clients
        const io = req.app.get('io');
        if (io) {
            io.emit('chat:newMessage', populated);
        }

        res.status(201).json(populated);
    } catch (error) {
        console.error('Error sending chat message:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = chatRouter;


