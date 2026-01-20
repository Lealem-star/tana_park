import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createParkedCar, sendSmsNotification, fetchPricingSettings, initializePackagePayment, verifyChapaPackagePayment } from '../../api/api';
import '../../css/registerCar.scss';

// Default plate codes fallback (used if database is empty)
const defaultPlateCodes = [
    '01', '02', '03', '04', '05', 'police', 'AO', 'ተላላፊ', 'የእለት', 'DF', 'AU', 'AU-CD', 'UN', 'UN-CD', 'CD',
];

const regions = [
    'ET', 'AA', 'AF', 'AM', 'BG', 'DR', 'GM', 'HR', 'OR', 'SM', 'TG', 'SD', 'DE', 'ME', 'DM',
];

const carTypes = ['tripod', 'automobile', 'truck', 'trailer'];

const RegisterCar = () => {
    const user = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        plateCode: '',
        region: '', // New field for region
        licensePlateNumber: '', // New field for license plate number
        carType: '', // New field for car type
        model: '',
        color: '',
        phoneNumber: '',
        notes: ''
    });
    const [plateCodes, setPlateCodes] = useState(defaultPlateCodes);
    const [pricingSettings, setPricingSettings] = useState({}); // Store pricing settings for car types
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [showPackageModal, setShowPackageModal] = useState(false);
    const [serviceType, setServiceType] = useState(''); // 'hourly' or 'package'
    const [packageDuration, setPackageDuration] = useState(''); // 'weekly', 'monthly', 'yearly'
    const [showPaymentFormModal, setShowPaymentFormModal] = useState(false);
    const [packagePaymentAmount, setPackagePaymentAmount] = useState(0);
    const [packageTxRef, setPackageTxRef] = useState('');
    const chapaInstanceRef = useRef(null);

    // Fetch plate codes and pricing settings from database on component mount
    useEffect(() => {
        fetchPricingSettings({
            setPricingSettings: (data) => {
                // Store pricing settings with price levels structure
                // Structure: {priceLevels: {[name]: {carType: {hourly, weekly, monthly, yearly}}}}
                if (data && typeof data === 'object' && data.priceLevels) {
                    setPricingSettings(data);
                } else {
                    // Default fallback structure
                    setPricingSettings({
                        priceLevels: {}
                    });
                }
                
                // Extract plate codes from pricing settings (for backward compatibility)
                // If database has settings, use those keys; otherwise use defaults
                if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                    // Check if data has car type structure or plate code structure
                    const hasCarTypes = ['tripod', 'automobile', 'truck', 'trailer'].some(type => data[type]);
                    if (!hasCarTypes && !data.priceLevels) {
                        // Old format - plate codes
                        const codes = Object.keys(data);
                        setPlateCodes(codes);
                    } else {
                        // New format - keep using default codes for plate codes field
                        setPlateCodes(defaultPlateCodes);
                    }
                } else {
                    // Use default codes if database is empty
                    setPlateCodes(defaultPlateCodes);
                }
            }
        });
    }, []);

    // Calculate package fee based on valet's price level, car type and package duration
    const calculatePackageFee = (carType, duration) => {
        // Determine price level to use: valet's priceLevel or first available
        const valetPriceLevel = user?.priceLevel || null;
        const priceLevels = pricingSettings?.priceLevels || {};
        const priceLevelNames = Object.keys(priceLevels);

        const priceLevelToUse = valetPriceLevel && priceLevels[valetPriceLevel]
            ? valetPriceLevel
            : (priceLevelNames.length > 0 ? priceLevelNames[0] : null);

        if (!priceLevelToUse) return null;

        const carPricing = priceLevels[priceLevelToUse]?.[carType] || {};
        const packagePrice = carPricing[duration];

        if (packagePrice === undefined || packagePrice === null || isNaN(Number(packagePrice))) {
            return null;
        }

        const priceNumber = Number(packagePrice);
        const vatRate = 0.15;
        const vatAmount = Math.round(priceNumber * vatRate * 100) / 100;
        const totalWithVat = Math.round((priceNumber + vatAmount) * 100) / 100;

        return {
            totalWithVat,
            priceLevelUsed: priceLevelToUse
        };
    };

    const handleChange = (field, value) => {
        setFormData({ ...formData, [field]: value });
        setError('');
        setSuccess('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!formData.plateCode || !formData.region || !formData.licensePlateNumber || !formData.phoneNumber || !formData.carType) {
            setError('Please fill in all required fields');
            return;
        }

        // Show service subscription modal instead of directly creating car
        setShowServiceModal(true);
    };

    const handleServiceTypeSelect = (type) => {
        setServiceType(type);
        if (type === 'package') {
            // Show package duration selection modal
            setShowServiceModal(false);
            setShowPackageModal(true);
        } else {
            // Hourly service - clear package duration and proceed to create car and payment
            setPackageDuration('');
            setShowServiceModal(false);
            createCarAndProceedToPayment();
        }
    };

    const handlePackageDurationSelect = (duration) => {
        setPackageDuration(duration);
        setShowPackageModal(false);
        // Package is payment-first + inline modal (no car created yet)
        startPackageInlinePayment(duration);
    };

    const createCarAndProceedToPayment = (selectedPackageDuration = null) => {
        setLoading(true);
        const finalServiceType = serviceType || 'hourly';
        const finalPackageDuration = finalServiceType === 'package' 
            ? (selectedPackageDuration || packageDuration || null)
            : null;

        // Ensure packageDuration is a valid value or null
        const validatedPackageDuration = finalPackageDuration && ['weekly', 'monthly', 'yearly'].includes(finalPackageDuration)
            ? finalPackageDuration
            : null;

        // Hourly flow: create the car immediately
        createParkedCar({
            body: {
                plateCode: formData.plateCode,
                region: formData.region,
                licensePlateNumber: formData.licensePlateNumber,
                carType: formData.carType,
                model: formData.model,
                color: formData.color,
                phoneNumber: formData.phoneNumber,
                notes: formData.notes,
                serviceType: finalServiceType,
                packageDuration: validatedPackageDuration
            },
            token: user?.token,
            handleCreateParkedCarSuccess,
            handleCreateParkedCarFailure
        });
    };

    const handleCreateParkedCarSuccess = async (carData) => {
        // Package is handled payment-first, so we should never create a car here for package registrations.
        // (If it happens, treat it as hourly success.)

        // For hourly service, just show success message and redirect
        setSuccess('Car registered successfully!');

        // Construct SMS message
        const now = new Date();
        const parkingTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const parkingDate = now.toLocaleDateString();

        const smsMessage = `Dear customer,\nyour car (Plate Code: ${formData.plateCode}, License Plate Number: ${formData.licensePlateNumber}, Model: ${formData.model}) is now parked at Tana parking.\nParking started at ${parkingTime} on ${parkingDate}.\nThank you!`;

        // Send SMS notification
        try {
            await sendSmsNotification({
                phoneNumber: formData.phoneNumber,
                message: smsMessage,
                token: user?.token,
                handleSendSmsSuccess: () => console.log('SMS sent successfully'),
                handleSendSmsFailure: (smsError) => console.error('Failed to send SMS:', smsError)
            });
        } catch (smsError) {
            console.error('Error sending SMS notification:', smsError);
        }

        // Reset form
        resetForm();

        setTimeout(() => {
            navigate('/valet/cars');
        }, 1500);
    };

    const closePackagePaymentModal = () => {
        if (loading) return;
        if (chapaInstanceRef.current) {
            const container = document.getElementById('chapa-inline-form');
            if (container) container.innerHTML = '';
            chapaInstanceRef.current = null;
        }
        setShowPaymentFormModal(false);
        setPackageTxRef('');
        setPackagePaymentAmount(0);
    };

    const verifyPackageWithRetry = async (txRef, maxAttempts = 10, delayMs = 1200) => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // eslint-disable-next-line no-await-in-loop
                const result = await new Promise((resolve, reject) => {
                    verifyChapaPackagePayment({
                        txRef,
                        token: user?.token,
                        handleVerifySuccess: resolve,
                        handleVerifyFailure: reject
                    });
                });

                // Check if payment is successful
                if (result?.transaction?.status === 'successful') {
                    return result;
                }

                // If pending/processing, continue retrying
                if (result?.transaction?.status === 'pending' || result?.transaction?.status === 'processing') {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => setTimeout(r, delayMs));
                    continue;
                }

                // If failed status, throw error
                if (result?.transaction?.status === 'failed' || result?.transaction?.status === 'cancelled') {
                    throw new Error(result?.message || 'Payment failed or was cancelled.');
                }

                // Unknown status, continue retrying
                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => setTimeout(r, delayMs));
            } catch (error) {
                // If it's a network error or API error, continue retrying
                if (attempt < maxAttempts) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise((r) => setTimeout(r, delayMs));
                    continue;
                }
                // Last attempt failed
                throw error;
            }
        }
        throw new Error('Payment is still pending. Please wait a moment and try again.');
    };

    const startPackageInlinePayment = async (duration) => {
        try {
            setError('');
            setSuccess('');
            setLoading(true);

            const validatedDuration = ['weekly', 'monthly', 'yearly'].includes(duration) ? duration : null;
            if (!validatedDuration) {
                setError('Invalid package duration selected.');
                setLoading(false);
                return;
            }

            const feeInfo = calculatePackageFee(formData.carType, validatedDuration);
            if (!feeInfo?.totalWithVat || feeInfo.totalWithVat <= 0) {
                setError('Package pricing not configured or invalid. Please contact administrator.');
                setLoading(false);
                return;
            }

            if (!user?.priceLevel) {
                setError('Your account has no price level assigned. Please contact admin.');
                setLoading(false);
                return;
            }

            const carDataPayload = {
                plateCode: formData.plateCode,
                region: formData.region,
                licensePlateNumber: formData.licensePlateNumber,
                carType: formData.carType,
                model: formData.model,
                color: formData.color,
                phoneNumber: formData.phoneNumber,
                notes: formData.notes,
                priceLevel: user.priceLevel
            };

            await initializePackagePayment({
                amount: feeInfo.totalWithVat,
                packageDuration: validatedDuration,
                customerPhone: formData.phoneNumber,
                carData: carDataPayload,
                token: user?.token,
                handleInitSuccess: async (data) => {
                    const txRef = data?.txRef;
                    const chapaPublicKey = data?.publicKey || process.env.REACT_APP_CHAPA_PUBLIC_KEY;

                    if (!txRef) {
                        setError('Failed to initialize package payment (missing txRef).');
                        setLoading(false);
                        return;
                    }

                    if (!chapaPublicKey) {
                        setError('Chapa public key is not configured. Please contact administrator.');
                        setLoading(false);
                        return;
                    }

                    localStorage.setItem(`chapa_payment_pkg_${txRef}`, JSON.stringify({
                        txRef,
                        packageDuration: validatedDuration,
                        amount: feeInfo.totalWithVat,
                        carData: carDataPayload
                    }));

                    setPackageTxRef(txRef);
                    setPackagePaymentAmount(feeInfo.totalWithVat);
                    setShowPaymentFormModal(true);

                    // Wait for modal DOM render
                    setTimeout(async () => {
                        try {
                            // Clean up container
                            const container = document.getElementById('chapa-inline-form');
                            if (container) container.innerHTML = '';

                            let ChapaCheckout = window.ChapaCheckout;
                            if (!ChapaCheckout) {
                                let attempts = 0;
                                await new Promise((resolve, reject) => {
                                    const checkInterval = setInterval(() => {
                                        attempts++;
                                        if (window.ChapaCheckout) {
                                            clearInterval(checkInterval);
                                            ChapaCheckout = window.ChapaCheckout;
                                            resolve();
                                        } else if (attempts > 30) {
                                            clearInterval(checkInterval);
                                            reject(new Error('Chapa library failed to load'));
                                        }
                                    }, 100);
                                });
                            }

                            if (!ChapaCheckout) {
                                setError('Chapa payment library is not loaded. Please refresh the page.');
                                setShowPaymentFormModal(false);
                                setLoading(false);
                                return;
                            }

                            const chapa = new ChapaCheckout({
                                publicKey: chapaPublicKey,
                                amount: feeInfo.totalWithVat.toString(),
                                currency: 'ETB',
                                txRef,
                                phoneNumber: formData.phoneNumber,
                                availablePaymentMethods: ['telebirr', 'cbebirr', 'ebirr', 'mpesa'],
                                customizations: {
                                    buttonText: 'Pay Now',
                                },
                                callbackUrl: `${process.env.REACT_APP_BASE_URL || 'http://localhost:4000/'}payment/chapa/callback`,
                                returnUrl: `${window.location.origin}/payment/success?txRef=${txRef}`,
                                showFlag: true,
                                showPaymentMethodsNames: true,
                                onSuccessfulPayment: async () => {
                                    try {
                                        const verifyResult = await verifyPackageWithRetry(txRef);

                                        // Send SMS notification for package activation
                                        try {
                                            const carInfo = verifyResult?.car;
                                            const packageEndDateStr = carInfo?.packageEndDate;
                                            const packageDurationLabel = carInfo?.packageDuration || validatedDuration;

                                            let remainingDaysText = '';
                                            if (packageEndDateStr) {
                                                const now = new Date();
                                                const end = new Date(packageEndDateStr);
                                                const diffMs = end.getTime() - now.getTime();
                                                const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
                                                const endDisplay = end.toLocaleDateString();
                                                remainingDaysText = `Package expires on ${endDisplay} (${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining).`;
                                            }

                                            const licenseDisplay = `${formData.plateCode}-${formData.region}-${formData.licensePlateNumber}`;
                                            const smsMessage = `Dear customer,\nYour ${packageDurationLabel} parking package at Tana Parking is now active for car (Plate: ${licenseDisplay}, Model: ${formData.model}).\n${remainingDaysText}\nThank you!`;

                                            await sendSmsNotification({
                                                phoneNumber: formData.phoneNumber,
                                                message: smsMessage,
                                                token: user?.token,
                                                handleSendSmsSuccess: () => console.log('Package SMS sent successfully'),
                                                handleSendSmsFailure: (smsError) => console.error('Failed to send package SMS:', smsError)
                                            });
                                        } catch (smsErr) {
                                            console.error('Error sending package activation SMS:', smsErr);
                                        }

                                        localStorage.removeItem(`chapa_payment_pkg_${txRef}`);
                                        setSuccess('Package payment successful! Car registered.');
                                        closePackagePaymentModal();
                                        resetForm();
                                        setLoading(false);
                                        setTimeout(() => navigate('/valet/cars'), 800);
                                    } catch (verifyErr) {
                                        setError(verifyErr?.message || 'Payment succeeded but verification is still pending. Please wait and refresh.');
                                        setLoading(false);
                                    }
                                },
                                onPaymentFailure: (err) => {
                                    setError(err?.message || 'Payment failed. Please try again.');
                                    setLoading(false);
                                },
                                onClose: () => {
                                    closePackagePaymentModal();
                                    setLoading(false);
                                }
                            });

                            chapaInstanceRef.current = chapa;
                            chapa.initialize('chapa-inline-form');
                            setLoading(false);
                        } catch (inlineErr) {
                            console.error('Package inline payment init error:', inlineErr);
                            setError('Failed to load payment form. Please try again.');
                            setShowPaymentFormModal(false);
                            setLoading(false);
                        }
                    }, 100);
                },
                handleInitFailure: (errorMessage) => {
                    setError(errorMessage || 'Failed to initialize package payment');
                    setLoading(false);
                }
            });
        } catch (err) {
            console.error('startPackageInlinePayment error:', err);
            setError(err?.message || 'Failed to start package payment');
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            plateCode: '',
            region: '',
            licensePlateNumber: '',
            carType: '',
            model: '',
            color: '',
            phoneNumber: '',
            notes: ''
        });
        setServiceType('');
        setPackageDuration('');
        setLoading(false);
    };

    const handleCreateParkedCarFailure = (error) => {
        setError(error || 'Failed to register car');
        setLoading(false);
    };

    return (
        <div className="register-car">
            <div className="page-header">
                <h1>Register Parked Car</h1>
                <p>Record a new parked vehicle</p>
            </div>

            <div className="form-container">
                {success && <div className="alert alert-success">{success}</div>}
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Plate Code *</label>
                            <select
                                value={formData.plateCode}
                                onChange={(e) => handleChange('plateCode', e.target.value)}
                                required
                            >
                                <option value="" disabled>Select Plate Code</option>
                                {plateCodes.map((code) => (
                                    <option key={code} value={code}>
                                        {code}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Region *</label>
                            <select
                                value={formData.region}
                                onChange={(e) => handleChange('region', e.target.value)}
                                required
                            >
                                <option value="" disabled>Select Region</option>
                                {regions.map((regionCode) => (
                                    <option key={regionCode} value={regionCode}>
                                        {regionCode}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>License Plate Number *</label>
                            <input
                                type="text"
                                value={formData.licensePlateNumber}
                                onChange={(e) => handleChange('licensePlateNumber', e.target.value.toUpperCase())}
                                placeholder="A12345"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Car Type *</label>
                            <select
                                value={formData.carType}
                                onChange={(e) => handleChange('carType', e.target.value)}
                                required
                            >
                                <option value="" disabled>Select Car Type</option>
                                {carTypes.map((type) => (
                                    <option key={type} value={type}>
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Phone Number *</label>
                            <input
                                type="text"
                                value={formData.phoneNumber}
                                onChange={(e) => handleChange('phoneNumber', e.target.value)}
                                placeholder="e.g., 2519XXXXXXXX or 09XXXXXXXX"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Model</label>
                            <input
                                type="text"
                                value={formData.model}
                                onChange={(e) => handleChange('model', e.target.value)}
                                placeholder="Camry, Civic, etc."
                            />
                        </div>

                        <div className="form-group">
                            <label>Color</label>
                            <input
                                type="text"
                                value={formData.color}
                                onChange={(e) => handleChange('color', e.target.value)}
                                placeholder="Red, Blue, Black, etc."
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Notes (Optional)</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            placeholder="Additional notes about the vehicle..."
                            rows="3"
                        />
                    </div>

                    <div className="form-actions">
                        <button 
                            type="button" 
                            className="btn-cancel"
                            onClick={() => navigate('/valet/dashboard')}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn-submit"
                            disabled={loading}
                        >
                            {loading ? 'Registering...' : 'Register Car'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Service Subscription Modal */}
            {showServiceModal && (
                <div 
                    className="modal-overlay" 
                    onClick={() => setShowServiceModal(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 3000
                    }}
                >
                    <div 
                        className="modal-content" 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'white',
                            borderRadius: '12px',
                            width: '90%',
                            maxWidth: '500px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                            padding: '0'
                        }}
                    >
                        <div style={{ padding: '24px', borderBottom: '1px solid #e0e0e0' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '600', color: '#333' }}>
                                Select Service Type
                            </h3>
                            <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                                Choose the service type for this vehicle
                            </p>
                        </div>
                        
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', gap: '1rem', flexDirection: 'row' }}>
                                <button 
                                    type="button"
                                    className="btn-service hourly"
                                    onClick={() => handleServiceTypeSelect('hourly')}
                                    style={{ 
                                        flex: 1,
                                        padding: '12px 20px', 
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        borderRadius: '8px',
                                        border: '2px solid #667eea',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                                    }}
                                >
                                    Hourly Service
                                </button>
                                <button 
                                    type="button"
                                    className="btn-service package"
                                    onClick={() => handleServiceTypeSelect('package')}
                                    style={{ 
                                        flex: 1,
                                        padding: '12px 20px', 
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        borderRadius: '8px',
                                        border: '2px solid #667eea',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                                    }}
                                >
                                    Package Service
                                </button>
                            </div>
                        </div>

                        <div style={{ 
                            padding: '20px 24px', 
                            borderTop: '1px solid #e0e0e0',
                            display: 'flex',
                            justifyContent: 'flex-end'
                        }}>
                            <button 
                                className="btn-cancel" 
                                onClick={() => setShowServiceModal(false)}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: '1px solid #e0e0e0',
                                    background: '#f5f7fa',
                                    color: '#666',
                                    cursor: 'pointer',
                                    fontWeight: '500',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.background = '#e0e0e0';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = '#f5f7fa';
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Package Duration Selection Modal */}
            {showPackageModal && (
                <div 
                    className="modal-overlay" 
                    onClick={() => setShowPackageModal(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 3000
                    }}
                >
                    <div 
                        className="modal-content" 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'white',
                            borderRadius: '12px',
                            width: '90%',
                            maxWidth: '500px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                            padding: '0'
                        }}
                    >
                        <div style={{ padding: '24px', borderBottom: '1px solid #e0e0e0' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '600', color: '#333' }}>
                                Select Package Duration
                            </h3>
                            <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                                Choose the package duration for this vehicle
                            </p>
                        </div>
                        
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <button 
                                    type="button"
                                    className="btn-package weekly"
                                    onClick={() => handlePackageDurationSelect('weekly')}
                                    style={{ 
                                        width: '100%',
                                        padding: '16px 24px', 
                                        fontSize: '16px',
                                        fontWeight: '600',
                                        borderRadius: '8px',
                                        border: '2px solid #667eea',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                                    }}
                                >
                                    Weekly
                                </button>
                                <button 
                                    type="button"
                                    className="btn-package monthly"
                                    onClick={() => handlePackageDurationSelect('monthly')}
                                    style={{ 
                                        width: '100%',
                                        padding: '16px 24px', 
                                        fontSize: '16px',
                                        fontWeight: '600',
                                        borderRadius: '8px',
                                        border: '2px solid #667eea',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                                    }}
                                >
                                    Monthly
                                </button>
                                <button 
                                    type="button"
                                    className="btn-package yearly"
                                    onClick={() => handlePackageDurationSelect('yearly')}
                                    style={{ 
                                        width: '100%',
                                        padding: '16px 24px', 
                                        fontSize: '16px',
                                        fontWeight: '600',
                                        borderRadius: '8px',
                                        border: '2px solid #667eea',
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.transform = 'translateY(0)';
                                        e.target.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.3)';
                                    }}
                                >
                                    Yearly
                                </button>
                            </div>
                        </div>

                        <div style={{ 
                            padding: '20px 24px', 
                            borderTop: '1px solid #e0e0e0',
                            display: 'flex',
                            justifyContent: 'flex-end'
                        }}>
                            <button 
                                className="btn-cancel" 
                                onClick={() => {
                                    setShowPackageModal(false);
                                    setShowServiceModal(true);
                                }}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    border: '1px solid #e0e0e0',
                                    background: '#f5f7fa',
                                    color: '#666',
                                    cursor: 'pointer',
                                    fontWeight: '500',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    e.target.style.background = '#e0e0e0';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = '#f5f7fa';
                                }}
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Package Payment Form Modal (Chapa inline) */}
            {showPaymentFormModal && (
                <div className="payment-modal-overlay" onClick={closePackagePaymentModal}>
                    <div className="payment-form-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Complete Package Payment</h2>
                            <button className="close-btn" onClick={closePackagePaymentModal} disabled={loading}>
                                ×
                            </button>
                        </div>
                        <div className="modal-content">
                            <div className="payment-summary-section">
                                <h3>Payment Summary</h3>
                                <div className="summary-row">
                                    <span className="label">Total Amount:</span>
                                    <span className="value">{Number(packagePaymentAmount || 0).toFixed(2)} ETB</span>
                                </div>
                                <div className="summary-row">
                                    <span className="label">Phone Number:</span>
                                    <span className="value">{formData.phoneNumber || 'N/A'}</span>
                                </div>
                                <div className="summary-row">
                                    <span className="label">Reference:</span>
                                    <span className="value">{packageTxRef || 'N/A'}</span>
                                </div>
                            </div>
                            <div className="chapa-payment-form-section">
                                <h3>Pay Online</h3>
                                <div id="chapa-inline-form"></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RegisterCar;

