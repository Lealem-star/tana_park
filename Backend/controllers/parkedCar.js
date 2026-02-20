const { Router } = require("express")
const ParkedCar = require("../models/parkedCarSchema");
const Joi = require('joi');
const { Types } = require("mongoose");
const { isLoggedIn } = require("./middleware");

const parkedCarRouter = Router();

// Create new parked car
parkedCarRouter.post("/", isLoggedIn, async (req, res) => {
    try {
        // Only valets can register parked cars
        // NOTE: Auth is now based on phoneNumber (not email),
        // so we must look up the current user by phoneNumber from the JWT payload.
        const User = require("../models/userSchema");
        const currentUser = await User.findOne({ phoneNumber: req.user?.phoneNumber });
        
        if (!currentUser || currentUser.type !== 'valet') {
            return res.status(403).json({ error: "Only valets can register parked cars" });
        }

        let { plateCode, region, licensePlateNumber, carType, model = '', color = '', phoneNumber, notes, serviceType, packageDuration } = req.body;

        // Input validation
        const schema = Joi.object({
            plateCode: Joi.string().required().trim(),
            region: Joi.string().required().trim(),
            licensePlateNumber: Joi.string().required().trim(),
            carType: Joi.string().valid('tripod', 'automobile', 'truck', 'trailer').required(),
            model: Joi.string().allow('').optional(),
            color: Joi.string().allow('').optional(),
            phoneNumber: Joi.string().required().trim(),
            notes: Joi.string().allow('').optional(),
            serviceType: Joi.string().valid('hourly', 'package').default('hourly'),
            packageDuration: Joi.when('serviceType', {
                is: 'package',
                then: Joi.string().valid('weekly', 'monthly', 'yearly').required(),
                otherwise: Joi.string().valid('weekly', 'monthly', 'yearly').allow(null).optional()
            })
        })

        const { error } = schema.validate({ plateCode, region, licensePlateNumber, carType, model, color, phoneNumber, notes, serviceType, packageDuration });
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Construct full license plate string for backward compatibility and duplicate checking
        const licensePlate = `${plateCode}-${region}-${licensePlateNumber}`.toUpperCase();

        // Check if car with same license plate is already parked
        const existingCar = await ParkedCar.findOne({ 
            $or: [
                { licensePlate: licensePlate, status: 'parked' },
                { plateCode: plateCode, region: region, licensePlateNumber: licensePlateNumber.toUpperCase(), status: 'parked' }
            ]
        });

        if (existingCar) {
            return res.status(400).json({ error: "Car with this license plate is already parked" });
        }

        // Check for flagged customers with matching license plate or phone number
        const flaggedCar = await ParkedCar.findOne({
            isFlagged: true,
            $or: [
                { licensePlate: licensePlate },
                { plateCode: plateCode, region: region, licensePlateNumber: licensePlateNumber.toUpperCase() },
                { phoneNumber: phoneNumber.trim() }
            ]
        });

        if (flaggedCar) {
            // Calculate outstanding amount
            let outstandingAmount = 0;
            if (flaggedCar.baseAmount && flaggedCar.vatAmount) {
                outstandingAmount = (flaggedCar.baseAmount || 0) + (flaggedCar.vatAmount || 0);
            } else if (flaggedCar.totalPaidAmount === 0 && flaggedCar.parkedAt && flaggedCar.checkedOutAt) {
                // Calculate from duration if amounts not stored
                const diffMs = new Date(flaggedCar.checkedOutAt) - new Date(flaggedCar.parkedAt);
                const hoursParked = Math.max(0.01, diffMs / (1000 * 60 * 60));
                const PricingSettings = require('../models/pricingSettingsSchema');
                const pricingSettings = await PricingSettings.findOne();
                const priceLevels = pricingSettings?.priceLevels || {};
                const priceLevelNames = Object.keys(priceLevels);
                let pricePerHour = 50; // Default
                if (priceLevelNames.length > 0) {
                    const carPricing = priceLevels[priceLevelNames[0]]?.[flaggedCar.carType] || {};
                    pricePerHour = carPricing.hourly || 50;
                }
                const parkingFee = Math.round((hoursParked * pricePerHour) * 100) / 100;
                const vatRate = flaggedCar.vatRate || 0.15;
                const vatAmount = Math.round(parkingFee * vatRate * 100) / 100;
                outstandingAmount = parkingFee + vatAmount;
            }

            const licenseDisplay = flaggedCar.licensePlate || `${flaggedCar.plateCode || ''}-${flaggedCar.region || ''}-${flaggedCar.licensePlateNumber || ''}`;
            return res.status(400).json({ 
                error: `This customer has an unpaid parking fee. Please ask them to pay the outstanding amount of ${outstandingAmount.toFixed(2)} ETB first before registering a new car. License Plate: ${licenseDisplay}`,
                flaggedCar: {
                    id: flaggedCar._id,
                    licensePlate: licenseDisplay,
                    phoneNumber: flaggedCar.phoneNumber,
                    outstandingAmount: outstandingAmount.toFixed(2)
                }
            });
        }

        // Get parking zone from valet's parkZoneCode
        const location = currentUser.parkZoneCode || 'Unknown Zone';

        const parkedCar = await ParkedCar.create({ 
            licensePlate: licensePlate,
            plateCode: plateCode,
            region: region,
            licensePlateNumber: licensePlateNumber.toUpperCase(),
            carType: carType,
            model: model,
            color: color,
            phoneNumber: phoneNumber,
            location: location,
            notes: notes || '',
            serviceType: serviceType || 'hourly',
            packageDuration: serviceType === 'package' ? packageDuration : null,
            valet_id: currentUser._id,
            status: 'parked'
        });

        const populatedCar = await ParkedCar.findById(parkedCar._id).populate('valet_id', 'name phoneNumber priceLevel');

        res.json({ message: "Parked car registered successfully", car: populatedCar });
    } catch (error) {
        console.error(" error - ", error);
        res.status(400).json({ error: error.message });
    }
});

