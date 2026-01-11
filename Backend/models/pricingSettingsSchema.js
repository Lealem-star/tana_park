const mongoose = require('mongoose')

const pricingSettingsSchema = new mongoose.Schema({
    settings: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
        default: {}
    }
}, {
    timestamps: true
})

// Ensure only one document exists
pricingSettingsSchema.statics.getOrCreate = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({ settings: {} });
    }
    return settings;
}

module.exports = mongoose.model("PricingSettings", pricingSettingsSchema)

