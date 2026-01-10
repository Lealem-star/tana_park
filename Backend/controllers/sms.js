const { Router } = require("express");
const { isLoggedIn } = require("./middleware");
const twilio = require('twilio');
const Joi = require('joi');

const smsRouter = Router();

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Send SMS endpoint
smsRouter.post("/send", isLoggedIn, async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        // Input validation
        const schema = Joi.object({
            phoneNumber: Joi.string().required().trim(),
            message: Joi.string().required().trim().min(1),
        });

        const { error } = schema.validate({ phoneNumber, message });
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Format phone number (ensure it starts with +)
        let formattedPhone = phoneNumber.trim();
        if (!formattedPhone.startsWith('+')) {
            // If it starts with 251, add +
            if (formattedPhone.startsWith('251')) {
                formattedPhone = '+' + formattedPhone;
            } else if (formattedPhone.startsWith('0')) {
                // Convert 0XXXXXXXX to +251XXXXXXXX
                formattedPhone = '+251' + formattedPhone.substring(1);
            } else {
                // Assume it's already in international format without +
                formattedPhone = '+' + formattedPhone;
            }
        }

        // Send SMS using Twilio
        await twilioClient.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: formattedPhone
        });

        res.json({
            success: true,
            message: "SMS sent successfully"
        });
    } catch (error) {
        console.error("SMS sending error:", error);
        res.status(400).json({ 
            error: error.message || "Failed to send SMS",
            details: error.response?.data || error
        });
    }
});

module.exports = smsRouter;

