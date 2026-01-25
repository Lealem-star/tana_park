// Ensure dotenv is loaded before reading environment variables
require('dotenv').config();

const { Router } = require("express");
const axios = require("axios");
const { isLoggedIn } = require("./middleware");
const ParkedCar = require("../models/parkedCarSchema");
const User = require("../models/userSchema");
const PendingPackagePayment = require("../models/pendingPackagePaymentSchema");
const Joi = require('joi');
const { Types } = require("mongoose");

const paymentRouter = Router();

// Chapa API configuration
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || "CHASECK_TEST-xxxxxxxxxxxxx"; // Replace with your Chapa secret key
const CHAPA_PUBLIC_KEY = (process.env.CHAPA_PUBLIC_KEY || "").trim(); // Chapa public key for frontend (trim whitespace)
const CHAPA_BASE_URL = "https://api.chapa.co/v1/transaction";

// Debug: Log Chapa configuration status (without exposing full keys)
console.log("🔑 Chapa Configuration Status:");
console.log("   - CHAPA_SECRET_KEY:", CHAPA_SECRET_KEY ? `${CHAPA_SECRET_KEY.substring(0, 20)}...` : "NOT SET");
console.log("   - CHAPA_PUBLIC_KEY:", CHAPA_PUBLIC_KEY ? `${CHAPA_PUBLIC_KEY.substring(0, 20)}...` : "NOT SET");
console.log("   - Public Key Length:", CHAPA_PUBLIC_KEY.length);
console.log("   - Public Key Format:", CHAPA_PUBLIC_KEY.startsWith('CHAPUBK_TEST-') ? 'TEST MODE ✅' : 
                                          CHAPA_PUBLIC_KEY.startsWith('CHAPUBK-') ? 'LIVE MODE ✅' : 
                                          CHAPA_PUBLIC_KEY ? 'INVALID FORMAT ❌' : 'NOT SET ❌');

// Validate Chapa configuration
if (!CHAPA_PUBLIC_KEY || CHAPA_PUBLIC_KEY === "") {
    console.warn("⚠️  WARNING: CHAPA_PUBLIC_KEY is not set in environment variables!");
    console.warn("⚠️  Payment initialization will fail. Please set CHAPA_PUBLIC_KEY in your .env file.");
    console.warn("⚠️  For test mode, use: CHAPA_PUBLIC_KEY=CHAPUBK_TEST-your-test-key");
    console.warn("⚠️  For live mode, use: CHAPA_PUBLIC_KEY=CHAPUBK-your-live-key");
    console.warn("⚠️  Make sure there are NO quotes around the key value in .env file");
    console.warn("⚠️  Example: CHAPA_PUBLIC_KEY=CHAPUBK_TEST-abc123 (NOT: CHAPA_PUBLIC_KEY=\"CHAPUBK_TEST-abc123\")");
}

