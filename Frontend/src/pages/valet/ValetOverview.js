import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchParkedCars, fetchDailyStats, fetchDailyStatsHistory } from '../../api/api';
import { Car, CheckCircle, CreditCard } from 'lucide-react';
import '../../css/valetOverview.scss';

const ValetOverview = () => {
    const user = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [, setRecentCars] = useState([]);
    const [dailyStats, setDailyStats] = useState({
        totalParked: 0,
        checkedOut: 0,
        stillParked: 0,
        onlinePayments: 0,
    });
    const [dailyStatsHistory, setDailyStatsHistory] = useState([]);

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
                                    <th>Payments</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyStatsHistory.map((stat, index) => {
                                    // Calculate total payments (manual + online) to show all historical payments
                                    const totalPayments = (stat.manualPayments || 0) + (stat.onlinePayments || 0);
                                    return (
                                        <tr key={index}>
                                            <td>{formatDate(stat.date)}</td>
                                            <td>{stat.totalParked || 0}</td>
                                            <td>{stat.stillParked || 0}</td>
                                            <td>{stat.checkedOut || 0}</td>
                                            <td>{totalPayments.toFixed(2)} ETB</td>
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
        </div>
    );
};

export default ValetOverview;