// Get parked cars list
parkedCarRouter.get("/", isLoggedIn, async (req, res) => {
    try {
        const { status, valet_id, date } = req.query;
        const User = require("../models/userSchema");
        const currentUser = await User.findOne({ phoneNumber: req.user?.phoneNumber });

        let query = {};

        // If not system admin, only show their own cars
        if (currentUser?.type !== 'system_admin' && currentUser?.type !== 'manager' && currentUser?.type !== 'admin') {
            query.valet_id = currentUser._id;
        } else if (valet_id) {
            query.valet_id = valet_id;
        }

        if (status) {
            query.status = status;
        }

        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.parkedAt = { $gte: startDate, $lte: endDate };
        }

        const cars = await ParkedCar.find(query)
            .populate('valet_id', 'name phoneNumber priceLevel')
            .populate('checkedOutBy', 'name phoneNumber')
            .sort({ parkedAt: -1 });

        res.json(cars);
    } catch (error) {
        console.error(" error - ", error);
        res.status(400).json({ error: error.message });
    }
});

// Get all flagged cars (visible to all users) - shows all until they pay
// IMPORTANT: This route must come BEFORE /:id to avoid route conflicts
parkedCarRouter.get("/flagged", isLoggedIn, async (req, res) => {
    try {
        // Get all cars that are checked_out and either flagged OR have unpaid amounts
        // This ensures we show all flagged customers until they pay
        const query = {
            status: 'checked_out',
            $or: [
                { isFlagged: true },
                // Include checked_out cars with no payment (they should be flagged)
                { totalPaidAmount: { $exists: false } },
                { totalPaidAmount: 0 },
                { totalPaidAmount: null }
            ]
        };

        const cars = await ParkedCar.find(query)
            .populate('valet_id', 'name phoneNumber priceLevel')
            .populate('flaggedBy', 'name phoneNumber')
            .populate('checkedOutBy', 'name phoneNumber')
            .sort({ flaggedAt: -1, checkedOutAt: -1 }); // Most recently flagged/checked out first

        console.log(`[Flagged Cars] Query:`, JSON.stringify(query, null, 2));
        console.log(`[Flagged Cars] Found ${cars.length} flagged/unpaid cars`);
        res.json(cars);
    } catch (error) {
        console.error("Get flagged cars error - ", error);
        res.status(400).json({ error: error.message });
    }
});

// Get single parked car
parkedCarRouter.get("/:id", isLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;

        if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid car id" });
        }

        const car = await ParkedCar.findById(id)
            .populate('valet_id', 'name phoneNumber priceLevel')
            .populate('checkedOutBy', 'name phoneNumber');

        if (!car) {
            return res.status(404).json({ error: "Parked car not found" });
        }

        res.json(car);
    } catch (error) {
        console.error(" error - ", error);
        res.status(400).json({ error: error.message });
    }
});