// Initialize Chapa payment
paymentRouter.post("/chapa/initialize", isLoggedIn, async (req, res) => {
    try {
        const { carId, amount, customerName, customerEmail, customerPhone } = req.body;

        // Input validation
        const schema = Joi.object({
            carId: Joi.string().required(),
            amount: Joi.number().positive().required(),
            customerName: Joi.string().optional().allow(""),
            customerEmail: Joi.string().email().optional().allow("").strip(),
            customerPhone: Joi.string().required(),
        });

        const { error } = schema.validate({ carId, amount, customerName, customerEmail, customerPhone });
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Verify car exists and is parked
        if (!Types.ObjectId.isValid(carId)) {
            return res.status(400).json({ error: "Invalid car id" });
        }

        const car = await ParkedCar.findById(carId);
        if (!car) {
            return res.status(404).json({ error: "Car not found" });
        }

        if (car.status !== 'parked') {
            return res.status(400).json({ error: "Car is not currently parked" });
        }

        // Validate Chapa public key is configured
        if (!CHAPA_PUBLIC_KEY || CHAPA_PUBLIC_KEY.trim() === "") {
            console.error("❌ CHAPA_PUBLIC_KEY is not configured in backend .env file");
            return res.status(500).json({ 
                error: "Payment system is not configured. Please contact administrator. (Missing CHAPA_PUBLIC_KEY)" 
            });
        }

        // Generate unique txRef: timestamp + random string to prevent collisions
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 10); // 8 random alphanumeric chars
        const uniqueTxRef = `tana-${carId.substring(0, 10)}-${timestamp}-${randomSuffix}`;
        
        console.log(`[Payment Init] Generated NEW txRef for car ${carId}: ${uniqueTxRef}`);

        // NOTE: For Chapa Inline.js, we generate the txRef but let Inline.js handle initialization.
        // Calling Chapa's /initialize API here would reserve the txRef and cause conflicts.
        // Inline.js will initialize the payment using the public key and txRef we provide.
        
        console.log("[DEBUG] Returning publicKey in /chapa/initialize response:", CHAPA_PUBLIC_KEY);

        res.json({
            success: true,
            txRef: uniqueTxRef,
            publicKey: CHAPA_PUBLIC_KEY, // Include public key for frontend inline.js
            message: "Payment reference generated successfully"
        });
    } catch (error) {
        console.error("Chapa payment initialization error:", error);
        console.error("Chapa error response:", error.response?.data);
        
        // Extract error message from Chapa API response
        let errorMessage = "Failed to initialize payment";
        
        if (error.response?.data) {
            const chapaError = error.response.data;
            
            // Try different ways to extract the error message
            if (typeof chapaError.message === 'string') {
                errorMessage = chapaError.message;
            } else if (typeof chapaError.message === 'object') {
                // If message is an object, try to extract useful info
                if (chapaError.message.message) {
                    errorMessage = chapaError.message.message;
                } else if (chapaError.message.error) {
                    errorMessage = typeof chapaError.message.error === 'string' 
                        ? chapaError.message.error 
                        : JSON.stringify(chapaError.message.error);
                } else {
                    // Stringify the object but make it readable
                    errorMessage = JSON.stringify(chapaError.message);
                }
            } else if (chapaError.error) {
                errorMessage = typeof chapaError.error === 'string' 
                    ? chapaError.error 
                    : JSON.stringify(chapaError.error);
            }
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        // Return appropriate status code based on error type
        const statusCode = error.response?.status || 500;
        res.status(statusCode).json({ error: errorMessage });
    }
});

// Initialize Chapa payment for package (payment-first, no carId)
paymentRouter.post("/chapa/initialize-package", isLoggedIn, async (req, res) => {
    try {
        const {
            amount,
            packageDuration,
            customerPhone,
            serviceType,
            carData // plateCode, region, licensePlateNumber, carType, model, color, phoneNumber, notes
        } = req.body;

        // Validate input
        const schema = Joi.object({
            amount: Joi.number().positive().required(),
            packageDuration: Joi.string().valid('weekly', 'monthly', 'yearly').required(),
            customerPhone: Joi.string().required(),
            serviceType: Joi.string().valid('package').required(),
            carData: Joi.object({
                plateCode: Joi.string().required().trim(),
                region: Joi.string().required().trim(),
                licensePlateNumber: Joi.string().required().trim(),
                carType: Joi.string().valid('tripod', 'automobile', 'truck', 'trailer').required(),
                model: Joi.string().allow('').optional(),
                color: Joi.string().allow('').optional(),
                phoneNumber: Joi.string().required().trim(),
                notes: Joi.string().allow('').optional(),
                // Allow priceLevel from frontend; ignore if not used
                priceLevel: Joi.string().optional().allow('', null),
            }).required()
        });

        const { error } = schema.validate({ amount, packageDuration, customerPhone, serviceType, carData });
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }

        // Identify current user/valet
        const currentUser = await User.findOne({ phoneNumber: req.user?.phoneNumber });
        if (!currentUser || currentUser.type !== 'valet') {
            return res.status(403).json({ error: "Only valets can initialize package payments" });
        }

        // Validate Chapa public key is configured
        if (!CHAPA_PUBLIC_KEY || CHAPA_PUBLIC_KEY.trim() === "") {
            console.error("❌ CHAPA_PUBLIC_KEY is not configured in backend .env file");
            return res.status(500).json({ 
                error: "Payment system is not configured. Please contact administrator. (Missing CHAPA_PUBLIC_KEY)" 
            });
        }

        // Generate unique txRef: timestamp + random string to prevent collisions
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 10); // 8 random alphanumeric chars
        const txRef = `tana-pkg-${timestamp}-${randomSuffix}`;
        
        console.log(`[Package Payment Init] Generated NEW txRef: ${txRef}`);

        // Store pending payload in MongoDB
        await PendingPackagePayment.create({
            txRef,
            carData,
            serviceType: 'package',
            packageDuration,
            amount,
            customerPhone,
            valetId: currentUser._id,
            parkZoneCode: currentUser.parkZoneCode || 'Unknown Zone'
        });

        // NOTE: We're using Chapa Inline.js, which handles payment initialization itself.
        // We don't call Chapa's /initialize API here - that would reserve the txRef and cause
        // "Transaction reference has been used before" error when Inline.js tries to use it.
        // Instead, we just generate and return the txRef + public key, and let Inline.js initialize.
        
        res.json({
            success: true,
            txRef: txRef,
            publicKey: CHAPA_PUBLIC_KEY,
            message: "Package payment reference generated successfully"
        });
    } catch (error) {
        console.error("Chapa package payment initialization error:", error);
        const errorMessage = error?.response?.data?.message || error?.message || "Failed to initialize package payment";
        res.status(error?.response?.status || 500).json({ error: errorMessage });
    }
});

