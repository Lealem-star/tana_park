const { Router } = require("express")
const PricingSettings = require("../models/pricingSettingsSchema");
const Joi = require('joi');
const { isLoggedIn } = require("./middleware");

const pricingSettingsRouter = Router();

// Get pricing settings (public endpoint - no auth required for reading)
pricingSettingsRouter.get("/", async (req, res) => {
    try {
        const settings = await PricingSettings.getOrCreate();
        res.json(settings.settings || {});
    } catch (error) {
        console.error("Error fetching pricing settings: ", error);
        res.status(400).json({ error: error.message });
    }
});

// Update pricing settings (requires authentication)
pricingSettingsRouter.put("/", isLoggedIn, async (req, res) => {
    try {
        const User = require("../models/userSchema");
        const currentUser = await User.findOne({ phoneNumber: req.user?.phoneNumber });
        
        // Only system_admin can update pricing settings
        if (!currentUser || currentUser.type !== 'system_admin') {
            return res.status(403).json({ error: "Only system admin can update pricing settings" });
        }

        const { settings } = req.body;

        // Input validation
        const schema = Joi.object({
            settings: Joi.object().pattern(
                Joi.string(),
                Joi.object({
                    pricePerHour: Joi.number().min(0).required()
                })
            ).required()
        });

        const { error } = schema.validate({ settings });
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Get or create settings document
        let pricingSettings = await PricingSettings.getOrCreate();
        
        // Update settings object
        pricingSettings.settings = settings;
        await pricingSettings.save();

        res.json({ message: "Pricing settings updated successfully", settings: pricingSettings.settings });
    } catch (error) {
        console.error("Error updating pricing settings: ", error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = pricingSettingsRouter;