// Update parked car status (checkout, violation, etc.)
parkedCarRouter.put("/:id", isLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, totalPaidAmount, paymentMethod } = req.body;

        if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid car id" });
        }

        const User = require("../models/userSchema");
        const currentUser = await User.findOne({ phoneNumber: req.user?.phoneNumber });

        const car = await ParkedCar.findById(id);

        if (!car) {
            return res.status(404).json({ error: "Parked car not found" });
        }

        // Only the valet who registered or admin/manager can update
        if (currentUser.type !== 'system_admin' && 
            currentUser.type !== 'manager' && 
            currentUser.type !== 'admin' &&
            car.valet_id.toString() !== currentUser._id.toString()) {
            return res.status(403).json({ error: "You don't have permission to update this car" });
        }

        // Input validation
        const schema = Joi.object({
            status: Joi.string().valid('parked', 'checked_out', 'violation').optional(),
            notes: Joi.string().allow('').optional(),
            totalPaidAmount: Joi.number().min(0).optional(),
            paymentMethod: Joi.string().valid('manual', 'online').optional(),
        })

        const { error } = schema.validate({ status, notes, totalPaidAmount, paymentMethod });
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Update status
        if (status) {
            // For hourly or non-package cars, keep existing behavior
            if (car.serviceType !== 'package' || !car.packageDuration || !car.packageEndDate) {
            car.status = status;
            if (status === 'checked_out') {
                car.checkedOutAt = new Date();
                car.checkedBy = currentUser._id;
                if (totalPaidAmount !== undefined) {
                    // Calculate VAT breakdown for manual payments
                    const vatRate = await getVATRate();
                    // For manual payments, assume totalPaidAmount includes VAT
                    const vatBreakdown = reverseCalculateVAT(totalPaidAmount, vatRate);
                    car.totalPaidAmount = vatBreakdown.totalWithVat;
                    car.baseAmount = vatBreakdown.baseAmount;
                    car.vatAmount = vatBreakdown.vatAmount;
                    car.vatRate = vatRate;
                }
                if (paymentMethod !== undefined) {
                    car.paymentMethod = paymentMethod;
                    }
                }
            } else {
                // Package service: create separate records per visit, but keep subscription info
                const now = new Date();

                // If package already expired, prevent further parking/checkout changes
                if (car.packageEndDate && now > car.packageEndDate) {
                    return res.status(400).json({ error: "Package has expired" });
                }

                // For checked_out, mark this record as checked_out with payment info
                if (status === 'checked_out') {
                    car.status = 'checked_out';
                    car.checkedOutAt = now;
                    car.checkedOutBy = currentUser._id;
                    if (totalPaidAmount !== undefined) {
                        car.totalPaidAmount = totalPaidAmount;
                    }
                    if (paymentMethod !== undefined) {
                        car.paymentMethod = paymentMethod;
                    }
                } else if (status === 'parked') {
                    // Create a new parked record for a new visit within the same package
                    const newVisit = await ParkedCar.create({
                        licensePlate: car.licensePlate,
                        plateCode: car.plateCode,
                        region: car.region,
                        licensePlateNumber: car.licensePlateNumber,
                        carType: car.carType,
                        model: car.model,
                        color: car.color,
                        phoneNumber: car.phoneNumber,
                        location: car.location,
                        notes: notes !== undefined ? notes : car.notes,
                        serviceType: 'package',
                        packageDuration: car.packageDuration,
                        packageSubscriptionId: car.packageSubscriptionId || car._id,
                        packageStartDate: car.packageStartDate || car.parkedAt,
                        packageEndDate: car.packageEndDate,
                        valet_id: car.valet_id,
                        status: 'parked',
                        paymentMethod: car.paymentMethod,
                        paymentReference: car.paymentReference,
                        totalPaidAmount: car.totalPaidAmount || 0
                    });

                    // Return early with the newly created visit record
                    const populatedNewVisit = await ParkedCar.findById(newVisit._id)
                        .populate('valet_id', 'name phoneNumber priceLevel')
                        .populate('checkedOutBy', 'name phoneNumber');

                    // Send SMS for security: package car parked in again
                    try {
                        const userController = require('./user');
                        if (userController && userController.sendSms && populatedNewVisit.phoneNumber) {
                            const now = new Date();
                            const end = populatedNewVisit.packageEndDate ? new Date(populatedNewVisit.packageEndDate) : null;
                            let remainingText = '';
                            if (end) {
                                const diffMs = end.getTime() - now.getTime();
                                const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                                const endDisplay = end.toLocaleDateString();
                                remainingText = `Package expires on ${endDisplay} (${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining).`;
                            }

                            const licenseDisplay = populatedNewVisit.licensePlate || `${populatedNewVisit.plateCode || ''}-${populatedNewVisit.region || ''}-${populatedNewVisit.licensePlateNumber || ''}`;
                            const smsMessage = `Security alert: Your package car (${licenseDisplay}) has been parked at Tana Parking.\nPackage type: ${populatedNewVisit.packageDuration || 'package'}.\n${remainingText}`;

                            await userController.sendSms(populatedNewVisit.phoneNumber, smsMessage);
                        }
                    } catch (smsErr) {
                        console.error('Failed to send package re-park SMS:', smsErr);
                    }

                    return res.json({ message: "New package visit parked successfully", car: populatedNewVisit });
                }
            }
        }

        if (notes !== undefined) {
            car.notes = notes;
        }

        await car.save();

        const updatedCar = await ParkedCar.findById(id)
            .populate('valet_id', 'name phoneNumber priceLevel')
            .populate('checkedOutBy', 'name phoneNumber');

        res.json({ message: "Parked car updated successfully", car: updatedCar });
    } catch (error) {
        console.error(" error - ", error);
        res.status(400).json({ error: error.message });
    }
});