// Verify Chapa payment
paymentRouter.get("/chapa/verify/:txRef", isLoggedIn, async (req, res) => {
    try {
        const { txRef } = req.params;

        if (!txRef) {
            return res.status(400).json({ error: "Transaction reference is required" });
        }

        // Verify payment with Chapa
        let chapaResponse;
        try {
            chapaResponse = await axios.get(
                `${CHAPA_BASE_URL}/verify/${txRef}`,
                {
                    headers: {
                        'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
                    }
                }
            );
            
            // Log the response for debugging
            console.log(`[Payment Verify] Chapa API response for ${txRef}:`, {
                apiStatus: chapaResponse.data?.status,
                transactionStatus: chapaResponse.data?.data?.status,
                transactionData: chapaResponse.data?.data,
                txRef: chapaResponse.data?.data?.tx_ref
            });
        } catch (chapaError) {
            // Chapa API error - could be transaction not found or still processing
            const errorMessage = chapaError?.response?.data?.message || chapaError?.message || "Payment verification failed";
            const statusCode = chapaError?.response?.status;
            
            console.log(`[Payment Verify] Chapa API error for ${txRef}:`, {
                statusCode,
                errorMessage,
                responseData: chapaError?.response?.data
            });
            
            // If transaction not found (404) or still processing, return pending status for retry
            if (statusCode === 404 || 
                errorMessage.toLowerCase().includes('not found') || 
                errorMessage.toLowerCase().includes('processing') || 
                errorMessage.toLowerCase().includes('pending') ||
                errorMessage.toLowerCase().includes('not available')) {
                return res.json({
                    success: true,
                    transaction: {
                        status: 'pending',
                        txRef: txRef,
                    },
                    message: "Payment is still processing. Please wait and try again."
                });
            }
            
            // Other errors - return error
            return res.status(statusCode || 400).json({ error: errorMessage });
        }

        // Check Chapa API response format
        // Chapa returns: { status: 'success', data: { status: 'successful'|'pending'|'failed', ... } }
        if (chapaResponse.data.status === 'success' && chapaResponse.data.data) {
            const transaction = chapaResponse.data.data;
            
            // Normalize transaction status (Chapa can return 'success' or 'successful')
            // Map 'success' to 'successful' for consistency
            const normalizedStatus = transaction.status === 'success' ? 'successful' : transaction.status;
            
            console.log(`[Payment Verify] Transaction status - Original: ${transaction.status}, Normalized: ${normalizedStatus}, txRef: ${transaction.tx_ref || txRef}`);
            
            // Handle pending/processing transactions - return success with pending status for retry
            if (normalizedStatus === 'pending' || 
                normalizedStatus === 'processing' || 
                normalizedStatus === 'initiated') {
                return res.json({
                    success: true,
                    transaction: {
                        status: normalizedStatus,
                        txRef: transaction.tx_ref || txRef,
                    },
                    message: "Payment is still processing. Please wait and try again."
                });
            }
            
            // Handle failed or cancelled transactions
            if (normalizedStatus === 'failed' || normalizedStatus === 'cancelled') {
                return res.json({
                    success: false,
                    transaction: {
                        status: normalizedStatus,
                        txRef: transaction.tx_ref || txRef,
                    },
                    message: `Payment ${normalizedStatus}. Please try again.`
                });
            }
            
            // Extract carId from tx_ref
            // Format: tana-{carIdPrefix}-{timestamp}-{randomSuffix}
            // Example: tana-696fc624d3-1769326077675-f8qep5mo
            let carId = null;
            
            // PRIORITY 1: Check if carId is passed as query parameter (most reliable)
            const queryCarId = req.query.carId;
            if (queryCarId && Types.ObjectId.isValid(queryCarId)) {
                carId = queryCarId;
            }
            
            // PRIORITY 2: Check meta for carId (if provided by Chapa)
            if (!carId && transaction.meta && transaction.meta.carId) {
                carId = transaction.meta.carId;
            }
            
            // PRIORITY 3: Try to extract from tx_ref pattern
            if (!carId) {
                const txRefMatch = transaction.tx_ref.match(/^tana-([a-f0-9]{10,24})-/);
                if (txRefMatch) {
                    const carIdPrefix = txRefMatch[1];
                    // If it's a full 24-char ObjectId, use it directly
                    if (carIdPrefix.length === 24 && Types.ObjectId.isValid(carIdPrefix)) {
                        carId = carIdPrefix;
                    } else {
                        // If it's a prefix, try to find the car by converting ObjectId to string
                        // Use aggregation to convert ObjectId to string for regex matching
                        try {
                            const cars = await ParkedCar.aggregate([
                                {
                                    $addFields: {
                                        idString: { $toString: "$_id" }
                                    }
                                },
                                {
                                    $match: {
                                        idString: { $regex: `^${carIdPrefix}`, $options: 'i' }
                                    }
                                },
                                {
                                    $limit: 1
                                }
                            ]);
                            if (cars.length > 0 && cars[0]._id) {
                                carId = cars[0]._id.toString();
                            }
                        } catch (aggregateError) {
                            console.error(`[Payment Verify] Error finding car by prefix ${carIdPrefix}:`, aggregateError);
                            // If aggregation fails (older MongoDB), try fetching all and filtering in memory
                            // This is less efficient but works as a fallback
                            try {
                                const allCars = await ParkedCar.find({}).limit(100); // Limit to prevent memory issues
                                const matchingCar = allCars.find(car => 
                                    car._id.toString().startsWith(carIdPrefix)
                                );
                                if (matchingCar) {
                                    carId = matchingCar._id.toString();
                                }
                            } catch (fallbackError) {
                                console.error(`[Payment Verify] Fallback search also failed:`, fallbackError);
                            }
                        }
                    }
                }
            }

            console.log(`[Payment Verify] Extracted carId: ${carId}, isValid: ${carId ? Types.ObjectId.isValid(carId) : false}`);
            
            if (carId && Types.ObjectId.isValid(carId)) {
                const car = await ParkedCar.findById(carId);
                console.log(`[Payment Verify] Car found: ${car ? 'YES' : 'NO'}, Car status: ${car?.status}, Payment status: ${normalizedStatus}`);
                
                // Check if payment is successful (normalized status)
                if (car && normalizedStatus === 'successful') {
                    // Update car status to checked_out
                    car.status = 'checked_out';
                    car.checkedOutAt = new Date();
                    car.paymentMethod = 'online';
                    car.paymentReference = txRef;
                    // Save the transaction amount as totalPaidAmount
                    if (transaction.amount) {
                        car.totalPaidAmount = transaction.amount;
                    }
                    await car.save();

                    res.json({
                        success: true,
                        transaction: {
                            status: normalizedStatus, // Use normalized status
                            amount: transaction.amount,
                            currency: transaction.currency,
                            txRef: transaction.tx_ref,
                        },
                        car: {
                            id: car._id,
                            licensePlate: car.licensePlate,
                            status: car.status
                        },
                        message: "Payment verified and car checked out successfully"
                    });
                } else {
                    res.json({
                        success: true,
                        transaction: {
                            status: normalizedStatus, // Use normalized status
                            txRef: transaction.tx_ref,
                        },
                        message: normalizedStatus === 'successful' 
                            ? "Payment verified but car not found or already checked out" 
                            : "Payment not successful"
                    });
                }
            } else {
                res.json({
                    success: true,
                    transaction: {
                        status: normalizedStatus, // Use normalized status
                        txRef: transaction.tx_ref,
                    },
                    message: "Payment verified but car ID not found in transaction reference"
                });
            }
        } else {
            // Chapa API returned unsuccessful response
            res.json({
                success: true,
                transaction: {
                    status: 'pending',
                    txRef: txRef,
                },
                message: "Payment verification pending. Please wait and try again."
            });
        }
    } catch (error) {
        console.error("Chapa payment verification error:", error);
        res.status(500).json({ 
            error: error?.response?.data?.message || "Failed to verify payment" 
        });
    }
});

