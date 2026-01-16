import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
    fetchUsersReport, 
    fetchValetPerformanceReport 
} from '../../../api/api';
import { Users, TrendingUp, Download } from 'lucide-react';
import { exportAdministrativeReportToPDF } from '../../../utils/pdfExport';
import '../../../css/reports.scss';

const AdministrativeReports = () => {
    const user = useSelector((state) => state.user);
    const [activeReport, setActiveReport] = useState('users');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const [usersData, setUsersData] = useState(null);
    const [valetPerformanceData, setValetPerformanceData] = useState(null);

    useEffect(() => {
        if (activeReport === 'users') {
            loadUsersReport();
        } else if (activeReport === 'valet-performance') {
            loadValetPerformanceReport();
        }
    }, [activeReport]);

    const loadUsersReport = () => {
        setLoading(true);
        setError('');
        fetchUsersReport({
            token: user?.token,
            setData: (data) => {
                setUsersData(data);
                setLoading(false);
            },
            handleError: (err) => {
                setError(err);
                setLoading(false);
            }
        });
    };

    const loadValetPerformanceReport = () => {
        setLoading(true);
        setError('');
        fetchValetPerformanceReport({
            token: user?.token,
            startDate,
            endDate,
            setData: (data) => {
                setValetPerformanceData(data);
                setLoading(false);
            },
            handleError: (err) => {
                setError(err);
                setLoading(false);
            }
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-ET', {
            style: 'currency',
            currency: 'ETB',
            minimumFractionDigits: 2
        }).format(amount);
    };

    const handleExportPDF = async (type) => {
        try {
            let data, title, subtitle, filename;
            
            if (type === 'users' && usersData) {
                data = usersData;
                title = 'User Management Report';
                subtitle = 'Complete user listing and activity';
                filename = `user-management-${new Date().toISOString().split('T')[0]}.pdf`;
                await exportAdministrativeReportToPDF({ title, subtitle, data, filename, type: 'users' });
            } else if (type === 'valet-performance' && valetPerformanceData) {
                data = valetPerformanceData;
                title = 'Valet Performance Report';
                subtitle = `From ${startDate} to ${endDate}`;
                filename = `valet-performance-${startDate}-${endDate}.pdf`;
                await exportAdministrativeReportToPDF({ title, subtitle, data, filename, type: 'valet-performance' });
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
            setError('Failed to export PDF. Please try again.');
        }
    };

    return (
        <div className="administrative-reports">
            <div className="report-tabs">
                <button 
                    className={activeReport === 'users' ? 'active' : ''}
                    onClick={() => setActiveReport('users')}
                >
                    <Users size={18} />
                    User Management
                </button>
                <button 
                    className={activeReport === 'valet-performance' ? 'active' : ''}
                    onClick={() => setActiveReport('valet-performance')}
                >
                    <TrendingUp size={18} />
                    Valet Performance
                </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {activeReport === 'users' && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>User Management Report</h2>
                        <div className="report-controls">
                            <button onClick={loadUsersReport} className="btn-refresh" disabled={loading}>
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
                            {usersData && (
                                <button onClick={() => handleExportPDF('users')} className="btn-export">
                                    <Download size={16} />
                                    Export PDF
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading user data...</div>
                    ) : usersData ? (
                        <div className="report-content">
                            <div className="summary-section">
                                <div className="summary-card">
                                    <h3>{usersData.totalUsers}</h3>
                                    <p>Total Users</p>
                                </div>
                            </div>

                            {usersData.usersByType && usersData.usersByType.length > 0 && (
                                <div className="report-table-section">
                                    {usersData.usersByType.map((typeGroup, idx) => (
                                        <div key={idx} className="user-type-section">
                                            <h3>{typeGroup.type} ({typeGroup.count})</h3>
                                            <table className="report-table">
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>Phone Number</th>
                                                        <th>Park Zone Code</th>
                                                        <th>Cars Parked</th>
                                                        <th>Cars Checked Out</th>
                                                        <th>Has Photo</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {typeGroup.users.map((user, uIdx) => (
                                                        <tr key={uIdx}>
                                                            <td>{user.name}</td>
                                                            <td>{user.phoneNumber}</td>
                                                            <td>{user.parkZoneCode || 'N/A'}</td>
                                                            <td>{user.activity?.carsParked || 0}</td>
                                                            <td>{user.activity?.carsCheckedOut || 0}</td>
                                                            <td>{user.hasProfilePhoto ? 'Yes' : 'No'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="no-data">Click Refresh to load user data.</div>
                    )}
                </div>
            )}

            {activeReport === 'valet-performance' && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Valet Performance Report</h2>
                        <div className="report-controls">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="date-input"
                            />
                            <span>to</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="date-input"
                            />
                            <button onClick={loadValetPerformanceReport} className="btn-refresh" disabled={loading}>
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
                            {valetPerformanceData && (
                                <button onClick={() => handleExportPDF('valet-performance')} className="btn-export">
                                    <Download size={16} />
                                    Export PDF
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading valet performance data...</div>
                    ) : valetPerformanceData ? (
                        <div className="report-content">
                            {valetPerformanceData.performance && valetPerformanceData.performance.length > 0 ? (
                                <div className="report-table-section">
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                <th>Valet Name</th>
                                                <th>Phone Number</th>
                                                <th>Park Zone</th>
                                                <th>Cars Parked</th>
                                                <th>Cars Checked Out</th>
                                                <th>Revenue</th>
                                                <th>Avg Revenue</th>
                                                <th>Checkout Rate</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {valetPerformanceData.performance.map((valet, idx) => (
                                                <tr key={idx}>
                                                    <td><strong>{valet.valetName}</strong></td>
                                                    <td>{valet.phoneNumber}</td>
                                                    <td>{valet.parkZoneCode || 'N/A'}</td>
                                                    <td>{valet.carsParked}</td>
                                                    <td>{valet.carsCheckedOut}</td>
                                                    <td>{formatCurrency(valet.revenue)}</td>
                                                    <td>{formatCurrency(valet.averageRevenue)}</td>
                                                    <td>{valet.checkoutRate.toFixed(1)}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="no-data">No valet performance data available.</div>
                            )}
                        </div>
                    ) : (
                        <div className="no-data">Select date range and click Refresh.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdministrativeReports;