// Delete parked car
parkedCarRouter.delete("/:id", isLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;

        if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid car id" });
        }

        const User = require("../models/userSchema");
        const currentUser = await User.findOne({ phoneNumber: req.user?.phoneNumber });

        const car = await ParkedCar.findById(id);

        if (!car) {
            return res.status(404).json({ error: "Parked car not found" });
        }

        // Only system admin, manager, or the valet who registered can delete
        if (currentUser.type !== 'system_admin' && 
            currentUser.type !== 'manager' && 
            currentUser.type !== 'admin' &&
            car.valet_id.toString() !== currentUser._id.toString()) {
            return res.status(403).json({ error: "You don't have permission to delete this car" });
        }

        await ParkedCar.findByIdAndDelete(id);

        res.json({ message: "Parked car deleted successfully" });
    } catch (error) {
        console.error(" error - ", error);
        res.status(400).json({ error: error.message });
    }
});

// Helper function to get daily stats for a specific date
const getDailyStatsForDate = async (targetDate, currentUser) => {
    // Extract year, month, day from the date object (works with local timezone)
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const day = targetDate.getDate();
    
    // Create date range in local timezone (not UTC)
    const startDate = new Date(year, month, day, 0, 0, 0, 0);
    const endDate = new Date(year, month, day, 23, 59, 59, 999);

    let query = {
        parkedAt: { $gte: startDate, $lte: endDate }
    };

    // If not system admin/manager/admin, only show their own stats
    if (currentUser?.type !== 'system_admin' && 
        currentUser?.type !== 'manager' && 
        currentUser?.type !== 'admin') {
        query.valet_id = currentUser._id;
    }

    const totalParked = await ParkedCar.countDocuments(query);
    const checkedOut = await ParkedCar.countDocuments({ ...query, status: 'checked_out' });
    const stillParked = await ParkedCar.countDocuments({ ...query, status: 'parked' });
    const violations = await ParkedCar.countDocuments({ ...query, status: 'violation' });

    // For payments, filter by checkedOutAt date (when payment was made), not parkedAt
    let paymentQuery = {
        checkedOutAt: { $gte: startDate, $lte: endDate },
        status: 'checked_out'
    };

    // If not system admin/manager/admin, only show their own stats
    if (currentUser?.type !== 'system_admin' && 
        currentUser?.type !== 'manager' && 
        currentUser?.type !== 'admin') {
        paymentQuery.valet_id = currentUser._id;
    }

    // Manual payments: include cars with paymentMethod='manual' OR paymentMethod is null/undefined (for legacy records)
    const manualPayments = await ParkedCar.aggregate([
        { 
            $match: { 
                ...paymentQuery, 
                $or: [
                    { paymentMethod: 'manual' },
                    { paymentMethod: { $exists: false } },
                    { paymentMethod: null }
                ]
            } 
        },
        { $group: { _id: null, total: { $sum: '$totalPaidAmount' } } }
    ]);

    // Online payments: only count cars explicitly marked as online
    const onlinePayments = await ParkedCar.aggregate([
        { $match: { ...paymentQuery, paymentMethod: 'online' } },
        { $group: { _id: null, total: { $sum: '$totalPaidAmount' } } }
    ]);

    // Format date as YYYY-MM-DD using local date components (not UTC)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
        date: dateStr,
        totalParked,
        checkedOut,
        stillParked,
        violations,
        manualPayments: manualPayments.length > 0 ? manualPayments[0].total : 0,
        onlinePayments: onlinePayments.length > 0 ? onlinePayments[0].total : 0,
    };
};

