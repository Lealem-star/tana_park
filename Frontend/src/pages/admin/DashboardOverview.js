import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchUsers, fetchParkedCars } from '../../api/api';
import '../../css/dashboardOverview.scss';

const DashboardOverview = () => {
    const [users, setUsers] = useState([]); // eslint-disable-line no-unused-vars
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [revenueRows, setRevenueRows] = useState([]);
    const [loadingRevenue, setLoadingRevenue] = useState(false);
    const [revenueError, setRevenueError] = useState('');
    const [totalDailyCars, setTotalDailyCars] = useState(0);
    const [totalDailyRevenue, setTotalDailyRevenue] = useState(0);

    const user = useSelector((state) => state.user);

    useEffect(() => {
        fetchUsers({ setUsers: (data) => {
            setUsers(data);
        }});
    }, []);

    useEffect(() => {
        const loadRevenue = () => {
            if (!user?.token) return;

            setLoadingRevenue(true);
            setRevenueError('');

            fetchParkedCars({
                token: user.token,
                date: selectedDate,
                setParkedCars: (cars) => {
                    const map = new Map();
                    let totalRevenue = 0;

                    cars.forEach((car) => {
                        const valet = car.valet_id || {};
                        const key = `${car.location || 'Unknown'}||${valet._id || 'unknown'}`;

                        if (!map.has(key)) {
                            map.set(key, {
                                parkZoneCode: car.location || 'Unknown',
                                valetName: valet.name || 'Unknown',
                                totalCars: 0,
                                totalRevenue: 0
                            });
                        }

                        const entry = map.get(key);
                        entry.totalCars += 1;
                        
                        // Use actual totalPaidAmount from the car (default to 0 if not set)
                        const revenue = car.totalPaidAmount || 0;
                        entry.totalRevenue += revenue;
                        totalRevenue += revenue;
                    });

                    const rows = Array.from(map.values());
                    setRevenueRows(rows);
                    setTotalDailyCars(rows.reduce((sum, row) => sum + row.totalCars, 0));
                    setTotalDailyRevenue(totalRevenue);
                    setLoadingRevenue(false);
                }
            });
        };

        loadRevenue();
    }, [user, selectedDate]);

    return (
        <div className="dashboard-overview">

            <div className="stats-grid">
                <div className="stat-card gradient-purple">
                    <div className="stat-content">
                        <h3>{totalDailyCars}</h3>
                        <p>Total Daily Cars</p>
                    </div>
                    <div className="stat-chart">
                        <div className="mini-chart"></div>
                    </div>
                </div>

                <div className="stat-card gradient-green">
                    <div className="stat-content">
                        <h3>{totalDailyRevenue.toFixed(2)}</h3>
                        <p>Total Daily Revenue</p>
                    </div>
                    <div className="stat-chart">
                        <div className="mini-chart"></div>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid">
                <div className="dashboard-card">
                    <div className="card-header">
                        <h2>Daily Revenue by Valet</h2>
                        <div className="date-selector">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {loadingRevenue ? (
                        <div className="chart-placeholder">
                            <p>Loading revenue data...</p>
                        </div>
                    ) : revenueError ? (
                        <div className="chart-placeholder">
                            <p>{revenueError}</p>
                        </div>
                    ) : revenueRows.length === 0 ? (
                        <div className="chart-placeholder">
                            <p>No revenue data for this date.</p>
                        </div>
                    ) : (
                        <div className="revenue-table-wrapper">
                            <table className="revenue-table">
                                <thead>
                                    <tr>
                                        <th>Park Zone Code</th>
                                        <th>Valet Officer Name</th>
                                        <th>Daily Parked Car</th>
                                        <th>Daily Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {revenueRows.map((row, index) => (
                                        <tr key={index}>
                                            <td>{row.parkZoneCode}</td>
                                            <td>{row.valetName}</td>
                                            <td>{row.totalCars}</td>
                                            <td>{row.totalRevenue.toFixed(2)} ETB</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;


