const mongoose = require('mongoose');

const pendingPackagePaymentSchema = new mongoose.Schema({
    txRef: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    carData: {
        plateCode: { type: String, required: true },
        region: { type: String, required: true },
        licensePlateNumber: { type: String, required: true },
        carType: { 
            type: String, 
            enum: ['tripod', 'automobile', 'truck', 'trailer'],
            required: true 
        },
        model: { type: String, default: '' },
        color: { type: String, default: '' },
        phoneNumber: { type: String, required: true },
        notes: { type: String, default: '' },
        priceLevel: { type: String, default: null }
    },
    amount: {
        type: Number,
        required: true
    },
    serviceType: {
        type: String,
        enum: ['package'],
        default: 'package'
    },
    packageDuration: {
        type: String,
        enum: ['weekly', 'monthly', 'yearly'],
        required: true
    },
    customerPhone: {
        type: String,
        required: true
    },
    valetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    parkZoneCode: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// TTL index to auto-cleanup expired pending payments (24 hours)
pendingPackagePaymentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('PendingPackagePayment', pendingPackagePaymentSchema);

