import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchParkedCars, updateParkedCar, sendSmsNotification, initializeChapaPayment, fetchDailyStats, fetchPricingSettings } from '../../api/api';
import { EthiopianDatePicker } from '../../components';
import { CheckCircle, Clock, X, Car } from 'lucide-react';
import '../../css/parkedCarsList.scss';
import '../../css/valetOverview.scss';

const ParkedCarsList = () => {
    const { t } = useTranslation();
    const user = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [cars, setCars] = useState([]);
    const [filter, setFilter] = useState('all'); // all, parked, checked_out
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
    const [selectedCar, setSelectedCar] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showPaymentFormModal, setShowPaymentFormModal] = useState(false);
    const [feeDetails, setFeeDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const chapaInstanceRef = useRef(null);
    const lastChapaErrorRef = useRef(null); // Store last Chapa API error response
    const [dailyStats, setDailyStats] = useState({
        totalParked: 0,
        checkedOut: 0,
        stillParked: 0,
        onlinePayments: 0,
    });

    const [pricingSettings, setPricingSettings] = useState({});

    const loadCars = useCallback(() => {
        if (!user?.token) return;
        const status = filter !== 'all' ? filter : null;
        fetchParkedCars({ 
            token: user.token, 
            status,
            date: selectedDate,
            setParkedCars: setCars 
        });
    }, [user?.token, filter, selectedDate]);

    useEffect(() => {
        if (user?.token) {
            loadCars();
            // Fetch daily statistics for the selected date
            fetchDailyStats({ token: user.token, date: selectedDate, setDailyStats });
        }
        // Fetch pricing settings (no auth required)
        fetchPricingSettings({
            setPricingSettings: (data) => {
                // Store pricing settings as-is (car type based structure)
                // Structure: {carType: {hourly: price, weekly: price, monthly: price, yearly: price}}
                if (data && typeof data === 'object') {
                    setPricingSettings(data);
                } else {
                    // Default fallback for car types
                    setPricingSettings({
                        tripod: { hourly: 50, weekly: 0, monthly: 0, yearly: 0 },
                        automobile: { hourly: 50, weekly: 0, monthly: 0, yearly: 0 },
                        truck: { hourly: 75, weekly: 0, monthly: 0, yearly: 0 },
                        trailer: { hourly: 100, weekly: 0, monthly: 0, yearly: 0 }
                    });
                }
                // Store VAT rate from backend
                if (data && data.vatRate !== undefined) {
                    // Store in component state if needed, or use directly
                    window.vatRate = data.vatRate;
                } else {
                    window.vatRate = 0.15; // Default
                }
            }
        });
    }, [user, filter, selectedDate, loadCars]);


    const calculateFee = (car) => {
        const parkedAt = new Date(car.parkedAt);
        const now = new Date();

        // Duration in minutes and human readable text
        const diffMs = now - parkedAt;
        const totalMinutes = Math.max(1, Math.round(diffMs / (1000 * 60))); // Minimum 1 minute
        const durationHours = Math.floor(totalMinutes / 60);
        const durationMins = totalMinutes % 60;
        const durationText = `${durationHours} Hours ${durationMins} Min`;
        
        // Get valet's price level from car (valet_id is populated)
        const valetPriceLevel = car.valet_id?.priceLevel || null;
        const carType = car.carType || 'automobile';
        
        // Get pricing from price level structure: pricingSettings.priceLevels[priceLevel][carType]
        let carPricing = {};
        if (valetPriceLevel && pricingSettings?.priceLevels && pricingSettings.priceLevels[valetPriceLevel]) {
            carPricing = pricingSettings.priceLevels[valetPriceLevel][carType] || {};
        } else {
            // Fallback: try first available price level or use defaults
            const priceLevelNames = pricingSettings?.priceLevels ? Object.keys(pricingSettings.priceLevels) : [];
            if (priceLevelNames.length > 0) {
                carPricing = pricingSettings.priceLevels[priceLevelNames[0]][carType] || {};
            }
        }
        
        let parkingFee = 0;
        let pricePerHour = 0;

        // Check if car has package service
        if (car.serviceType === 'package' && car.packageDuration) {
            // Package service - use package price from price level
            const packagePrice = carPricing[car.packageDuration] || 0;
            parkingFee = packagePrice;
            pricePerHour = 0; // Not applicable for packages
        } else {
            // Hourly service - calculate based on time parked
            pricePerHour = carPricing.hourly || 50; // Default fallback
        const hoursParked = totalMinutes / 60;
            parkingFee = Math.round((hoursParked * pricePerHour) * 100) / 100;
        }

        // Get VAT rate from backend settings (stored in window.vatRate) or use default
        const vatRate = window.vatRate || 0.15;
        const vatAmount = Math.round(parkingFee * vatRate * 100) / 100;
        const totalWithVat = Math.round((parkingFee + vatAmount) * 100) / 100;

        return {
            hoursParked: totalMinutes / 60,
            pricePerHour,
            parkingFee,
            vatAmount,
            totalWithVat,
            durationText,
            parkedAt: parkedAt.toLocaleString(),
            checkedOutAt: now.toLocaleString(),
            serviceType: car.serviceType || 'hourly',
            packageDuration: car.packageDuration || null
        };
    };

    const handleStatusChange = (car, status) => {
        if (status === 'checked_out') {
            // Show payment form modal directly for online payment
            const fee = calculateFee(car);
            setSelectedCar(car);
            setFeeDetails(fee);
            handlePaymentMethod('online');
        } else {
            // Show confirmation modal for other status changes
            setSelectedCar(car);
            setNewStatus(status);
            setShowStatusModal(true);
        }
    };

    const confirmStatusChange = () => {
        if (selectedCar && newStatus) {
            updateParkedCar({
                id: selectedCar._id,
                body: { status: newStatus },
                token: user.token,
                handleUpdateParkedCarSuccess: () => {
                    loadCars();
                    fetchDailyStats({ token: user.token, date: selectedDate, setDailyStats });
                    setShowStatusModal(false);
                    setSelectedCar(null);
                },
                handleUpdateParkedCarFailure: (error) => {
                    alert(error || 'Failed to update status');
                }
            });
        }
    };

    const handlePaymentMethod = async (paymentMethod) => {
        if (!selectedCar || !feeDetails) return;

        setLoading(true);
        
        try {
            // Clean up any existing payment data and Chapa instances to prevent txRef reuse
            if (chapaInstanceRef.current) {
                const container = document.getElementById('chapa-inline-form');
                if (container) {
                    container.innerHTML = '';
                }
                chapaInstanceRef.current = null;
            }
            // Clear old localStorage entries for this car to ensure fresh payment
            localStorage.removeItem(`chapa_payment_${selectedCar._id}`);
            // Clear any stored error from previous attempts
            lastChapaErrorRef.current = null;
                
            // Initialize Chapa payment for online payment
                const customerName = selectedCar.customerName || 'Customer';
                const customerEmail = selectedCar.customerEmail || `${selectedCar.phoneNumber}@tana-parking.com`;
                const customerPhone = selectedCar.phoneNumber;

                await initializeChapaPayment({
                    carId: selectedCar._id,
                    amount: feeDetails.totalWithVat,
                    customerName: customerName,
                    customerEmail: customerEmail,
                    customerPhone: customerPhone,
                    token: user?.token,
                    handleInitSuccess: async (data) => {
                        // Store payment reference for later verification
                        localStorage.setItem(`chapa_payment_${selectedCar._id}`, JSON.stringify({
                            txRef: data.txRef,
                            carId: selectedCar._id,
                            feeDetails: feeDetails,
                            customerPhone: selectedCar.phoneNumber || customerPhone
                        }));

                        // Get Chapa public key from API response or environment variables
                        // Backend should provide publicKey in the response, fallback to env variable
                        const chapaPublicKey = data.publicKey || process.env.REACT_APP_CHAPA_PUBLIC_KEY;
                        
                        console.log('Chapa config check:', {
                            hasPublicKey: !!chapaPublicKey,
                            publicKeyLength: chapaPublicKey?.length,
                            txRef: data.txRef,
                            txRefLength: data.txRef?.length,
                            txRefTimestamp: data.txRef ? new Date().toISOString() : null,
                            amount: feeDetails.totalWithVat,
                            customerPhone: customerPhone
                        });
                        console.log('✅ Backend generated NEW txRef:', data.txRef);
                        
                        if (!chapaPublicKey) {
                            console.error('Chapa public key is not configured. Please add CHAPA_PUBLIC_KEY to backend .env or REACT_APP_CHAPA_PUBLIC_KEY to frontend .env');
                            alert('Payment system is not configured. Please contact administrator.');
                            setLoading(false);
                            return;
                        }
                        
                        // Validate public key format
                        console.log('🔑 Public key received from backend:', chapaPublicKey ? `${chapaPublicKey.substring(0, 20)}...` : 'MISSING');
                        console.log('🔑 Full public key length:', chapaPublicKey?.length);
                        console.log('🔑 Public key source:', data.publicKey ? 'Backend API response' : 'Frontend env variable');
                        
                        const isValidTestKey = chapaPublicKey.startsWith('CHAPUBK_TEST-');
                        const isValidLiveKey = chapaPublicKey.startsWith('CHAPUBK-');
                        if (!isValidTestKey && !isValidLiveKey) {
                            console.error('❌ Public key format is INCORRECT!');
                            console.error('Expected format: CHAPUBK_TEST-... (test) or CHAPUBK-... (live)');
                            console.error('Current key starts with:', chapaPublicKey.substring(0, 15));
                            console.error('Full key:', chapaPublicKey);
                            alert('Invalid public key format. Please check your CHAPA_PUBLIC_KEY in backend .env file.');
                            setLoading(false);
                            return;
                        } else {
                            console.log('✅ Public key format is valid:', isValidTestKey ? 'TEST MODE' : 'LIVE MODE');
                        }
                        
                        if (!data.txRef) {
                            console.error('Missing txRef from payment initialization');
                            alert('Payment initialization failed. Missing transaction reference.');
                            setLoading(false);
                            return;
                        }

                        // Initialize Chapa Inline.js
                        try {
                            // Clean up any existing instance
                            if (chapaInstanceRef.current) {
                                const container = document.getElementById('chapa-inline-form');
                                if (container) {
                                    container.innerHTML = '';
                                }
                            }

                            // Get ChapaCheckout from window (loaded via CDN) or try to import
                            let ChapaCheckout;
                            
                            if (window.ChapaCheckout) {
                                ChapaCheckout = window.ChapaCheckout;
                            } else {
                                // Wait for script to load (max 3 seconds)
                                let attempts = 0;
                                await new Promise((resolve, reject) => {
                                    const checkInterval = setInterval(() => {
                                        attempts++;
                                        if (window.ChapaCheckout) {
                                            clearInterval(checkInterval);
                                            ChapaCheckout = window.ChapaCheckout;
                                            resolve();
                                        } else if (attempts > 30) { // 3 seconds max
                                            clearInterval(checkInterval);
                                            reject(new Error('Chapa library failed to load'));
                                        }
                                    }, 100);
                                });
                            }
                            
                            if (!ChapaCheckout) {
                                alert('Chapa payment library is not loaded. Please refresh the page.');
                                setLoading(false);
                                return;
                            }

                            // Verify ChapaCheckout is the correct constructor
                            console.log('ChapaCheckout type:', typeof ChapaCheckout);
                            console.log('ChapaCheckout:', ChapaCheckout);
                            console.log('window.ChapaCheckout:', window.ChapaCheckout);
                            
                            // Check if Chapa script loaded correctly
                            if (typeof ChapaCheckout !== 'function') {
                                console.error('ChapaCheckout is not a function!', ChapaCheckout);
                                alert('Chapa library is not properly loaded. Please refresh the page.');
                                setLoading(false);
                                return;
                            }

                            // Validate and format amount
                            const amountNum = parseFloat(feeDetails.totalWithVat);
                            if (isNaN(amountNum) || amountNum <= 0) {
                                throw new Error(`Invalid amount: ${feeDetails.totalWithVat}`);
                            }
                            // Chapa Inline.js expects amount as a string with 2 decimal places
                            const formattedAmount = amountNum.toFixed(2);
                            
                            // Validate phone number format
                            // CRITICAL: Chapa test mode requires LOCAL format with leading 0 (0900112233)
                            // Chapa Inline.js strips the leading 0 if we pass E.164 format (+251900112233)
                            // So for test mode, we MUST use local format (0900112233)
                            const isTestMode = chapaPublicKey.startsWith('CHAPUBK_TEST-');
                            let formattedPhone = customerPhone;
                            
                            if (isTestMode) {
                                // TEST MODE: Use local format with leading 0 (0900112233)
                                // Ensure phone starts with 0 for Ethiopian numbers
                                if (formattedPhone.startsWith('+251')) {
                                    // Convert E.164 to local: +251900112233 -> 0900112233
                                    formattedPhone = '0' + formattedPhone.substring(4);
                                } else if (!formattedPhone.startsWith('0')) {
                                    // Add leading 0 if missing: 900112233 -> 0900112233
                                    formattedPhone = '0' + formattedPhone;
                                }
                                // Keep as-is if already in local format (0900112233)
                            } else {
                                // LIVE MODE: Use E.164 format (+251900112233)
                                if (formattedPhone && !formattedPhone.startsWith('+')) {
                                    // Convert local to E.164: 0900112233 -> +251900112233
                                    formattedPhone = formattedPhone.replace(/^0/, '+251');
                                    if (!formattedPhone.startsWith('+')) {
                                        formattedPhone = `+251${formattedPhone}`;
                                    }
                                }
                            }
                            
                            // Log phone number format for debugging
                            console.log('📱 Phone number formatting:', {
                                original: customerPhone,
                                formatted: formattedPhone,
                                format: formattedPhone.startsWith('+') ? 'E.164' : formattedPhone.startsWith('0') ? 'Local' : 'Other',
                                isTestMode: isTestMode,
                                note: isTestMode ? 'Using LOCAL format (0...) for Chapa test mode' : 'Using E.164 format (+251...) for live mode'
                            });
                            
                            const generatedEmail = `${formattedPhone.replace(/[^0-9]/g, '')}@tana-parking.com`;

                            // Chapa Inline.js configuration - using camelCase (primary format)
                            // Chapa Inline.js accepts camelCase and converts internally as needed
                            const chapaConfig = {
                                // Public key (required)
                                publicKey: chapaPublicKey,
                                
                                // Transaction reference (required)
                                txRef: data.txRef,
                                
                                // Amount and currency (required)
                                amount: formattedAmount, // Must be string
                                currency: 'ETB',
                                
                                // Customer information (required)
                                phoneNumber: formattedPhone,
                                firstName: 'Customer',
                                lastName: 'User',
                                email: generatedEmail,
                                
                                // Payment methods (optional - restricts available methods)
                                availablePaymentMethods: ['telebirr', 'cbebirr', 'ebirr', 'mpesa'],
                                
                                // UI customizations (optional)
                                customizations: {
                                    title: 'Tana Parking Payment',
                                    description: `Parking fee payment for ${selectedCar.licensePlate || 'your vehicle'}`,
                                    buttonText: 'Pay Now',
                                    styles: `
                                        .chapa-pay-button { 
                                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                            color: white;
                                            border: none;
                                            padding: 16px 24px;
                                            border-radius: 10px;
                                            font-size: 16px;
                                            font-weight: 700;
                                            cursor: pointer;
                                            width: 100%;
                                            transition: all 0.3s ease;
                                        }
                                        .chapa-pay-button:hover {
                                            transform: translateY(-2px);
                                            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
                                        }
                                    `
                                },
                                
                                // Callback URLs (optional but recommended)
                                callbackUrl: `${window.location.origin}/payment/callback`,
                                returnUrl: `${window.location.origin}/payment/success?carId=${selectedCar._id}`,
                                
                                // UI options (optional)
                                showFlag: true,
                                showPaymentMethodsNames: true,
                                
                                // JavaScript callbacks (Chapa Inline.js supports these)
                                onSuccessfulPayment: async (response) => {
                                    console.log('✅ Payment successful (onSuccessfulPayment):', response);
                                    // Update car status after successful payment
                                    await updateParkedCar({
                                        id: selectedCar._id,
                                        body: {
                                            status: 'checked_out',
                                            checkedOutAt: new Date().toISOString(),
                                            paymentMethod: 'online',
                                            totalPaidAmount: feeDetails.totalWithVat,
                                        },
                                        token: user?.token,
                                        handleUpdateParkedCarSuccess: async () => {
                                            // Send SMS to customer
                                            let smsMessage = '';

                                            if (selectedCar.serviceType === 'package' && selectedCar.packageDuration) {
                                                // Package checkout SMS with remaining days
                                                let remainingDaysText = '';
                                                if (selectedCar.packageEndDate) {
                                                    const now = new Date();
                                                    const end = new Date(selectedCar.packageEndDate);
                                                    const diffMs = end.getTime() - now.getTime();
                                                    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                                                    const endDisplay = end.toLocaleDateString();
                                                    remainingDaysText = `Package expires on ${endDisplay} (${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining).`;
                                                }

                                                const licenseDisplay = selectedCar.licensePlate || `${selectedCar.plateCode || ''}-${selectedCar.region || ''}-${selectedCar.licensePlateNumber || ''}`;
                                                smsMessage = `Thank you for using Tana Parking services!\nYour package car (${licenseDisplay}) has checked out.\nPackage type: ${selectedCar.packageDuration}.\n${remainingDaysText}`;
                                            } else {
                                                // Hourly checkout SMS (existing behavior)
                                            const totalMinutes = Math.round(feeDetails.hoursParked * 60);
                                            const durationDisplay = totalMinutes >= 60 
                                                ? `${Math.floor(totalMinutes / 60)} hour${Math.floor(totalMinutes / 60) > 1 ? 's' : ''} ${totalMinutes % 60 > 0 ? `${totalMinutes % 60} min` : ''}`.trim()
                                                : `${totalMinutes} min`;
                                                smsMessage = `Thank you for using Tana Parking services! Your car (${selectedCar.licensePlate || `${selectedCar.plateCode || ''}-${selectedCar.region || ''}-${selectedCar.licensePlateNumber || ''}`}) has been received.\nParking fee: ${feeDetails.parkingFee.toFixed(2)} ETB\nVAT (15%): ${feeDetails.vatAmount.toFixed(2)} ETB\nTotal: ${feeDetails.totalWithVat.toFixed(2)} ETB (${durationDisplay} × ${feeDetails.pricePerHour} ETB/hour).\nPayment method: Online Payment.`;
                                            }
                                            
                                            await sendSmsNotification({
                                                phoneNumber: selectedCar.phoneNumber,
                                                message: smsMessage,
                                                token: user?.token,
                                                handleSendSmsSuccess: () => {
                                                    console.log('SMS sent successfully');
                                                },
                                                handleSendSmsFailure: (error) => {
                                                    console.error('Failed to send SMS:', error);
                                                }
                                            });

                                            // Refresh cars list and stats
                                            loadCars();
                                            fetchDailyStats({ token: user.token, date: selectedDate, setDailyStats });

                                            setShowPaymentFormModal(false);
                                            setSelectedCar(null);
                                            setFeeDetails(null);
                                            setLoading(false);
                                        },
                                        handleUpdateParkedCarFailure: (error) => {
                                            console.error('Failed to update car:', error);
                                            alert('Payment successful but failed to update car status. Please contact support.');
                                            setLoading(false);
                                        }
                                    });
                                },
                                onPaymentFailure: (error) => {
                                    console.error('❌ Payment failed - error received:', error);
                                    
                                    // Get detailed error from stored API response
                                    const storedError = lastChapaErrorRef.current;
                                    let chapaDetailedMessage = null;
                                    
                                    if (storedError) {
                                        // Extract detailed message from Chapa's API response structure
                                        chapaDetailedMessage = storedError?.data?.meta?.message || 
                                                             storedError?.message;
                                        console.error('❌ Payment failed - Chapa API error details:', storedError);
                                    }
                                    
                                    // Try to extract from error object if available
                                    if (!chapaDetailedMessage) {
                                        if (error?.data?.meta?.message) {
                                            chapaDetailedMessage = error.data.meta.message;
                                        } else if (error?.data?.data?.meta?.message) {
                                            chapaDetailedMessage = error.data.data.meta.message;
                                        } else if (error?.response?.data?.data?.meta?.message) {
                                            chapaDetailedMessage = error.response.data.data.meta.message;
                                        } else if (error?.response?.data?.meta?.message) {
                                            chapaDetailedMessage = error.response.data.meta.message;
                                        }
                                    }
                                    
                                    // Clean up on failure to ensure fresh txRef on retry
                                    if (selectedCar?._id) {
                                        localStorage.removeItem(`chapa_payment_${selectedCar._id}`);
                                    }
                                    if (chapaInstanceRef.current) {
                                        const container = document.getElementById('chapa-inline-form');
                                        if (container) {
                                            container.innerHTML = '';
                                        }
                                        chapaInstanceRef.current = null;
                                    }
                                    
                                    // Clear stored error after use
                                    lastChapaErrorRef.current = null;
                                    
                                    // Extract error message - prioritize Chapa's detailed message
                                    let errorMessage = chapaDetailedMessage || 
                                                     error?.message || 
                                                     (typeof error === 'string' ? error : 'Payment failed. Please try again.');
                                    
                                    // Add helpful context for common test mode errors
                                    const errorMsgLower = errorMessage.toLowerCase();
                                    const phoneNumber = selectedCar?.phoneNumber || 'N/A';
                                    
                                    if (errorMsgLower.includes('invalid test number') || 
                                        errorMsgLower.includes('invalid otp') || 
                                        errorMsgLower.includes('payment method')) {
                                        let helpText = '\n\n⚠️ TEST MODE REQUIREMENTS:\n';
                                        helpText += `• Phone number used: ${phoneNumber}\n`;
                                        helpText += '• Valid test numbers:\n';
                                        helpText += '  - telebirr/cbebirr/ebirr: 0900112233, 0900123456, 0900881111\n';
                                        helpText += '  - mpesa: 0700112233, 0700123456, 0700881111\n';
                                        helpText += '• Make sure the payment method matches the phone number prefix:\n';
                                        helpText += '  - 09xxx = telebirr/cbebirr/ebirr\n';
                                        helpText += '  - 07xxx = mpesa\n';
                                        helpText += '• Check your Chapa dashboard to ensure payment methods are enabled for test mode';
                                        errorMessage += helpText;
                                    }
                                    
                                    alert(`Payment failed: ${errorMessage}`);
                                    setLoading(false);
                                },
                                onClose: () => {
                                    console.log('🔒 Payment modal closed');
                                    setShowPaymentFormModal(false);
                                    setLoading(false);
                                },
                                onPaymentClose: () => {
                                    console.log('🔒 Payment modal closed (onPaymentClose)');
                                    setShowPaymentFormModal(false);
                                    setLoading(false);
                                }
                            };
                            
                            console.log('Chapa config being passed:', {
                                publicKey: chapaPublicKey ? `${chapaPublicKey.substring(0, 20)}...` : 'MISSING',
                                publicKeyFull: chapaPublicKey, // Full key for debugging
                                amount: formattedAmount,
                                amountType: typeof formattedAmount,
                                currency: chapaConfig.currency,
                                txRef: chapaConfig.txRef,
                                tx_ref: chapaConfig.tx_ref,
                                txRefLength: chapaConfig.txRef?.length,
                                phoneNumber: formattedPhone,
                                phone_number: chapaConfig.phone_number,
                                firstName: chapaConfig.firstName,
                                first_name: chapaConfig.first_name,
                                lastName: chapaConfig.lastName,
                                last_name: chapaConfig.last_name,
                                email: chapaConfig.email,
                                callbackUrl: chapaConfig.callbackUrl,
                                callback_url: chapaConfig.callback_url,
                                returnUrl: chapaConfig.returnUrl,
                                return_url: chapaConfig.return_url,
                                hasOnSuccessfulPayment: !!chapaConfig.onSuccessfulPayment,
                                hasOnPaymentFailure: !!chapaConfig.onPaymentFailure,
                                hasOnClose: !!chapaConfig.onClose
                            });
                            
                            // Log the exact config object that will be passed to ChapaCheckout
                            console.log('📋 Full Chapa config object (for debugging):', JSON.stringify({
                                ...chapaConfig,
                                publicKey: chapaPublicKey ? `${chapaPublicKey.substring(0, 15)}...` : 'MISSING',
                                onSuccessfulPayment: '[Function]',
                                onPaymentFailure: '[Function]',
                                onClose: '[Function]'
                            }, null, 2));
                            
                            // Validate public key format: Inline.js must use CHAPUBK_* (public key).
                            if (!chapaPublicKey || (!chapaPublicKey.startsWith('CHAPUBK_TEST-') && !chapaPublicKey.startsWith('CHAPUBK_LIVE-'))) {
                                console.error('Invalid Chapa PUBLIC key format. Inline.js requires CHAPUBK_TEST-* or CHAPUBK_LIVE-*');
                                console.error('Current key prefix:', chapaPublicKey ? chapaPublicKey.slice(0, 12) : 'MISSING');
                                alert('Payment configuration error: invalid Chapa public key. Please contact administrator.');
                                setLoading(false);
                                return;
                            }
                            
                            // Log full config for debugging (mask sensitive data)
                            console.log('Full Chapa config (masked):', {
                                ...chapaConfig,
                                publicKey: chapaPublicKey ? `${chapaPublicKey.substring(0, 15)}...` : 'MISSING',
                                onSuccessfulPayment: chapaConfig.onSuccessfulPayment ? '[Function]' : 'MISSING',
                                onPaymentFailure: chapaConfig.onPaymentFailure ? '[Function]' : 'MISSING',
                                onClose: chapaConfig.onClose ? '[Function]' : 'MISSING'
                            });
                            
                            try {
                                // Validate config before creating ChapaCheckout instance
                                const requiredFields = ['publicKey', 'amount', 'currency', 'txRef', 'email', 'firstName', 'lastName'];
                                const missingFields = requiredFields.filter(field => !chapaConfig[field] && !chapaConfig[field.replace(/([A-Z])/g, '_$1').toLowerCase()]);
                                
                                if (missingFields.length > 0) {
                                    console.error('❌ Missing required Chapa fields:', missingFields);
                                    alert(`Payment configuration error: Missing required fields (${missingFields.join(', ')}). Please contact support.`);
                                    setLoading(false);
                                    return;
                                }
                                
                                console.log('✅ All required Chapa fields present');
                                console.log('🔧 Creating ChapaCheckout instance with config keys:', Object.keys(chapaConfig));
                                console.log('🔑 Public key in config (public_key):', chapaConfig.public_key ? `${chapaConfig.public_key.substring(0, 20)}...` : 'MISSING');
                                console.log('🔑 Full public key value:', chapaConfig.public_key);
                                
                                const chapa = new ChapaCheckout(chapaConfig);
                            chapaInstanceRef.current = chapa;
                                
                                console.log('✅ ChapaCheckout instance created successfully');
                                console.log('🔑 Chapa instance internal options:', {
                                    publicKey: chapa.options?.public_key || chapa.options?.publicKey || 'NOT FOUND',
                                    public_key: chapa.options?.public_key || 'NOT FOUND',
                                    hasPublicKey: !!(chapa.options?.public_key || chapa.options?.publicKey)
                                });
                            
                            // Open payment form modal
                            setShowPaymentFormModal(true);
                            
                            // Wait for DOM to update, then initialize Chapa
                            setTimeout(() => {
                                const container = document.getElementById('chapa-inline-form');
                                if (container) {
                                        console.log('Initializing Chapa Inline.js...');
                                        console.log('Container element:', container);
                                        console.log('Chapa instance:', chapa);
                                        
                                        try {
                                            // Monitor both XMLHttpRequest and fetch (Chapa might use either)
                                            const originalXHROpen = XMLHttpRequest.prototype.open;
                                            const originalXHRSend = XMLHttpRequest.prototype.send;
                                            const originalFetch = window.fetch;
                                            
                                            // Monitor XMLHttpRequest
                                            XMLHttpRequest.prototype.open = function(method, url, ...args) {
                                                if (url && (url.includes('chapa') || url.includes('inline.chapaservices'))) {
                                                    console.log('🔍 [XHR] Chapa API Request:', method, url);
                                                    this._chapaUrl = url;
                                                    this._chapaMethod = method;
                                                }
                                                return originalXHROpen.apply(this, [method, url, ...args]);
                                            };
                                            
                                            XMLHttpRequest.prototype.send = function(data) {
                                                if (this._chapaUrl) {
                                                    console.log('📤 [XHR] Chapa Request Data:', data ? (typeof data === 'string' ? data : JSON.stringify(data)) : 'No data');
                                                    
                                                    this.addEventListener('load', function() {
                                                        console.log('📥 [XHR] Chapa Response Status:', this.status, this.statusText);
                                                        console.log('📥 [XHR] Chapa Response URL:', this._chapaUrl);
                                                        try {
                                                            const responseText = this.responseText;
                                                            console.log('📥 [XHR] Chapa Response Body:', responseText);
                                                            if (responseText) {
                                                                try {
                                                                    const jsonResponse = JSON.parse(responseText);
                                                                    console.log('📥 [XHR] Chapa Response JSON:', jsonResponse);
                                                                } catch (e) {
                                                                    console.log('📥 [XHR] Chapa Response (not JSON):', responseText);
                                                                }
                                                            }
                                                        } catch (e) {
                                                            console.error('Error reading Chapa response:', e);
                                                        }
                                                    });
                                                    
                                                    this.addEventListener('error', function() {
                                                        console.error('❌ [XHR] Chapa Request Error:', this._chapaUrl);
                                                    });
                                                }
                                                return originalXHRSend.apply(this, [data]);
                                            };
                                            
                                            // Monitor fetch
                                            window.fetch = function(url, options = {}) {
                                                if (typeof url === 'string' && (url.includes('chapa') || url.includes('inline.chapaservices'))) {
                                                    console.log('🔍 [FETCH] Chapa API Request:', url);
                                                    console.log('📤 [FETCH] Chapa Request Method:', options.method || 'GET');
                                                    
                                                    // Parse and log the request body
                                                    if (options.body) {
                                                        try {
                                                            let bodyData;
                                                            if (typeof options.body === 'string') {
                                                                console.log('📤 [FETCH] Request body is string, length:', options.body.length);
                                                                bodyData = JSON.parse(options.body);
                                                            } else if (options.body instanceof FormData) {
                                                                console.log('📤 [FETCH] Request body is FormData');
                                                                bodyData = {};
                                                                for (let [key, value] of options.body.entries()) {
                                                                    bodyData[key] = value;
                                                                }
                                                            } else {
                                                                bodyData = options.body;
                                                            }
                                                            
                                                            console.log('📤 [FETCH] Chapa Request Body (parsed):', bodyData);
                                                            console.log('📤 [FETCH] Request body keys:', Object.keys(bodyData));
                                                            
                                                            // Log ALL FormData values for debugging
                                                            console.log('📋 [FETCH] Full FormData values:', Object.entries(bodyData).map(([k, v]) => {
                                                                const valueStr = typeof v === 'string' ? (v.length > 100 ? v.substring(0, 100) + '...' : v) : JSON.stringify(v);
                                                                return `${k}: ${valueStr}`;
                                                            }).join(', '));
                                                            
                                                            // Log phone number specifically
                                                            const phoneInBody = bodyData.phone_number || bodyData.phoneNumber || bodyData.phone || bodyData.mobile;
                                                            if (phoneInBody) {
                                                                console.log('📱 [FETCH] Phone number being sent:', phoneInBody);
                                                                console.log('📱 [FETCH] Phone number format:', phoneInBody.startsWith('+') ? 'E.164 (+251...)' : phoneInBody.startsWith('0') ? 'Local (0...)' : 'Other');
                                                                console.log('📱 [FETCH] Phone number length:', phoneInBody.length);
                                                            } else {
                                                                console.warn('⚠️ [FETCH] Phone number not found in request body!');
                                                                console.log('📤 [FETCH] Available keys:', Object.keys(bodyData));
                                                                console.log('📤 [FETCH] Full body values:', Object.entries(bodyData).map(([k, v]) => `${k}: ${typeof v === 'string' ? v.substring(0, 50) : v}`));
                                                            }
                                                            
                                                            // Log payment method being used
                                                            const paymentMethod = bodyData.payment_method || bodyData.paymentMethod || bodyData.method || bodyData.type;
                                                            if (paymentMethod) {
                                                                console.log('💳 [FETCH] Payment method being sent:', paymentMethod);
                                                            } else {
                                                                console.warn('⚠️ [FETCH] Payment method not found in request body!');
                                                            }
                                                            
                                                            // Check public key in request body (optional - key is usually in headers)
                                                            const publicKeyInBody = bodyData.public_key || bodyData.publicKey;
                                                            if (publicKeyInBody) {
                                                                console.log('🔑 [FETCH] Public key found in request body:', publicKeyInBody.substring(0, 20) + '...');
                                                            } else {
                                                                // This is normal - Chapa Inline.js sends public key in Authorization header, not body
                                                                console.log('ℹ️ [FETCH] Public key not in request body (normal - sent in Authorization header instead)');
                                                            }
                                                        } catch (e) {
                                                            console.error('❌ [FETCH] Error parsing request body:', e);
                                                            console.log('📤 [FETCH] Chapa Request Body (raw, unparsed):', options.body);
                                                        }
                                                    } else {
                                                        console.warn('⚠️ [FETCH] No request body found!');
                                                    }
                                                    
                                                    console.log('📤 [FETCH] Chapa Request Headers:', options.headers);
                                                    
                                                    // Check if public key is in headers
                                                    if (options.headers) {
                                                        const headersObj = options.headers instanceof Headers 
                                                            ? Object.fromEntries(options.headers.entries())
                                                            : options.headers;
                                                        console.log('📤 [FETCH] Headers object:', headersObj);
                                                        const authHeader = headersObj['Authorization'] || headersObj['authorization'] || headersObj['x-public-key'] || headersObj['X-Public-Key'];
                                                        if (authHeader) {
                                                            console.log('🔑 [FETCH] Public key found in headers:', authHeader);
                                                        }
                                                    }
                                                    
                                                    return originalFetch.apply(this, arguments)
                                                        .then(response => {
                                                            console.log('📥 [FETCH] Chapa Response Status:', response.status, response.statusText);
                                                            console.log('📥 [FETCH] Chapa Response URL:', response.url);
                                                            
                                                            // Clone response to read body without consuming it
                                                            const clonedResponse = response.clone();
                                                            clonedResponse.text().then(text => {
                                                                console.log('📥 [FETCH] Chapa Response Status:', response.status);
                                                                console.log('📥 [FETCH] Chapa Response Body (raw):', text);
                                                                
                                                                try {
                                                                    const jsonResponse = JSON.parse(text);
                                                                    console.log('📥 [FETCH] Chapa Response JSON:', jsonResponse);
                                                                    console.log('📥 [FETCH] Chapa Response keys:', Object.keys(jsonResponse));
                                                                    
                                                                    // Log ALL error details
                                                                    if (jsonResponse.message) {
                                                                        console.error('❌ [FETCH] Chapa Error Message:', jsonResponse.message);
                                                                    }
                                                                    if (jsonResponse.error) {
                                                                        console.error('❌ [FETCH] Chapa Error:', jsonResponse.error);
                                                                    }
                                                                    if (jsonResponse.status) {
                                                                        console.error('❌ [FETCH] Chapa Status:', jsonResponse.status);
                                                                    }
                                                                    if (jsonResponse.data) {
                                                                        console.error('❌ [FETCH] Chapa Data:', jsonResponse.data);
                                                                    }
                                                                    
                                                                    // Log the full response for debugging
                                                                    console.error('❌ [FETCH] FULL CHAPA ERROR RESPONSE:', JSON.stringify(jsonResponse, null, 2));
                                                                    
                                                                    // Store error response for error handler
                                                                    if (jsonResponse.status === 'failed' || jsonResponse.message) {
                                                                        lastChapaErrorRef.current = jsonResponse;
                                                                    }
                                                                } catch (e) {
                                                                    // Not JSON, that's okay - log as text
                                                                    console.error('❌ [FETCH] Chapa Response (not JSON, raw text):', text);
                                                                }
                                                            }).catch(err => {
                                                                console.error('❌ Error reading fetch response:', err);
                                                            });
                                                            
                                                            return response;
                                                        })
                                                        .catch(error => {
                                                            console.error('❌ [FETCH] Chapa Request Error:', error);
                                                            throw error;
                                                        });
                                                }
                                                return originalFetch.apply(this, arguments);
                                            };
                                            
                                    chapa.initialize('chapa-inline-form');
                                            console.log('Chapa initialize() called successfully');
                                            
                                            // Restore original functions after a delay
                                            setTimeout(() => {
                                                XMLHttpRequest.prototype.open = originalXHROpen;
                                                XMLHttpRequest.prototype.send = originalXHRSend;
                                                window.fetch = originalFetch;
                                            }, 15000);
                                            
                                    setLoading(false);
                                        } catch (initError) {
                                            console.error('Error during chapa.initialize():', initError);
                                            console.error('Init error details:', {
                                                message: initError?.message,
                                                stack: initError?.stack,
                                                name: initError?.name,
                                                cause: initError?.cause
                                            });
                                            alert(`Failed to initialize payment form: ${initError?.message || 'Unknown error'}`);
                                            setShowPaymentFormModal(false);
                                            setLoading(false);
                                        }
                                } else {
                                    console.error('Chapa container not found after rendering');
                                    alert('Failed to load payment form. Please try again.');
                                    setShowPaymentFormModal(false);
                                    setLoading(false);
                                }
                            }, 100);
                            } catch (initError) {
                                console.error('ChapaCheckout constructor error:', initError);
                                console.error('Error details:', {
                                    message: initError?.message,
                                    stack: initError?.stack,
                                    name: initError?.name
                                });
                                alert(`Failed to initialize payment: ${initError?.message || 'Unknown error'}`);
                                setShowPaymentFormModal(false);
                                setLoading(false);
                            }
                        } catch (error) {
                            console.error('Failed to initialize Chapa Inline:', error);
                            alert('Failed to load payment form. Please try again.');
                            setLoading(false);
                        }
                    },
                    handleInitFailure: (error) => {
                        console.error('Failed to initialize Chapa payment:', error);
                        alert(`Failed to initialize payment: ${error}`);
                        setLoading(false);
                    }
                });
        } catch (error) {
            console.error('Error processing payment:', error);
            alert('An error occurred. Please try again.');
            setLoading(false);
        }
    };

    const handleClosePaymentModal = () => {
        if (!loading) {
            setShowPaymentModal(false);
            setSelectedCar(null);
            setFeeDetails(null);
        }
    };

    const handleClosePaymentFormModal = () => {
        if (!loading) {
            // Clean up Chapa instance
            if (chapaInstanceRef.current) {
                const container = document.getElementById('chapa-inline-form');
                if (container) {
                    container.innerHTML = '';
                }
                chapaInstanceRef.current = null;
            }
            setShowPaymentFormModal(false);
        }
    };


    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'checked_out':
                return <CheckCircle size={18} />;
            default:
                return <Clock size={18} />;
        }
    };


    return (
        <div className="parked-cars-list">
            <div className="page-header">
                <h1>{t('valet.parkedCars')}</h1>
                <button 
                    className="btn-primary"
                    onClick={() => navigate('/valet/register-car')}
                >
                    {t('valet.registerNewCar')}
                </button>
            </div>

            <div className="filters">
                <div className="filter-buttons">
                    <button 
                        className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        {t('valet.all')}
                    </button>
                    <button 
                        className={`filter-btn ${filter === 'parked' ? 'active' : ''}`}
                        onClick={() => setFilter('parked')}
                    >
                        {t('valet.parked')}
                    </button>
                    <button 
                        className={`filter-btn ${filter === 'checked_out' ? 'active' : ''}`}
                        onClick={() => setFilter('checked_out')}
                    >
                        {t('valet.checkedOut')}
                    </button>
                </div>
                <div className="date-selector">
                    {/* <label>Select Date:</label> */}
                    <EthiopianDatePicker
                        value={selectedDate}
                        onChange={(date) => setSelectedDate(date)}
                        label="Select Date"
                    />
                </div>
            </div>

            <div className="stats-grid">
                <div className="stat-card stat-total">
                    <div className="stat-icon"><Car size={14} /></div>
                    <div className="stat-content">
                        <h3>{dailyStats.totalParked}</h3>
                        <p>{t('valet.totalParked')}</p>
                    </div>
                </div>
                <div className="stat-card stat-parked">
                    <div className="stat-icon"><Clock size={14} /></div>
                    <div className="stat-content">
                        <h3>{dailyStats.stillParked}</h3>
                        <p>{t('valet.stillParked')}</p>
                    </div>
                </div>
                <div className="stat-card stat-checked">
                    <div className="stat-icon"><CheckCircle size={14} /></div>
                    <div className="stat-content">
                        <h3>{dailyStats.checkedOut}</h3>
                        <p>{t('valet.checkedOut')}</p>
                    </div>
                </div>
            </div>

            <div className="cars-table-container">
                {cars.length > 0 ? (
                    <table className="cars-table">
                        <thead>
                            <tr>
                                <th>{t('valet.licensePlate')}</th>
                                <th>{t('valet.vehicle')}</th>
                                <th>{t('valet.parkedAt')}</th>
                                <th>{t('valet.checkedOutAt')}</th>
                                <th>{t('valet.parkingFee')}</th>
                                <th>{t('valet.status')}</th>
                                <th>{t('valet.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cars.map((car) => (
                                <tr key={car._id}>
                                    <td className="license-plate">{car.licensePlate}</td>
                                    <td>
                                        <div className="vehicle-info">
                                            <strong>{car.model}</strong>
                                            <span className="color">{car.color}</span>
                                        </div>
                                    </td>
                                    <td>{formatDateTime(car.parkedAt)}</td>
                                    <td>{car.checkedOutAt ? formatDateTime(car.checkedOutAt) : '-'}</td>
                                    <td>{car.status === 'checked_out' ? `${car.totalPaidAmount?.toFixed(2) || '0.00'} ETB` : `${calculateFee(car).totalWithVat.toFixed(2)} ETB`}</td>
                                    <td>
                                        <span className={`badge badge-${car.status}`}>
                                            {getStatusIcon(car.status)}
                                            {car.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="actions">
                                            {car.status === 'parked' && (
                                                <button
                                                    className="btn-action btn-checkout"
                                                    onClick={() => handleStatusChange(car, 'checked_out')}
                                                >
                                                    {t('valet.checkOut')}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="no-data">
                        <p>{t('valet.noParkedCars')}</p>
                        <button 
                            className="btn-primary"
                            onClick={() => navigate('/valet/register-car')}
                        >
                            {t('valet.registerFirstCar')}
                        </button>
                    </div>
                )}
            </div>

            {/* Status Change Modal */}
            {showStatusModal && (
                <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>{t('valet.changeStatus')}</h3>
                        <p>{t('messages.confirmDelete')} <strong>{newStatus.replace('_', ' ')}</strong>?</p>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowStatusModal(false)}>
                                {t('common.cancel')}
                            </button>
                            <button className="btn-confirm" onClick={confirmStatusChange}>
                                {t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedCar && feeDetails && (
                <div className="payment-modal-overlay" onClick={handleClosePaymentModal}>
                    <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{t('valet.parkedOut')} - {t('valet.paymentDetails')}</h2>
                            <button className="close-btn" onClick={handleClosePaymentModal} disabled={loading}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="modal-content">
                            <div className="parking-details-section">
                                <h3>Parking Detail</h3>
                                <div className="detail-row">
                                    <span className="label">Parking Zone:</span>
                                    <span className="value">{selectedCar.location || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="vehicle-details-section">
                                <h3>Vehicle Detail</h3>
                                <div className="detail-row">
                                    <span className="label">Phone Number:</span>
                                    <span className="value">{selectedCar.phoneNumber || 'N/A'}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Plate Number:</span>
                                    <span className="value">{selectedCar.licensePlate || `${selectedCar.plateCode || ''}-${selectedCar.region || ''}-${selectedCar.licensePlateNumber || ''}`}</span>
                                </div>
                            </div>

                            <div className="duration-section">
                                <h3>Duration</h3>
                                <div className="detail-row">
                                    <span className="label">Start Time:</span>
                                    <span className="value">{feeDetails.parkedAt}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">End Time:</span>
                                    <span className="value">{feeDetails.checkedOutAt}</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">Duration:</span>
                                    <span className="value">{feeDetails.durationText}</span>
                                </div>
                            </div>

                            <div className="payment-details-section">
                                <h3>Payment Detail</h3>
                                <div className="detail-row">
                                    <span className="label">Parking Fee:</span>
                                    <span className="value">{feeDetails.parkingFee.toFixed(2)} ETB</span>
                                </div>
                                <div className="detail-row">
                                    <span className="label">VAT (15%):</span>
                                    <span className="value">{feeDetails.vatAmount.toFixed(2)} ETB</span>
                                </div>
                                <div className="detail-row total-fee">
                                    <span className="label">Total:</span>
                                    <span className="value">{feeDetails.totalWithVat.toFixed(2)} ETB</span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Payment Form Modal - Separate modal for Chapa inline payment */}
            {showPaymentFormModal && selectedCar && feeDetails && (
                <div className="payment-modal-overlay" onClick={handleClosePaymentFormModal}>
                    <div className="payment-form-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Complete Payment</h2>
                            <button 
                                className="close-btn" 
                                onClick={handleClosePaymentFormModal} 
                                disabled={loading}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="modal-content">
                            <div className="payment-summary-section">
                                <h3>Payment Summary</h3>
                                <div className="summary-row">
                                    <span className="label">Total Amount:</span>
                                    <span className="value">{feeDetails.totalWithVat.toFixed(2)} ETB</span>
                                </div>
                                <div className="summary-row">
                                    <span className="label">Phone Number:</span>
                                    <span className="value">{selectedCar.phoneNumber || 'N/A'}</span>
                                </div>
                            </div>

                            <div className="chapa-payment-form-section">
                                <h3>Complete Payment Online</h3>
                                <div id="chapa-inline-form"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ParkedCarsList;

