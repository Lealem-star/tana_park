import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { verifyChapaPayment, verifyChapaPackagePayment, sendSmsNotification } from '../../api/api';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import '../../css/paymentCallback.scss';

const PaymentCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const user = useSelector((state) => state.user);
    const [paymentStatus, setPaymentStatus] = useState('verifying'); // verifying, success, failed
    const [message, setMessage] = useState('Verifying payment...');

    useEffect(() => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

        const verifyWithRetry = async ({ verifyFn, txRef, token, maxAttempts = 10, delayMs = 1200 }) => {
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    const result = await new Promise((resolve, reject) => {
                        verifyFn({
                            txRef,
                            token,
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
                        setMessage(`Payment is processing... (attempt ${attempt}/${maxAttempts})`);
                        // eslint-disable-next-line no-await-in-loop
                        await sleep(delayMs);
                        continue;
                    }

                    // If failed status, throw error
                    if (result?.transaction?.status === 'failed' || result?.transaction?.status === 'cancelled') {
                        throw new Error(result?.message || 'Payment failed or was cancelled.');
                    }

                    // Unknown status, continue retrying
                    setMessage(`Verifying payment... (attempt ${attempt}/${maxAttempts})`);
                    // eslint-disable-next-line no-await-in-loop
                    await sleep(delayMs);
                } catch (error) {
                    // If it's a network error or API error, continue retrying
                    if (attempt < maxAttempts) {
                        setMessage(`Payment verification error... Retrying (attempt ${attempt}/${maxAttempts})`);
                        // eslint-disable-next-line no-await-in-loop
                        await sleep(delayMs);
                        continue;
                    }
                    // Last attempt failed
                    throw error;
                }
            }
            throw new Error('Payment is still processing. Please wait a moment and refresh this page.');
        };

        const verifyPayment = async () => {
            // Get identifiers
            const urlCarId = searchParams.get('carId');
            const txRef = searchParams.get('tx_ref') || searchParams.get('txRef');

            if (!urlCarId && !txRef) {
                setPaymentStatus('failed');
                setMessage('Payment reference not found. Please contact support.');
                return;
            }

            // Try to get payment info from localStorage
            let paymentInfo = null;
            if (urlCarId) {
                const stored = localStorage.getItem(`chapa_payment_${urlCarId}`);
                if (stored) {
                    paymentInfo = JSON.parse(stored);
                }
            } else if (txRef) {
                const storedPkg = localStorage.getItem(`chapa_payment_pkg_${txRef}`);
                if (storedPkg) {
                    paymentInfo = JSON.parse(storedPkg);
                }
            }

            const refToVerify = txRef || paymentInfo?.txRef;

            if (!refToVerify || !user?.token) {
                setPaymentStatus('failed');
                setMessage('Unable to verify payment. Please contact support.');
                return;
            }

            try {
                // Choose verification path: package vs hourly
                const verifyFn = urlCarId ? verifyChapaPayment : verifyChapaPackagePayment;

                const data = await verifyWithRetry({ verifyFn, txRef: refToVerify, token: user.token });

                if (data.transaction?.status === 'successful') {
                    setPaymentStatus('success');
                    setMessage(urlCarId ? 'Payment successful! Your car has been checked out.' : 'Payment successful! Your package car has been registered.');

                    // Send SMS notification (if car info and payment info available)
                    if (data.car && paymentInfo && paymentInfo.amount && paymentInfo.packageDuration) {
                        const carPhoneNumber = data.car.phoneNumber || '';
                        if (carPhoneNumber) {
                            const smsMessage = `Dear customer,\nThank you for using Tana Parking services! Your car (${data.car.licensePlate || 'N/A'}) has been registered.\nPackage: ${paymentInfo.packageDuration}\nTotal Paid: ${paymentInfo.amount} ETB.\nPayment Reference: ${refToVerify}.`;

                            await sendSmsNotification({
                                phoneNumber: carPhoneNumber,
                                message: smsMessage,
                                token: user.token,
                                handleSendSmsSuccess: () => {
                                    console.log('SMS sent successfully');
                                },
                                handleSendSmsFailure: (error) => {
                                    console.error('Failed to send SMS:', error);
                                }
                            });
                        }
                    }

                    // Clean up localStorage
                    if (urlCarId) {
                        localStorage.removeItem(`chapa_payment_${urlCarId}`);
                    }
                    if (refToVerify) {
                        localStorage.removeItem(`chapa_payment_pkg_${refToVerify}`);
                    }

                    // Redirect to dashboard after 3 seconds
                    setTimeout(() => {
                        navigate('/valet/dashboard');
                    }, 3000);
                } else {
                    setPaymentStatus('failed');
                    setMessage('Payment verification failed. Please contact support.');
                }
            } catch (error) {
                console.error('Error verifying payment:', error);
                setPaymentStatus('failed');
                setMessage(error?.message || 'An error occurred while verifying payment. Please contact support.');
            }
        };

        if (user?.token) {
            verifyPayment();
        } else {
            setPaymentStatus('failed');
            setMessage('Please log in to verify payment.');
        }
    }, [searchParams, user, navigate]);

    return (
        <div className="payment-callback">
            <div className="payment-status-card">
                {paymentStatus === 'verifying' && (
                    <>
                        <Loader className="status-icon verifying" size={64} />
                        <h2>Verifying Payment...</h2>
                        <p>{message}</p>
                    </>
                )}
                {paymentStatus === 'success' && (
                    <>
                        <CheckCircle className="status-icon success" size={64} />
                        <h2>Payment Successful!</h2>
                        <p>{message}</p>
                        <p className="redirect-message">Redirecting to dashboard...</p>
                        <button 
                            className="btn-primary"
                            onClick={() => navigate('/valet/dashboard')}
                        >
                            Go to Dashboard
                        </button>
                    </>
                )}
                {paymentStatus === 'failed' && (
                    <>
                        <XCircle className="status-icon failed" size={64} />
                        <h2>Payment Verification Failed</h2>
                        <p>{message}</p>
                        <button 
                            className="btn-primary"
                            onClick={() => navigate('/valet/dashboard')}
                        >
                            Go to Dashboard
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default PaymentCallback;

