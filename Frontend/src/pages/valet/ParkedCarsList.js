import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchParkedCars, updateParkedCar, deleteParkedCar, sendSmsNotification, initializeChapaPayment, fetchDailyStats, fetchPricingSettings } from '../../api/api';
import { DeleteModal } from '../../components';
import { CheckCircle, Clock, X, Car } from 'lucide-react';
import '../../css/parkedCarsList.scss';
import '../../css/valetOverview.scss';

const ParkedCarsList = () => {
    const user = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [cars, setCars] = useState([]);
    const [filter, setFilter] = useState('all'); // all, parked, checked_out
    const [selectedCar, setSelectedCar] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [feeDetails, setFeeDetails] = useState(null);
    const [loading, setLoading] = useState(false);
    const [dailyStats, setDailyStats] = useState({
        totalParked: 0,
        checkedOut: 0,
        stillParked: 0,
        manualPayments: 0,
        onlinePayments: 0,
    });

    // Default pricing per hour for each plate code (in ETB) - fallback values
    const defaultPricingFallback = {
        '01': 50,
        '02': 50,
        '03': 50,
        '04': 50,
        '05': 50,
        'police': 0,
        'AO': 75,
        'ተላላፊ': 60,
        'የእለት': 40,
        'DF': 100,
        'AU': 80,
        'AU-CD': 80,
        'UN': 0,
        'UN-CD': 0,
        'CD': 90,
    };

    const [pricingSettings, setPricingSettings] = useState(defaultPricingFallback);

    useEffect(() => {
        if (user?.token) {
            loadCars();
            // Fetch daily statistics
            fetchDailyStats({ token: user.token, setDailyStats });
        }
        // Fetch pricing settings (no auth required)
        fetchPricingSettings({
            setPricingSettings: (data) => {
                // Convert API format to simple object format
                const pricing = {};
                Object.keys(data).forEach(plateCode => {
                    if (data[plateCode] && data[plateCode].pricePerHour !== undefined) {
                        pricing[plateCode] = data[plateCode].pricePerHour;
                    }
                });
                // Merge with fallback to ensure all plate codes have values
                setPricingSettings({ ...defaultPricingFallback, ...pricing });
            }
        });
    }, [user, filter]);

    const loadCars = () => {
        const status = filter !== 'all' ? filter : null;
        fetchParkedCars({ 
            token: user.token, 
            status,
            setParkedCars: setCars 
        });
    };

    const calculateFee = (car) => {
        const parkedAt = new Date(car.parkedAt);
        const now = new Date();

        // Duration in minutes and human readable text
        const diffMs = now - parkedAt;
        const totalMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
        const hoursForBilling = Math.max(1, Math.ceil(totalMinutes / 60)); // Minimum 1 hour for billing
        const durationHours = Math.floor(totalMinutes / 60);
        const durationMins = totalMinutes % 60;
        const durationText = `${durationHours} Hours ${durationMins} Min`;
        
        const plateCode = car.plateCode || '01';
        const pricePerHour = pricingSettings[plateCode] || pricingSettings['01'] || 50;

        const parkingFee = hoursForBilling * pricePerHour;
        const vatRate = 0.15;
        const vatAmount = Math.round(parkingFee * vatRate * 100) / 100;
        const totalWithVat = Math.round((parkingFee + vatAmount) * 100) / 100;

        return {
            hoursParked: hoursForBilling,
            pricePerHour,
            parkingFee,
            vatAmount,
            totalWithVat,
            durationText,
            parkedAt: parkedAt.toLocaleString(),
            checkedOutAt: now.toLocaleString()
        };
    };

    const handleStatusChange = (car, status) => {
        if (status === 'checked_out') {
            // Show payment modal for checkout
            const fee = calculateFee(car);
            setSelectedCar(car);
            setFeeDetails(fee);
            setShowPaymentModal(true);
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
                    fetchDailyStats({ token: user.token, setDailyStats });
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
                            customerPhone: selectedCar.phoneNumber || customerPhone
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
                        const smsMessage = `Thank you for using Tana Parking services! Your car (${selectedCar.licensePlate || `${selectedCar.plateCode || ''}-${selectedCar.region || ''}-${selectedCar.licensePlateNumber || ''}`}) has been received.\nParking fee: ${feeDetails.parkingFee.toFixed(2)} ETB\nVAT (15%): ${feeDetails.vatAmount.toFixed(2)} ETB\nTotal: ${feeDetails.totalWithVat.toFixed(2)} ETB (${feeDetails.hoursParked} hour${feeDetails.hoursParked > 1 ? 's' : ''} × ${feeDetails.pricePerHour} ETB/hour).\nPayment method: Cash.`;
                        
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

    const handleClosePaymentModal = () => {
        if (!loading) {
            setShowPaymentModal(false);
            setSelectedCar(null);
            setFeeDetails(null);
        }
    };

    const handleDelete = (car) => {
        setSelectedCar(car);
        setShowDeleteModal(true);
    };

    const confirmDelete = () => {
        if (selectedCar) {
            deleteParkedCar({
                id: selectedCar._id,
                token: user.token,
                handleDeleteParkedCarSuccess: () => {
                    loadCars();
                    fetchDailyStats({ token: user.token, setDailyStats });
                    setShowDeleteModal(false);
                    setSelectedCar(null);
                },
                handleDeleteParkedCarFailure: (error) => {
                    alert(error || 'Failed to delete car');
                }
            });
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

    // Check if car has been parked for less than 2 minutes
    const isWithinTwoMinutes = (car) => {
        if (car.status !== 'parked') {
            return false; // Only allow for parked cars
        }
        const parkedAt = new Date(car.parkedAt);
        const now = new Date();
        const diffMs = now - parkedAt;
        const diffMinutes = diffMs / (1000 * 60);
        return diffMinutes <= 2;
    };

    return (
        <div className="parked-cars-list">
            <div className="page-header">
                <h1>Parked Cars</h1>
                <button 
                    className="btn-primary"
                    onClick={() => navigate('/valet/register-car')}
                >
                    Register New Car
                </button>
            </div>

            <div className="filters">
                <button 
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All
                </button>
                <button 
                    className={`filter-btn ${filter === 'parked' ? 'active' : ''}`}
                    onClick={() => setFilter('parked')}
                >
                    Parked
                </button>
                <button 
                    className={`filter-btn ${filter === 'checked_out' ? 'active' : ''}`}
                    onClick={() => setFilter('checked_out')}
                >
                    Checked Out
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card stat-total">
                    <div className="stat-icon"><Car size={14} /></div>
                    <div className="stat-content">
                        <h3>{dailyStats.totalParked}</h3>
                        <p>Total Parked</p>
                    </div>
                </div>
                <div className="stat-card stat-parked">
                    <div className="stat-icon"><Clock size={14} /></div>
                    <div className="stat-content">
                        <h3>{dailyStats.stillParked}</h3>
                        <p>Still Parked</p>
                    </div>
                </div>
                <div className="stat-card stat-checked">
                    <div className="stat-icon"><CheckCircle size={14} /></div>
                    <div className="stat-content">
                        <h3>{dailyStats.checkedOut}</h3>
                        <p>Checked Out</p>
                    </div>
                </div>
            </div>

            <div className="cars-table-container">
                {cars.length > 0 ? (
                    <table className="cars-table">
                        <thead>
                            <tr>
                                <th>License Plate</th>
                                <th>Vehicle</th>
                                <th>Parked At</th>
                                <th>Checked Out At</th>
                                <th>Parking Fee</th>
                                <th>Status</th>
                                <th>Actions</th>
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
                                            {car.status === 'parked' && isWithinTwoMinutes(car) && (
                                                <button
                                                    className="btn-action btn-delete"
                                                    onClick={() => handleDelete(car)}
                                                >
                                                    Delete
                                                </button>
                                            )}
                                            {car.status === 'parked' && !isWithinTwoMinutes(car) && (
                                                <button
                                                    className="btn-action btn-checkout"
                                                    onClick={() => handleStatusChange(car, 'checked_out')}
                                                >
                                                    Check Out
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
                        <p>No parked cars found</p>
                        <button 
                            className="btn-primary"
                            onClick={() => navigate('/valet/register-car')}
                        >
                            Register First Car
                        </button>
                    </div>
                )}
            </div>

            {/* Status Change Modal */}
            {showStatusModal && (
                <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Change Status</h3>
                        <p>Are you sure you want to change the status to <strong>{newStatus.replace('_', ' ')}</strong>?</p>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setShowStatusModal(false)}>
                                Cancel
                            </button>
                            <button className="btn-confirm" onClick={confirmStatusChange}>
                                Confirm
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
                            <h2>Parked Out - Payment Details</h2>
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

            <DeleteModal 
                value={selectedCar?.licensePlate} 
                showModal={showDeleteModal} 
                setShowModal={setShowDeleteModal} 
                onDeleteConfirm={confirmDelete} 
            />
        </div>
    );
};

export default ParkedCarsList;

