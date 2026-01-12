const { Router } = require("express");
const axios = require("axios");
const { isLoggedIn } = require("./middleware");
const ParkedCar = require("../models/parkedCarSchema");
const Joi = require('joi');
const { Types } = require("mongoose");

const paymentRouter = Router();

// Chapa API configuration
const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || "CHASECK_TEST-xxxxxxxxxxxxx"; // Replace with your Chapa secret key
const CHAPA_PUBLIC_KEY = process.env.CHAPA_PUBLIC_KEY || ""; // Chapa public key for frontend
const CHAPA_BASE_URL = "https://api.chapa.co/v1/transaction";

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

// Verify Chapa payment
paymentRouter.get("/chapa/verify/:txRef", isLoggedIn, async (req, res) => {
    try {
        const { txRef } = req.params;

        if (!txRef) {
            return res.status(400).json({ error: "Transaction reference is required" });
        }

        // Verify payment with Chapa
        const chapaResponse = await axios.get(
            `${CHAPA_BASE_URL}/verify/${txRef}`,
            {
                headers: {
                    'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
                }
            }
        );

        if (chapaResponse.data.status === 'success' && chapaResponse.data.data) {
            const transaction = chapaResponse.data.data;
            
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
            res.status(400).json({ error: "Payment verification failed" });
        }
    } catch (error) {
        console.error("Chapa payment verification error:", error);
        res.status(500).json({ 
            error: error?.response?.data?.message || "Failed to verify payment" 
        });
    }
});

// Callback endpoint for Chapa payment results (used by Inline.js)
// This endpoint handles both POST (webhook) and GET (redirect) requests
paymentRouter.post("/chapa/callback", async (req, res) => {
    try {
        const { tx_ref, status, amount, meta } = req.body;

        console.log("Chapa callback received:", { tx_ref, status, amount, meta });

        if (status === 'successful' && tx_ref) {
            // Extract carId from meta (preferred) or verify payment to get meta
            let carId = null;
            
            if (meta && meta.carId) {
                carId = meta.carId;
            } else {
                // Verify payment with Chapa to get full transaction details including meta
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
                        
                        if (transaction.meta && transaction.meta.carId) {
                            carId = transaction.meta.carId;
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
                    car.paymentReference = tx_ref;
                    if (amount) {
                        car.totalPaidAmount = parseFloat(amount);
                    }
                    await car.save();
                    console.log(`Car ${carId} checked out successfully via Chapa callback`);
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