// Get daily activities statistics
parkedCarRouter.get("/stats/daily", isLoggedIn, async (req, res) => {
    try {
        const { date } = req.query;
        const User = require("../models/userSchema");
        const currentUser = await User.findOne({ phoneNumber: req.user?.phoneNumber });

        // Use today's date in local timezone
        let targetDate;
        if (date) {
            targetDate = new Date(date);
        } else {
            // Get today's date in local timezone
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            const day = now.getDate();
            targetDate = new Date(year, month, day);
        }
        const stats = await getDailyStatsForDate(targetDate, currentUser);

        res.json(stats);
    } catch (error) {
        console.error(" error - ", error);
        res.status(400).json({ error: error.message });
    }
});

// Get historical daily statistics (last N days)
parkedCarRouter.get("/stats/daily/history", isLoggedIn, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const User = require("../models/userSchema");
        const currentUser = await User.findOne({ phoneNumber: req.user?.phoneNumber });

        const statsPromises = [];
        // Get today's date in local timezone
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Get stats for the last N days (excluding today)
        // Generate from most recent (yesterday) to oldest (N days ago)
        // This will get: yesterday, day before yesterday, ..., N days ago
        for (let i = 1; i <= parseInt(limit); i++) {
            const targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() - i);
            statsPromises.push(getDailyStatsForDate(targetDate, currentUser));
        }

        const stats = await Promise.all(statsPromises);
        // Return with most recent first (yesterday at index 0, oldest at the end)
        res.json(stats);
    } catch (error) {
        console.error(" error - ", error);
        res.status(400).json({ error: error.message });
    }
});

// Flag a parked car (mark as unpaid)
parkedCarRouter.put("/:id/flag", isLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;
        const { baseAmount, vatAmount, totalWithVat } = req.body;

        if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid car id" });
        }

        const User = require("../models/userSchema");
        const currentUser = await User.findOne({ phoneNumber: req.user?.phoneNumber });

        const car = await ParkedCar.findById(id);

        if (!car) {
            return res.status(404).json({ error: "Parked car not found" });
        }

        // Only the valet who registered or admin/manager can flag
        if (currentUser.type !== 'system_admin' && 
            currentUser.type !== 'manager' && 
            currentUser.type !== 'admin' &&
            car.valet_id.toString() !== currentUser._id.toString()) {
            return res.status(403).json({ error: "You don't have permission to flag this car" });
        }

        // Can flag parked cars or checked_out cars that haven't been paid
        const now = new Date();
        
        if (car.status === 'parked') {
            // If car is still parked, set checked out time to stop timer
            car.status = 'checked_out';
            car.checkedOutAt = now;
            car.checkedOutBy = currentUser._id;
        } else if (car.status === 'checked_out') {
            // If car is already checked out, ensure checkedOutAt is set
            if (!car.checkedOutAt) {
                car.checkedOutAt = now;
            }
            if (!car.checkedOutBy) {
                car.checkedOutBy = currentUser._id;
            }
        } else {
            return res.status(400).json({ error: "Can only flag cars that are parked or checked out" });
        }
        
        // Mark as flagged
        car.isFlagged = true;
        car.flaggedAt = now;
        car.flaggedBy = currentUser._id;

        // Store fee details if provided
        if (baseAmount !== undefined) {
            car.baseAmount = baseAmount;
        }
        if (vatAmount !== undefined) {
            car.vatAmount = vatAmount;
        }
        if (totalWithVat !== undefined) {
            car.totalPaidAmount = 0; // Not paid yet
            // Store the amount owed
            if (!car.baseAmount && baseAmount === undefined) {
                // Calculate from totalWithVat if baseAmount not provided
                const { reverseCalculateVAT } = require('../utils/vatCalculator');
                const vatRate = car.vatRate || 0.15;
                const breakdown = reverseCalculateVAT(totalWithVat, vatRate);
                car.baseAmount = breakdown.baseAmount;
                car.vatAmount = breakdown.vatAmount;
            }
        }

        await car.save();

        const updatedCar = await ParkedCar.findById(id)
            .populate('valet_id', 'name phoneNumber priceLevel')
            .populate('checkedOutBy', 'name phoneNumber')
            .populate('flaggedBy', 'name phoneNumber');

        res.json({ message: "Car flagged successfully", car: updatedCar });
    } catch (error) {
        console.error("Flag car error - ", error);
        res.status(400).json({ error: error.message });
    }
});

