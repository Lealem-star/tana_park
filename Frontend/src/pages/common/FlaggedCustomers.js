import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { fetchFlaggedCars, notifyFlaggedCustomer, initializeChapaPayment, updateParkedCar, sendSmsNotification } from '../../api/api';
import { EthiopianDatePicker } from '../../components';
import { AlertTriangle, Bell, CreditCard } from 'lucide-react';
import '../../css/parkedCarsList.scss';

const FlaggedCustomers = () => {
    const { t } = useTranslation();
    const user = useSelector((state) => state.user);
    const [flaggedCars, setFlaggedCars] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedCar, setSelectedCar] = useState(null);
    const [showPaymentFormModal, setShowPaymentFormModal] = useState(false);
    const [feeDetails, setFeeDetails] = useState(null);

    useEffect(() => {
        if (user?.token) {
            loadFlaggedCars();
        }
    }, [user?.token]);

    const loadFlaggedCars = () => {
        if (!user?.token) return;
        fetchFlaggedCars({
            token: user.token,
            setFlaggedCars: setFlaggedCars,
            handleError: (error) => {
                console.error('Failed to load flagged cars:', error);
            }
        });
    };

    const calculateFee = (car) => {
        // Calculate fee from stored amounts or from duration
        let parkingFee = car.baseAmount || 0;
        let vatAmount = car.vatAmount || 0;
        let totalWithVat = parkingFee + vatAmount;

        // If fee not stored, calculate from duration
        if (totalWithVat === 0 && car.parkedAt && car.checkedOutAt) {
            const parkedAt = new Date(car.parkedAt);
            const checkedOutAt = new Date(car.checkedOutAt);
            const diffMs = checkedOutAt - parkedAt;
            const totalMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
            const hoursParked = totalMinutes / 60;
            
            // Use default pricing (50 ETB/hour) - could be improved to use actual pricing
            parkingFee = Math.round((hoursParked * 50) * 100) / 100;
            vatAmount = Math.round(parkingFee * 0.15 * 100) / 100;
            totalWithVat = Math.round((parkingFee + vatAmount) * 100) / 100;
        }

        return {
            parkingFee,
            vatAmount,
            totalWithVat,
            parkedAt: car.parkedAt ? new Date(car.parkedAt).toLocaleString() : 'N/A',
            checkedOutAt: car.checkedOutAt ? new Date(car.checkedOutAt).toLocaleString() : 'N/A'
        };
    };

    const handlePayNow = (car) => {
        const fee = calculateFee(car);
        setSelectedCar(car);
        setFeeDetails(fee);
        setShowPaymentFormModal(true);
        // Payment flow will be handled similar to ParkedCarsList
        handlePaymentMethod('online');
    };

    const handlePaymentMethod = async (paymentMethod) => {
        if (!selectedCar || !feeDetails) return;

        setLoading(true);
        
        try {
            // Initialize Chapa payment (similar to ParkedCarsList)
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
                    // Store payment reference
                    localStorage.setItem(`chapa_payment_${selectedCar._id}`, JSON.stringify({
                        txRef: data.txRef,
                        carId: selectedCar._id,
                        feeDetails: feeDetails,
                        customerPhone: selectedCar.phoneNumber
                    }));

                    const chapaPublicKey = data.publicKey || process.env.REACT_APP_CHAPA_PUBLIC_KEY;
                    
                    if (!chapaPublicKey || !data.txRef) {
                        alert('Payment system is not configured properly.');
                        setLoading(false);
                        return;
                    }

                    // Initialize Chapa Inline.js (simplified - full implementation similar to ParkedCarsList)
                    // For now, redirect to payment callback
                    window.location.href = `/payment/callback?txRef=${data.txRef}`;
                },
                handleInitFailure: (error) => {
                    alert(`Failed to initialize payment: ${error}`);
                    setLoading(false);
                }
            });
        } catch (error) {
            console.error('Payment initialization error:', error);
            alert('Failed to initialize payment. Please try again.');
            setLoading(false);
        }
    };

    const handleNotify = async (car) => {
        if (!car._id) return;
        
        setLoading(true);
        try {
            await notifyFlaggedCustomer({
                id: car._id,
                token: user?.token,
                handleNotifySuccess: () => {
                    alert(t('valet.notificationSent'));
                    loadFlaggedCars(); // Refresh to update notification status
                    setLoading(false);
                },
                handleNotifyFailure: (error) => {
                    alert(`Failed to send notification: ${error}`);
                    setLoading(false);
                }
            });
        } catch (error) {
            console.error('Notify error:', error);
            alert('Failed to send notification. Please try again.');
            setLoading(false);
        }
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="parked-cars-list">
            <div className="page-header">
                <h1>{t('valet.flaggedCustomers')}</h1>
                <p>{t('valet.unpaidParking')}</p>
            </div>

            <div className="cars-table-container">
                {flaggedCars.length > 0 ? (
                    <table className="cars-table">
                        <thead>
                            <tr>
                                <th>{t('valet.licensePlate')}</th>
                                <th>{t('valet.phoneNumber')}</th>
                                <th>{t('valet.parkedAt')}</th>
                                <th>{t('valet.checkedOutAt')}</th>
                                <th>{t('valet.parkingFee')}</th>
                                <th>{t('valet.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flaggedCars.map((car) => {
                                const fee = calculateFee(car);
                                return (
                                    <tr key={car._id}>
                                        <td className="license-plate">{car.licensePlate || `${car.plateCode || ''}-${car.region || ''}-${car.licensePlateNumber || ''}`}</td>
                                        <td>{car.phoneNumber || 'N/A'}</td>
                                        <td>{formatDateTime(car.parkedAt)}</td>
                                        <td>{formatDateTime(car.checkedOutAt)}</td>
                                        <td>{fee.totalWithVat.toFixed(2)} ETB</td>
                                        <td>
                                            <div className="actions">
                                                <button
                                                    className="btn-action btn-pay"
                                                    onClick={() => handlePayNow(car)}
                                                    disabled={loading}
                                                    style={{ marginRight: '8px' }}
                                                >
                                                    <CreditCard size={16} style={{ marginRight: '4px' }} />
                                                    {t('valet.payNow')}
                                                </button>
                                                <button
                                                    className="btn-action btn-notify"
                                                    onClick={() => handleNotify(car)}
                                                    disabled={loading || car.notificationSent}
                                                    style={{ 
                                                        opacity: car.notificationSent ? 0.6 : 1,
                                                        cursor: car.notificationSent ? 'not-allowed' : 'pointer'
                                                    }}
                                                >
                                                    <Bell size={16} style={{ marginRight: '4px' }} />
                                                    {car.notificationSent ? t('valet.notified') : t('valet.notify')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="no-data">
                        <AlertTriangle size={48} style={{ color: '#9ca3af', marginBottom: '16px' }} />
                        <p>{t('valet.noFlaggedCars')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FlaggedCustomers;

