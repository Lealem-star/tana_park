const { Router } = require("express");
const axios = require("axios");
const { isLoggedIn } = require("./middleware");
const ParkedCar = require("../models/parkedCarSchema");
const User = require("../models/userSchema");
const Joi = require('joi');
const { Types } = require("mongoose");

const paymentRouter = Router();

// Chapa API configuration
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || "CHASECK_TEST-xxxxxxxxxxxxx"; // Replace with your Chapa secret key
const CHAPA_PUBLIC_KEY = process.env.CHAPA_PUBLIC_KEY || ""; // Chapa public key for frontend
const CHAPA_BASE_URL = "https://api.chapa.co/v1/transaction";

// In-memory store for pending package payments (txRef -> payload)
const pendingPackagePayments = {};

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

        // Prepare Chapa payment request
        const chapaRequest = {
            amount: amount.toString(),
            currency: "ETB",
            first_name: customerName?.split(' ')[0] || "Customer",
            last_name: customerName?.split(' ').slice(1).join(' ') || "User",
            phone_number: customerPhone,
            tx_ref: `tana-${carId.substring(0, 10)}-${Date.now().toString().slice(-8)}`,
            callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
            return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?carId=${carId}`,
            meta: {
                carId: carId.toString(),
                licensePlate: car.licensePlate || `${car.plateCode || ''}-${car.region || ''}-${car.licensePlateNumber || ''}`,
            }
        };

        // Initialize payment with Chapa
        const chapaResponse = await axios.post(
            `${CHAPA_BASE_URL}/initialize`,
            chapaRequest,
            {
                headers: {
                    'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (chapaResponse.data.status === 'success' && chapaResponse.data.data) {
            // Store payment reference in car (optional - you might want a separate payment model)
            // For now, we'll just return the payment URL
            
            res.json({
                success: true,
                paymentUrl: chapaResponse.data.data.checkout_url,
                txRef: chapaRequest.tx_ref,
                publicKey: CHAPA_PUBLIC_KEY, // Include public key for frontend inline.js
                message: "Payment initialized successfully"
            });
        } else {
            // Extract error message from Chapa response
            const errorMessage = chapaResponse.data?.message;
            const errorText = typeof errorMessage === 'string' 
                ? errorMessage 
                : (typeof errorMessage === 'object' && errorMessage?.message)
                    ? errorMessage.message
                    : JSON.stringify(errorMessage) || "Failed to initialize payment with Chapa";
            
            res.status(400).json({ error: errorText });
        }
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

        // Build txRef without carId
        const txRef = `tana-pkg-${Date.now().toString().slice(-8)}`;

        // Store pending payload in memory
        pendingPackagePayments[txRef] = {
            carData,
            packageDuration,
            amount,
            valetId: currentUser._id,
            parkZoneCode: currentUser.parkZoneCode || 'Unknown Zone',
            createdAt: Date.now()
        };

        // Prepare Chapa payment request
        const chapaRequest = {
            amount: amount.toString(),
            currency: "ETB",
            first_name: "Customer",
            last_name: "Package",
            phone_number: customerPhone,
            tx_ref: txRef,
            callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/callback`,
            return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success?txRef=${txRef}`,
            meta: {
                txRef,
                serviceType: 'package',
                packageDuration
            }
        };

        const chapaResponse = await axios.post(
            `${CHAPA_BASE_URL}/initialize`,
            chapaRequest,
            {
                headers: {
                    'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (chapaResponse.data.status === 'success' && chapaResponse.data.data) {
            res.json({
                success: true,
                paymentUrl: chapaResponse.data.data.checkout_url,
                txRef: chapaRequest.tx_ref,
                publicKey: CHAPA_PUBLIC_KEY,
                message: "Package payment initialized successfully"
            });
        } else {
            const errorMessage = chapaResponse.data?.message;
            const errorText = typeof errorMessage === 'string'
                ? errorMessage
                : (typeof errorMessage === 'object' && errorMessage?.message)
                    ? errorMessage.message
                    : JSON.stringify(errorMessage) || "Failed to initialize payment with Chapa";
            res.status(400).json({ error: errorText });
        }
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
            
            // Handle pending transactions - return success with pending status for retry
            if (transaction.status === 'pending' || transaction.status === 'processing') {
                return res.json({
                    success: true,
                    transaction: {
                        status: transaction.status,
                        txRef: transaction.tx_ref || txRef,
                    },
                    message: "Payment is still processing. Please wait and try again."
                });
            }
            
            // Extract carId from tx_ref or meta
            const carIdMatch = transaction.tx_ref.match(/tana-parking-([a-f0-9]{24})/);
            const carId = carIdMatch ? carIdMatch[1] : null;

            if (carId && Types.ObjectId.isValid(carId)) {
                const car = await ParkedCar.findById(carId);
                
                if (car && transaction.status === 'successful') {
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
                            status: transaction.status,
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
                            status: transaction.status,
                            txRef: transaction.tx_ref,
                        },
                        message: transaction.status === 'successful' 
                            ? "Payment verified but car not found or already checked out" 
                            : "Payment not successful"
                    });
                }
            } else {
                res.json({
                    success: true,
                    transaction: {
                        status: transaction.status,
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

        const pending = pendingPackagePayments[txRef];
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

            // Handle pending transactions - return success with pending status for retry
            if (transaction.status === 'pending' || transaction.status === 'processing') {
                return res.json({
                    success: true,
                    transaction: {
                        status: transaction.status,
                        txRef: transaction.tx_ref || txRef,
                    },
                    message: "Payment is still processing. Please wait and try again."
                });
            }

            if (transaction.status === 'successful') {
                // Create the initial package subscription + first parked record
                const payload = pendingPackagePayments[txRef];
                const {
                    carData,
                    packageDuration,
                    amount,
                    valetId,
                    parkZoneCode
                } = payload;

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

                // Clean up pending
                delete pendingPackagePayments[txRef];

                res.json({
                    success: true,
                    transaction: {
                        status: transaction.status,
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
                        status: transaction.status,
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
            } else if (txRef && pendingPackagePayments[txRef]) {
                // Package payment path (payment-first, no carId)
                try {
                    const payload = pendingPackagePayments[txRef];
                    const {
                        carData,
                        packageDuration,
                        amount: storedAmount,
                        valetId,
                        parkZoneCode
                    } = payload;

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

                    delete pendingPackagePayments[txRef];
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
                    } else if (transaction.tx_ref && pendingPackagePayments[transaction.tx_ref]) {
                        // Package payment path (payment-first)
                        try {
                            const payload = pendingPackagePayments[transaction.tx_ref];
                            const {
                                carData,
                                packageDuration,
                                amount: storedAmount,
                                valetId,
                                parkZoneCode
                            } = payload;

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

                            delete pendingPackagePayments[transaction.tx_ref];
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

