import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchParkedCars, updateParkedCar, sendSmsNotification, initializeChapaPayment, fetchDailyStats, fetchDailyStatsHistory } from '../../api/api';
import { Car, CheckCircle, X, Coins, CreditCard } from 'lucide-react';
import '../../css/valetOverview.scss';

const ValetOverview = () => {
    const user = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [, setRecentCars] = useState([]);
    const [dailyStats, setDailyStats] = useState({
        totalParked: 0,
        checkedOut: 0,
        stillParked: 0,
        manualPayments: 0,
        onlinePayments: 0,
    });
    const [dailyStatsHistory, setDailyStatsHistory] = useState([]);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedCar, setSelectedCar] = useState(null);
    const [feeDetails, setFeeDetails] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user?.token) {
            fetchParkedCars({ 
                token: user.token, 
                setParkedCars: (cars) => {
                    setRecentCars(cars.slice(0, 5));
                }
            });

            // Fetch daily statistics
            fetchDailyStats({ token: user.token, setDailyStats });
            // Fetch historical daily statistics
            fetchDailyStatsHistory({ token: user.token, limit: 10, setDailyStatsHistory });
        }
    }, [user]);
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    const handlePaymentMethod = async (paymentMethod) => {
        if (!selectedCar || !feeDetails) return;

        setLoading(true);
        
        try {
            if (paymentMethod === 'online') {
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
                    handleInitSuccess: (data) => {
                        // Store payment reference for later verification
                        localStorage.setItem(`chapa_payment_${selectedCar._id}`, JSON.stringify({
                            txRef: data.txRef,
                            carId: selectedCar._id,
                            feeDetails: feeDetails,
                            customerPhone: selectedCar.phoneNumber || customerPhone,
                            totalPaidAmount: feeDetails.totalWithVat,
                        }));
                        
                        // Redirect to Chapa payment page
                        window.location.href = data.paymentUrl;
                    },
                    handleInitFailure: (error) => {
                        console.error('Failed to initialize Chapa payment:', error);
                        alert(`Failed to initialize payment: ${error}`);
                        setLoading(false);
                    }
                });
            } else {
                // Manual payment - update car status directly
                await updateParkedCar({
                    id: selectedCar._id,
                    body: {
                        status: 'checked_out',
                        checkedOutAt: new Date().toISOString(),
                        paymentMethod: paymentMethod,
                        totalPaidAmount: feeDetails.totalWithVat,
                    },
                    token: user?.token,
                    handleUpdateParkedCarSuccess: async () => {
                        // Send SMS to customer
                        const totalMinutes = Math.round(feeDetails.hoursParked * 60);
                        const durationDisplay = totalMinutes >= 60 
                            ? `${Math.floor(totalMinutes / 60)} hour${Math.floor(totalMinutes / 60) > 1 ? 's' : ''} ${totalMinutes % 60 > 0 ? `${totalMinutes % 60} min` : ''}`.trim()
                            : `${totalMinutes} min`;
                        const smsMessage = `Dear customer,\nThank you for using Tana Parking services! Your car (${selectedCar.licensePlate || `${selectedCar.plateCode || ''}-${selectedCar.region || ''}-${selectedCar.licensePlateNumber || ''}`}) has been received.\nParking fee: ${feeDetails.parkingFee.toFixed(2)} ETB\nVAT (15%): ${feeDetails.vatAmount.toFixed(2)} ETB\nTotal: ${feeDetails.totalWithVat.toFixed(2)} ETB (${durationDisplay} × ${feeDetails.pricePerHour} ETB/hour).\nPayment method: Cash.`;
                        
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

                        // Refresh cars list
                        fetchParkedCars({ 
                            token: user.token, 
                            setParkedCars: (cars) => {
                                setRecentCars(cars.slice(0, 5));
                            }
                        });

                        // Refresh daily statistics
                        fetchDailyStats({ token: user.token, setDailyStats });

                        setShowPaymentModal(false);
                        setSelectedCar(null);
                        setFeeDetails(null);
                        setLoading(false);
                    },
                    handleUpdateParkedCarFailure: (error) => {
                        console.error('Failed to update car:', error);
                        alert('Failed to update car status. Please try again.');
                        setLoading(false);
                    }
                });
            }
        } catch (error) {
            console.error('Error processing payment:', error);
            alert('An error occurred. Please try again.');
            setLoading(false);
        }
    };

    const handleCloseModal = () => {
        if (!loading) {
            setShowPaymentModal(false);
            setSelectedCar(null);
            setFeeDetails(null);
        }
    };

    return (
        <div className="valet-overview">
            <div className="quick-actions">
                <button 
                    className="action-btn primary"
                    onClick={() => navigate('/valet/register-car')}
                >
                    <Car size={20} />
                    Register New Car
                </button>
                <button 
                    className="action-btn secondary"
                    onClick={() => navigate('/valet/cars')}
                >
                    <CheckCircle size={20} />
                    View All Cars
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card stat-manual-payment">
                    <div className="stat-icon"><Coins size={14} /></div>
                    <div className="stat-content">
                        <h3>{dailyStats.manualPayments.toFixed(2)} ETB</h3>
                        <p>Manual Payments</p>
                    </div>
                </div>
                <div className="stat-card stat-online-payment">
                    <div className="stat-icon"><CreditCard size={14} /></div>
                    <div className="stat-content">
                        <h3>{dailyStats.onlinePayments.toFixed(2)} ETB</h3>
                        <p>Online Payments</p>
                    </div>
                </div>
            </div>

            {/* Historical Stats Table */}
            <div className="historical-stats-section">
                <h2>Previous Statistics (Last 10 Days)</h2>
                {dailyStatsHistory.length > 0 ? (
                    <div className="stats-table-container">
                        <table className="stats-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Total Parked</th>
                                    <th>Still Parked</th>
                                    <th>Checked Out</th>
                                    <th>Manual Payments</th>
                                    <th>Online Payments</th>
                                    <th>Total Payments</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyStatsHistory.map((stat, index) => {
                                    const totalPayments = (stat.manualPayments || 0) + (stat.onlinePayments || 0);
                                    return (
                                        <tr key={index}>
                                            <td>{formatDate(stat.date)}</td>
                                            <td>{stat.totalParked || 0}</td>
                                            <td>{stat.stillParked || 0}</td>
                                            <td>{stat.checkedOut || 0}</td>
                                            <td>{stat.manualPayments ? stat.manualPayments.toFixed(2) : '0.00'} ETB</td>
                                            <td>{stat.onlinePayments ? stat.onlinePayments.toFixed(2) : '0.00'} ETB</td>
                                            <td className="total-payments">{totalPayments.toFixed(2)} ETB</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="no-stats-message">
                        <p>No historical statistics available.</p>
                    </div>
                )}
            </div>

            {/* Payment Modal */}
            {showPaymentModal && selectedCar && feeDetails && (
                <div className="payment-modal-overlay" onClick={handleCloseModal}>
                    <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Parked Out - Payment Details</h2>
                            <button className="close-btn" onClick={handleCloseModal} disabled={loading}>
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

                            <div className="payment-methods-section">
                                <h3>Select Payment Method</h3>
                                <div className="payment-buttons">
                                    <button 
                                        className="payment-btn manual"
                                        onClick={() => handlePaymentMethod('manual')}
                                        disabled={loading}
                                    >
                                        Manual Payment
                                    </button>
                                    <button 
                                        className="payment-btn online"
                                        onClick={() => handlePaymentMethod('online')}
                                        disabled={loading}
                                    >
                                        Online Payment
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ValetOverview;