// Send notification to flagged customer
parkedCarRouter.post("/:id/notify", isLoggedIn, async (req, res) => {
    try {
        const { id } = req.params;

        if (!Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid car id" });
        }

        const car = await ParkedCar.findById(id)
            .populate('valet_id', 'name phoneNumber priceLevel');

        if (!car) {
            return res.status(404).json({ error: "Parked car not found" });
        }

        if (!car.isFlagged) {
            return res.status(400).json({ error: "Car is not flagged" });
        }

        if (!car.phoneNumber) {
            return res.status(400).json({ error: "Phone number not available" });
        }

        // Calculate fee if not already stored
        let parkingFee = car.baseAmount || 0;
        let vatAmount = car.vatAmount || 0;
        let totalWithVat = parkingFee + vatAmount;

        // If fee not stored, calculate from duration
        if (totalWithVat === 0 && car.parkedAt && car.checkedOutAt) {
            const { calculateVAT, getVATRate } = require('../utils/vatCalculator');
            const vatRate = await getVATRate();
            
            // Calculate hours parked
            const diffMs = new Date(car.checkedOutAt) - new Date(car.parkedAt);
            const hoursParked = Math.max(0.01, diffMs / (1000 * 60 * 60));
            
            // Get pricing (simplified - use first available price level)
            const PricingSettings = require('../models/pricingSettingsSchema');
            const pricingSettings = await PricingSettings.findOne();
            const priceLevels = pricingSettings?.priceLevels || {};
            const priceLevelNames = Object.keys(priceLevels);
            
            let pricePerHour = 50; // Default
            if (priceLevelNames.length > 0) {
                const carPricing = priceLevels[priceLevelNames[0]]?.[car.carType] || {};
                pricePerHour = carPricing.hourly || 50;
            }
            
            parkingFee = Math.round((hoursParked * pricePerHour) * 100) / 100;
            vatAmount = calculateVAT(parkingFee, vatRate);
            totalWithVat = parkingFee + vatAmount;
        }

        // Construct warning message
        const licenseDisplay = car.licensePlate || `${car.plateCode || ''}-${car.region || ''}-${car.licensePlateNumber || ''}`;
        const checkedOutDate = car.checkedOutAt ? new Date(car.checkedOutAt).toLocaleDateString() : 'N/A';
        const checkedOutTime = car.checkedOutAt ? new Date(car.checkedOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
        
        const smsMessage = `⚠️ WARNING: Unpaid Parking Fee\n\nDear customer,\n\nYour vehicle (${licenseDisplay}) was checked out from Tana Parking on ${checkedOutDate} at ${checkedOutTime} without payment.\n\nOutstanding Amount:\nParking Fee: ${parkingFee.toFixed(2)} ETB\nVAT: ${vatAmount.toFixed(2)} ETB\nTotal: ${totalWithVat.toFixed(2)} ETB\n\nPlease return to the parking facility to complete your payment. Failure to pay may result in additional penalties.\n\nThank you for your cooperation.`;

        // Format phone number for SMS (ensure it starts with +)
        let formattedPhone = car.phoneNumber.trim();
        if (!formattedPhone.startsWith('+')) {
            if (formattedPhone.startsWith('251')) {
                formattedPhone = '+' + formattedPhone;
            } else if (formattedPhone.startsWith('0')) {
                formattedPhone = '+251' + formattedPhone.substring(1);
            } else {
                formattedPhone = '+' + formattedPhone;
            }
        }

        // Send SMS notification
        const userController = require('./user');
        if (userController && userController.sendSms) {
            await userController.sendSms(formattedPhone, smsMessage);
        } else {
            return res.status(500).json({ error: "SMS service not available" });
        }

        // Update notification status
        car.notificationSent = true;
        car.lastNotificationSentAt = new Date();
        await car.save();

        res.json({ message: "Notification sent successfully", car });
    } catch (error) {
        console.error("Notify flagged customer error - ", error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = parkedCarRouter;

