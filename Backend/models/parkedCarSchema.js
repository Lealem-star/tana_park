const mongoose = require('mongoose')

const parkedCarSchema = new mongoose.Schema({
    licensePlate: {
        type: String,
        required: true,
        uppercase: true
    },
    make: {
        type: String,
        required: false,
        default: ''
    },
    model: {
        type: String,
        required: true
    },
    color: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['parked', 'checked_out', 'violation'],
        default: 'parked',
        required: true
    },
    parkedAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    checkedOutAt: {
        type: Date
    },
    notes: {
        type: String,
        default: ''
    },
    valet_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    checkedOutBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    paymentMethod: {
        type: String,
        enum: ['manual', 'online'],
        required: false,
        set: function(value) {
            // Convert null to undefined so Mongoose skips enum validation
            return value === null ? undefined : value;
        }
    },
    paymentReference: {
        type: String,
        default: null
    },
    // Last generated online payment txRef for this car (for verification consistency)
    pendingPaymentTxRef: {
        type: String,
        default: null
    },
    plateCode: {
        type: String,
        default: null
    },
    region: {
        type: String,
        default: null
    },
    licensePlateNumber: {
        type: String,
        default: null
    },
    phoneNumber: {
        type: String,
        default: null
    },
    carType: {
        type: String,
        enum: ['tripod', 'automobile', 'truck', 'trailer'],
        default: null
    },
    serviceType: {
        type: String,
        enum: ['hourly', 'package'],
        default: 'hourly'
    },
    // Package subscription linkage (for package services only)
    packageSubscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
        index: true
    },
    packageStartDate: {
        type: Date,
        default: null
    },
    packageEndDate: {
        type: Date,
        default: null
    },
    packageDuration: {
        type: String,
        enum: ['weekly', 'monthly', 'yearly'],
        default: undefined,
        set: function(value) {
            // Convert null to undefined so Mongoose skips enum validation for hourly
            return value === null ? undefined : value;
        }
    },
    totalPaidAmount: {
        type: Number,
        default: 0
    },
    baseAmount: {
        type: Number,
        default: 0
    },
    vatAmount: {
        type: Number,
        default: 0
    },
    vatRate: {
        type: Number,
        default: 0.15
    },
    // Flagging fields for unpaid parking
    isFlagged: {
        type: Boolean,
        default: false
    },
    flaggedAt: {
        type: Date
    },
    flaggedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    notificationSent: {
        type: Boolean,
        default: false
    },
    lastNotificationSentAt: {
        type: Date
    }
})

// Index for faster queries
parkedCarSchema.index({ licensePlate: 1, status: 1 });
parkedCarSchema.index({ valet_id: 1, parkedAt: -1 });

// Pre-save hook to remove null values from paymentMethod (enum doesn't allow null)
parkedCarSchema.pre('save', function(next) {
    if (this.paymentMethod === null) {
        this.paymentMethod = undefined;
    }
    next();
});

module.exports = mongoose.model("ParkedCar", parkedCarSchema)