// Verify Chapa payment for package (creates car after successful payment)
paymentRouter.get("/chapa/verify-package/:txRef", isLoggedIn, async (req, res) => {
    try {
        const { txRef } = req.params;

        if (!txRef) {
            return res.status(400).json({ error: "Transaction reference is required" });
        }

        // Find pending payment in MongoDB
        const pending = await PendingPackagePayment.findOne({ txRef });
        if (!pending) {
            return res.status(404).json({ error: "Pending package payment not found or already processed" });
        }

        // Verify payment with Chapa
        let chapaResponse;
        try {
            chapaResponse = await axios.get(
                `${CHAPA_BASE_URL}/verify/${txRef}`,
                {
                    headers: {
                        'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
                    }
                }
            );
        } catch (chapaError) {
            // Chapa API error - could be transaction not found or still processing
            const errorMessage = chapaError?.response?.data?.message || chapaError?.message || "Payment verification failed";
            const statusCode = chapaError?.response?.status;
            
            // If transaction not found or still processing, return pending status for retry
            if (statusCode === 404 || errorMessage.toLowerCase().includes('not found') || 
                errorMessage.toLowerCase().includes('processing') || 
                errorMessage.toLowerCase().includes('pending')) {
                return res.json({
                    success: true,
                    transaction: {
                        status: 'pending',
                        txRef: txRef,
                    },
                    message: "Payment is still processing. Please wait and try again."
                });
            }
            
            // Other errors - return error
            return res.status(statusCode || 400).json({ error: errorMessage });
        }

        if (chapaResponse.data.status === 'success' && chapaResponse.data.data) {
            const transaction = chapaResponse.data.data;

            // Normalize transaction status (Chapa can return 'success' or 'successful')
            // Map 'success' to 'successful' for consistency
            const normalizedStatus = transaction.status === 'success' ? 'successful' : transaction.status;
            
            console.log(`[Package Payment Verify] Transaction status - Original: ${transaction.status}, Normalized: ${normalizedStatus}, txRef: ${transaction.tx_ref || txRef}`);

            // Handle pending transactions - return success with pending status for retry
            if (normalizedStatus === 'pending' || 
                normalizedStatus === 'processing' || 
                normalizedStatus === 'initiated') {
                return res.json({
                    success: true,
                    transaction: {
                        status: normalizedStatus,
                        txRef: transaction.tx_ref || txRef,
                    },
                    message: "Payment is still processing. Please wait and try again."
                });
            }
            
            // Handle failed or cancelled transactions
            if (normalizedStatus === 'failed' || normalizedStatus === 'cancelled') {
                return res.json({
                    success: false,
                    transaction: {
                        status: normalizedStatus,
                        txRef: transaction.tx_ref || txRef,
                    },
                    message: `Payment ${normalizedStatus}. Please try again.`
                });
            }

            if (normalizedStatus === 'successful') {
                // Create the initial package subscription + first parked record
                const {
                    carData,
                    packageDuration,
                    amount,
                    valetId,
                    parkZoneCode
                } = pending;

                // Construct licensePlate
                const licensePlate = `${carData.plateCode}-${carData.region}-${carData.licensePlateNumber}`.toUpperCase();

                // Compute package start/end dates
                const packageStartDate = new Date();
                const packageEndDate = new Date(packageStartDate);
                switch (packageDuration) {
                    case 'weekly':
                        packageEndDate.setDate(packageStartDate.getDate() + 7);
                        break;
                    case 'monthly':
                        packageEndDate.setMonth(packageStartDate.getMonth() + 1);
                        break;
                    case 'yearly':
                        packageEndDate.setFullYear(packageStartDate.getFullYear() + 1);
                        break;
                    default:
                        break;
                }

                // Create a subscription id to link all future records
                const packageSubscriptionId = new Types.ObjectId();

                const parkedCar = await ParkedCar.create({
                    licensePlate: licensePlate,
                    plateCode: carData.plateCode,
                    region: carData.region,
                    licensePlateNumber: carData.licensePlateNumber.toUpperCase(),
                    carType: carData.carType,
                    model: carData.model || '',
                    color: carData.color || '',
                    phoneNumber: carData.phoneNumber,
                    location: parkZoneCode || 'Unknown Zone',
                    notes: carData.notes || '',
                    serviceType: 'package',
                    packageDuration: packageDuration,
                    packageSubscriptionId,
                    packageStartDate,
                    packageEndDate,
                    valet_id: valetId,
                    status: 'parked',
                    paymentMethod: 'online',
                    paymentReference: txRef,
                    totalPaidAmount: transaction.amount || amount || 0
                });

                // Clean up pending payment from MongoDB
                await PendingPackagePayment.deleteOne({ txRef });

                res.json({
                    success: true,
                    transaction: {
                        status: normalizedStatus, // Use normalized status
                        amount: transaction.amount,
                        currency: transaction.currency,
                        txRef: transaction.tx_ref,
                    },
                    car: {
                        id: parkedCar._id,
                        licensePlate: parkedCar.licensePlate,
                        status: parkedCar.status,
                        serviceType: parkedCar.serviceType,
                        packageDuration: parkedCar.packageDuration,
                        packageStartDate: parkedCar.packageStartDate,
                        packageEndDate: parkedCar.packageEndDate,
                        phoneNumber: parkedCar.phoneNumber,
                    },
                    message: "Payment verified and car created successfully"
                });
            } else {
                // Chapa can take a moment to finalize; treat non-success as "pending" rather than a hard error.
                // Frontend should retry verification for a short period.
                return res.status(202).json({
                    success: true,
                    transaction: {
                        status: normalizedStatus, // Use normalized status
                        amount: transaction.amount,
                        currency: transaction.currency,
                        txRef: transaction.tx_ref,
                    },
                    message: "Payment not successful yet"
                });
            }
        } else {
            res.status(400).json({ error: "Payment verification failed" });
        }
    } catch (error) {
        console.error("Chapa package payment verification error:", error);
        res.status(500).json({
            error: error?.response?.data?.message || "Failed to verify package payment"
        });
    }
});

