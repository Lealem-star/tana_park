/**
 * VAT Calculation Utility
 * Calculates VAT amount and total with VAT based on base amount and VAT rate
 */

/**
 * Calculate VAT amount and total with VAT
 * @param {Number} baseAmount - The base amount before VAT
 * @param {Number} vatRate - VAT rate as decimal (e.g., 0.15 for 15%)
 * @returns {Object} Object containing baseAmount, vatAmount, totalWithVat, and vatRate
 */
function calculateVAT(baseAmount, vatRate = 0.15) {
    if (!baseAmount || baseAmount < 0) {
        return {
            baseAmount: 0,
            vatAmount: 0,
            totalWithVat: 0,
            vatRate: vatRate
        };
    }

    const vatAmount = Math.round(baseAmount * vatRate * 100) / 100;
    const totalWithVat = Math.round((baseAmount + vatAmount) * 100) / 100;

    return {
        baseAmount: Math.round(baseAmount * 100) / 100,
        vatAmount,
        totalWithVat,
        vatRate
    };
}

/**
 * Reverse calculate VAT from total amount (extract base amount and VAT from total)
 * @param {Number} totalWithVat - The total amount including VAT
 * @param {Number} vatRate - VAT rate as decimal (e.g., 0.15 for 15%)
 * @returns {Object} Object containing baseAmount, vatAmount, totalWithVat, and vatRate
 */
function reverseCalculateVAT(totalWithVat, vatRate = 0.15) {
    if (!totalWithVat || totalWithVat < 0) {
        return {
            baseAmount: 0,
            vatAmount: 0,
            totalWithVat: 0,
            vatRate: vatRate
        };
    }

    // Reverse calculation: baseAmount = totalWithVat / (1 + vatRate)
    const baseAmount = Math.round((totalWithVat / (1 + vatRate)) * 100) / 100;
    const vatAmount = Math.round((totalWithVat - baseAmount) * 100) / 100;

    return {
        baseAmount,
        vatAmount,
        totalWithVat: Math.round(totalWithVat * 100) / 100,
        vatRate
    };
}

/**
 * Get VAT rate from pricing settings
 * @param {Object} pricingSettings - Pricing settings object
 * @returns {Number} VAT rate as decimal (default: 0.15)
 */
async function getVATRate(pricingSettings = null) {
    if (!pricingSettings) {
        const PricingSettings = require('../models/pricingSettingsSchema');
        const settings = await PricingSettings.getOrCreate();
        return settings.settings?.vatRate || 0.15;
    }
    return pricingSettings.vatRate || 0.15;
}

module.exports = {
    calculateVAT,
    reverseCalculateVAT,
    getVATRate
};

