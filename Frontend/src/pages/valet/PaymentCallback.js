import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { verifyChapaPayment, sendSmsNotification } from '../../api/api';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import '../../css/paymentCallback.scss';

const PaymentCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const user = useSelector((state) => state.user);
    const [paymentStatus, setPaymentStatus] = useState('verifying'); // verifying, success, failed
    const [message, setMessage] = useState('Verifying payment...');

    useEffect(() => {
        const verifyPayment = async () => {
            // Get carId from URL params
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
            }

            const refToVerify = txRef || paymentInfo?.txRef;

            if (!refToVerify || !user?.token) {
                setPaymentStatus('failed');
                setMessage('Unable to verify payment. Please contact support.');
                return;
            }

            try {
                // Verify payment with backend
                await verifyChapaPayment({
                    txRef: refToVerify,
                    token: user.token,
                    handleVerifySuccess: async (data) => {
                        if (data.transaction?.status === 'successful') {
                            setPaymentStatus('success');
                            setMessage('Payment successful! Your car has been checked out.');

                            // Send SMS notification
                            if (data.car) {
                                // Fetch the car to get phone number
                                const carPhoneNumber = data.car.phoneNumber || '';
                                if (carPhoneNumber && paymentInfo) {
                                const smsMessage = `Dear customer,\nThank you for using Tana Parking services! Your car (${data.car.licensePlate || 'N/A'}) has been received.\nParking fee: ${paymentInfo.feeDetails.parkingFee} ETB\nVAT (15%): ${paymentInfo.feeDetails.vatAmount} ETB\nTotal: ${paymentInfo.feeDetails.totalWithVat} ETB (${paymentInfo.feeDetails.hoursParked} hour${paymentInfo.feeDetails.hoursParked > 1 ? 's' : ''} × ${paymentInfo.feeDetails.pricePerHour} ETB/hour).\nPayment method: Online (Chapa).\nPayment Reference: ${refToVerify}.`;
                                    
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

                            // Redirect to dashboard after 3 seconds
                            setTimeout(() => {
                                navigate('/valet/dashboard');
                            }, 3000);
                        } else {
                            setPaymentStatus('failed');
                            setMessage('Payment verification failed. Please contact support.');
                        }
                    },
                    handleVerifyFailure: (error) => {
                        console.error('Payment verification failed:', error);
                        setPaymentStatus('failed');
                        setMessage(`Payment verification failed: ${error}`);
                    }
                });
            } catch (error) {
                console.error('Error verifying payment:', error);
                setPaymentStatus('failed');
                setMessage('An error occurred while verifying payment. Please contact support.');
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

