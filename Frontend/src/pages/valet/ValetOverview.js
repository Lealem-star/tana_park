import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchParkedCars } from '../../api/api';
import { Car, CheckCircle, Calendar, Package } from 'lucide-react';
import '../../css/valetOverview.scss';

// Helper to calculate package end date based on duration
    const calculateEndDate = (parkedAt, packageDuration) => {
        const startDate = new Date(parkedAt);
        let endDate = new Date(startDate);
        
        switch (packageDuration) {
            case 'weekly':
                endDate.setDate(startDate.getDate() + 7);
                break;
            case 'monthly':
                endDate.setMonth(startDate.getMonth() + 1);
                break;
            case 'yearly':
                endDate.setFullYear(startDate.getFullYear() + 1);
                break;
            default:
                return null;
        }
        
        return endDate;
    };

const ValetOverview = () => {
    const user = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [packageStats, setPackageStats] = useState({
        weekly: 0,
        monthly: 0,
        yearly: 0,
        currentlyParked: 0
    });
    const [packageServices, setPackageServices] = useState([]);

    const loadPackageServices = useCallback(() => {
        if (user?.token) {
            fetchParkedCars({ 
                token: user.token, 
                setParkedCars: (cars) => {
                    // Filter package services
                    const packageCars = cars.filter(car => car.serviceType === 'package');

                    // Group by subscription (packageSubscriptionId or fallback licensePlate)
                    const now = new Date();
                    const subscriptionMap = {};

                    packageCars.forEach(car => {
                        const subKey = car.packageSubscriptionId || `lp-${car.licensePlate}`;

                        // Determine end date (from packageEndDate if present, else calculate from first parkedAt)
                        let packageEndDate = car.packageEndDate
                            ? new Date(car.packageEndDate)
                            : calculateEndDate(car.parkedAt, car.packageDuration);

                        // Skip expired packages
                        if (!packageEndDate || packageEndDate <= now) {
                            return;
                        }

                        if (!subscriptionMap[subKey]) {
                            subscriptionMap[subKey] = {
                                key: subKey,
                                cars: [],
                                packageDuration: car.packageDuration,
                                phoneNumber: car.phoneNumber,
                                packageEndDate,
                            };
                        }

                        subscriptionMap[subKey].cars.push(car);
                    });

                    const activeSubscriptions = Object.values(subscriptionMap);

                    // Calculate stats from active subscriptions
                    const weekly = activeSubscriptions.filter(s => s.packageDuration === 'weekly').length;
                    const monthly = activeSubscriptions.filter(s => s.packageDuration === 'monthly').length;
                    const yearly = activeSubscriptions.filter(s => s.packageDuration === 'yearly').length;
                    const currentlyParked = packageCars.filter(car => car.status === 'parked').length;

                    setPackageStats({ weekly, monthly, yearly, currentlyParked });

                    // Sort subscriptions by end date desc
                    const sortedSubscriptions = activeSubscriptions.sort(
                        (a, b) => b.packageEndDate - a.packageEndDate
                    );

                    setPackageServices(sortedSubscriptions);
                }
            });
        }
    }, [user]);

    useEffect(() => {
        loadPackageServices();
    }, [loadPackageServices]);

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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
                <div className="stat-card">
                    <div className="stat-icon"><Calendar size={14} /></div>
                    <div className="stat-content">
                        <h3>{packageStats.weekly}</h3>
                        <p>Weekly Registered</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Calendar size={14} /></div>
                    <div className="stat-content">
                        <h3>{packageStats.monthly}</h3>
                        <p>Monthly Registered</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Calendar size={14} /></div>
                    <div className="stat-content">
                        <h3>{packageStats.yearly}</h3>
                        <p>Yearly Registered</p>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Package size={14} /></div>
                    <div className="stat-content">
                        <h3>{packageStats.currentlyParked}</h3>
                        <p>Currently Parked (Package)</p>
                    </div>
                </div>
            </div>

            {/* Package Services List */}
            <div className="historical-stats-section">
                <h2>Package Service Registrations</h2>
                {packageServices.length > 0 ? (
                    <div className="stats-table-container">
                        <table className="stats-table">
                            <thead>
                                <tr>
                                    <th>Phone</th>
                                    <th>Package Type</th>
                                    <th>End Date</th>
                                    <th>Total Visits</th>
                                </tr>
                            </thead>
                            <tbody>
                                {packageServices.map((sub) => {
                                    const packageType = sub.packageDuration
                                        ? sub.packageDuration.charAt(0).toUpperCase() + sub.packageDuration.slice(1)
                                        : 'N/A';
                                    const visitsCount = sub.cars.length;
                                    
                                    return (
                                        <tr key={sub.key}>
                                            <td>{sub.phoneNumber || 'N/A'}</td>
                                            <td>{packageType}</td>
                                            <td>{sub.packageEndDate ? formatDateTime(sub.packageEndDate) : 'N/A'}</td>
                                            <td>{visitsCount}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="no-stats-message">
                        <p>No package service registrations available.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ValetOverview;