// Callback endpoint for Chapa payment results (used by Inline.js)
// This endpoint handles both POST (webhook) and GET (redirect) requests
paymentRouter.post("/chapa/callback", async (req, res) => {
    try {
        // Log the full request body to see what Chapa actually sends
        console.log("Chapa callback full body:", JSON.stringify(req.body, null, 2));
        console.log("Chapa callback headers:", req.headers);
        
        // Chapa webhook format: data might be nested in 'data' object or directly in body
        // Try both formats
        let tx_ref, status, amount, meta;
        
        if (req.body.data) {
            // Nested format: { data: { tx_ref, status, amount, meta } }
            tx_ref = req.body.data.tx_ref || req.body.data.txRef;
            status = req.body.data.status;
            amount = req.body.data.amount;
            meta = req.body.data.meta;
        } else {
            // Direct format: { tx_ref, status, amount, meta }
            tx_ref = req.body.tx_ref || req.body.txRef;
            status = req.body.status;
            amount = req.body.amount;
            meta = req.body.meta;
        }

        console.log("Chapa callback extracted:", { tx_ref, status, amount, meta });

        if (status === 'successful' && tx_ref) {
            // Extract carId from meta (preferred) or verify payment to get meta
            let carId = null;
                let txRef = tx_ref;
            
            if (meta && meta.carId) {
                carId = meta.carId;
            } else {
                // Verify payment with Chapa to get full transaction details including meta and amount
                try {
                    const verifyResponse = await axios.get(
                        `${CHAPA_BASE_URL}/verify/${tx_ref}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
                            }
                        }
                    );

                    if (verifyResponse.data.status === 'success' && verifyResponse.data.data) {
                        const transaction = verifyResponse.data.data;
                        
                        // Extract amount if not already present
                        if (!amount && transaction.amount) {
                            amount = transaction.amount;
                        }
                        
                        // Extract meta if not already present
                        if (!meta && transaction.meta) {
                            meta = transaction.meta;
                        }
                        
                        if (transaction.meta && transaction.meta.carId) {
                            carId = transaction.meta.carId;
                        }
                        if (transaction.tx_ref) {
                            txRef = transaction.tx_ref;
                        }
                    }
                } catch (verifyError) {
                    console.error("Error verifying payment in callback:", verifyError);
                }
            }

            if (carId && Types.ObjectId.isValid(carId)) {
                const car = await ParkedCar.findById(carId);
                
                if (car && car.status === 'parked') {
                    car.status = 'checked_out';
                    car.checkedOutAt = new Date();
                    car.paymentMethod = 'online';
                    car.paymentReference = txRef || tx_ref;
                    if (amount) {
                        car.totalPaidAmount = parseFloat(amount);
                    }
                    await car.save();
                    console.log(`Car ${carId} checked out successfully via Chapa callback`);
                }
            } else if (txRef) {
                // Package payment path (payment-first, no carId)
                try {
                    const pending = await PendingPackagePayment.findOne({ txRef });
                    if (!pending) {
                        console.log(`Pending package payment not found for txRef: ${txRef}`);
                        return res.status(200).json({ received: true, message: "Callback processed" });
                    }
                    
                    const {
                        carData,
                        packageDuration,
                        amount: storedAmount,
                        valetId,
                        parkZoneCode
                    } = pending;

                    const licensePlate = `${carData.plateCode}-${carData.region}-${carData.licensePlateNumber}`.toUpperCase();

                    // Compute package start/end dates
                    const packageStartDate = new Date();
                    const packageEndDate = new Date(packageStartDate);
                    switch (packageDuration) {
                        case 'weekly':
                            packageEndDate.setDate(packageStartDate.getDate() + 7);
                            break;
                        case 'monthly':
                            packageEndDate.setMonth(packageStartDate.getMonth() + 1);
                            break;
                        case 'yearly':
                            packageEndDate.setFullYear(packageStartDate.getFullYear() + 1);
                            break;
                        default:
                            break;
                    }

                    const packageSubscriptionId = new Types.ObjectId();

                    const parkedCar = await ParkedCar.create({
                        licensePlate: licensePlate,
                        plateCode: carData.plateCode,
                        region: carData.region,
                        licensePlateNumber: carData.licensePlateNumber.toUpperCase(),
                        carType: carData.carType,
                        model: carData.model || '',
                        color: carData.color || '',
                        phoneNumber: carData.phoneNumber,
                        location: parkZoneCode || 'Unknown Zone',
                        notes: carData.notes || '',
                        serviceType: 'package',
                        packageDuration: packageDuration,
                        packageSubscriptionId,
                        packageStartDate,
                        packageEndDate,
                        valet_id: valetId,
                        status: 'parked',
                        paymentMethod: 'online',
                        paymentReference: txRef,
                        totalPaidAmount: amount ? parseFloat(amount) : (storedAmount || 0)
                    });

                    // Clean up pending payment from MongoDB
                    await PendingPackagePayment.deleteOne({ txRef });
                    console.log(`Package payment successful, car created with id ${parkedCar._id}`);
                } catch (err) {
                    console.error("Failed to create car from package payment callback:", err);
                }
            }
        }

        // Always return 200 to acknowledge receipt
        res.status(200).json({ received: true, message: "Callback processed" });
    } catch (error) {
        console.error("Chapa callback error:", error);
        res.status(200).json({ received: true }); // Still return 200 to prevent retries
    }
});

// Also handle GET requests for callback (in case Chapa redirects)
paymentRouter.get("/chapa/callback", async (req, res) => {
    try {
        const { tx_ref, status } = req.query;

        if (status === 'successful' && tx_ref) {
            // Verify payment to get meta data
            try {
                const verifyResponse = await axios.get(
                    `${CHAPA_BASE_URL}/verify/${tx_ref}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
                        }
                    }
                );

                if (verifyResponse.data.status === 'success' && verifyResponse.data.data) {
                    const transaction = verifyResponse.data.data;
                    const carId = transaction.meta?.carId;

                    if (carId && Types.ObjectId.isValid(carId)) {
                        const car = await ParkedCar.findById(carId);
                        
                        if (car && car.status === 'parked' && transaction.status === 'successful') {
                            car.status = 'checked_out';
                            car.checkedOutAt = new Date();
                            car.paymentMethod = 'online';
                            car.paymentReference = tx_ref;
                            if (transaction.amount) {
                                car.totalPaidAmount = transaction.amount;
                            }
                            await car.save();
                            console.log(`Car ${carId} checked out successfully via Chapa callback (GET)`);
                        }
                    } else if (transaction.tx_ref) {
                        // Package payment path (payment-first)
                        try {
                            const pending = await PendingPackagePayment.findOne({ txRef: transaction.tx_ref });
                            if (!pending) {
                                console.log(`Pending package payment not found for txRef: ${transaction.tx_ref}`);
                                return res.status(200).json({ received: true, message: "Callback processed" });
                            }
                            
                            const {
                                carData,
                                packageDuration,
                                amount: storedAmount,
                                valetId,
                                parkZoneCode
                            } = pending;

                            const licensePlate = `${carData.plateCode}-${carData.region}-${carData.licensePlateNumber}`.toUpperCase();

                            // Compute package start/end dates
                            const packageStartDate = new Date();
                            const packageEndDate = new Date(packageStartDate);
                            switch (packageDuration) {
                                case 'weekly':
                                    packageEndDate.setDate(packageStartDate.getDate() + 7);
                                    break;
                                case 'monthly':
                                    packageEndDate.setMonth(packageStartDate.getMonth() + 1);
                                    break;
                                case 'yearly':
                                    packageEndDate.setFullYear(packageStartDate.getFullYear() + 1);
                                    break;
                                default:
                                    break;
                            }

                            const packageSubscriptionId = new Types.ObjectId();

                            const parkedCar = await ParkedCar.create({
                                licensePlate: licensePlate,
                                plateCode: carData.plateCode,
                                region: carData.region,
                                licensePlateNumber: carData.licensePlateNumber.toUpperCase(),
                                carType: carData.carType,
                                model: carData.model || '',
                                color: carData.color || '',
                                phoneNumber: carData.phoneNumber,
                                location: parkZoneCode || 'Unknown Zone',
                                notes: carData.notes || '',
                                serviceType: 'package',
                                packageDuration: packageDuration,
                                packageSubscriptionId,
                                packageStartDate,
                                packageEndDate,
                                valet_id: valetId,
                                status: 'parked',
                                paymentMethod: 'online',
                                paymentReference: transaction.tx_ref,
                                totalPaidAmount: transaction.amount || storedAmount || 0
                            });

                            // Clean up pending payment from MongoDB
                            await PendingPackagePayment.deleteOne({ txRef: transaction.tx_ref });
                            console.log(`Package payment successful, car created with id ${parkedCar._id} (GET callback)`);
                        } catch (err) {
                            console.error("Failed to create car from package payment callback (GET):", err);
                        }
                    }
                }
            } catch (verifyError) {
                console.error("Error verifying payment in callback (GET):", verifyError);
            }
        }

        // Redirect to success page or return JSON
        res.status(200).json({ received: true, message: "Callback processed" });
    } catch (error) {
        console.error("Chapa callback error (GET):", error);
        res.status(200).json({ received: true });
    }
});

// Webhook endpoint for Chapa callbacks (optional but recommended)
paymentRouter.post("/chapa/webhook", async (req, res) => {
    try {
        const { tx_ref, status } = req.body;

        if (status === 'successful' && tx_ref) {
            // Extract carId from tx_ref
            const carIdMatch = tx_ref.match(/tana-([a-f0-9]{10,24})/);
            const carId = carIdMatch ? carIdMatch[1] : null;

            if (carId && Types.ObjectId.isValid(carId)) {
                const car = await ParkedCar.findById(carId);
                
                if (car && car.status === 'parked') {
                    car.status = 'checked_out';
                    car.checkedOutAt = new Date();
                    car.paymentMethod = 'online';
                    car.paymentReference = tx_ref;
                    await car.save();
                }
            }
        }

        // Always return 200 to acknowledge receipt
        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Chapa webhook error:", error);
        res.status(200).json({ received: true }); // Still return 200 to prevent retries
    }
});

module.exports = paymentRouter;

