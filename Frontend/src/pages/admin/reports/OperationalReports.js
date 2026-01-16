import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { 
    fetchActivityReport, 
    fetchDurationReport, 
    fetchLocationReport, 
    fetchPeakHoursReport,
    fetchPlateCodeDistributionReport
} from '../../../api/api';
import { Activity, Clock, MapPin, TrendingUp, BarChart3, Download } from 'lucide-react';
import { exportOperationalReportToPDF } from '../../../utils/pdfExport';
import '../../../css/reports.scss';

const OperationalReports = () => {
    const user = useSelector((state) => state.user);
    const [activeReport, setActiveReport] = useState('activity');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const [activityData, setActivityData] = useState(null);
    const [durationData, setDurationData] = useState(null);
    const [locationData, setLocationData] = useState(null);
    const [peakHoursData, setPeakHoursData] = useState(null);
    const [plateCodeDistData, setPlateCodeDistData] = useState(null);

    const loadReport = useCallback(() => {
        setLoading(true);
        setError('');

        if (activeReport === 'activity') {
            fetchActivityReport({
                token: user?.token,
                startDate,
                endDate,
                setData: (data) => {
                    setActivityData(data);
                    setLoading(false);
                },
                handleError: (err) => {
                    setError(err);
                    setLoading(false);
                }
            });
        } else if (activeReport === 'duration') {
            fetchDurationReport({
                token: user?.token,
                startDate,
                endDate,
                setData: (data) => {
                    setDurationData(data);
                    setLoading(false);
                },
                handleError: (err) => {
                    setError(err);
                    setLoading(false);
                }
            });
        } else if (activeReport === 'location') {
            fetchLocationReport({
                token: user?.token,
                startDate,
                endDate,
                setData: (data) => {
                    setLocationData(data);
                    setLoading(false);
                },
                handleError: (err) => {
                    setError(err);
                    setLoading(false);
                }
            });
        } else if (activeReport === 'peak-hours') {
            fetchPeakHoursReport({
                token: user?.token,
                startDate,
                endDate,
                setData: (data) => {
                    setPeakHoursData(data);
                    setLoading(false);
                },
                handleError: (err) => {
                    setError(err);
                    setLoading(false);
                }
            });
        } else if (activeReport === 'plate-code-dist') {
            fetchPlateCodeDistributionReport({
                token: user?.token,
                startDate,
                endDate,
                setData: (data) => {
                    setPlateCodeDistData(data);
                    setLoading(false);
                },
                handleError: (err) => {
                    setError(err);
                    setLoading(false);
                }
            });
        }
    }, [user?.token, activeReport, startDate, endDate]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const handleExportPDF = async (type) => {
        try {
            let data, title, subtitle, filename;
            
            if (type === 'activity' && activityData) {
                data = activityData;
                title = 'Parking Activity Report';
                subtitle = `From ${startDate} to ${endDate}`;
                filename = `parking-activity-${startDate}-${endDate}.pdf`;
                await exportOperationalReportToPDF({ title, subtitle, data, filename, type: 'activity' });
            } else if (type === 'duration' && durationData) {
                data = durationData;
                title = 'Parking Duration Analysis';
                subtitle = `From ${startDate} to ${endDate}`;
                filename = `parking-duration-${startDate}-${endDate}.pdf`;
                await exportOperationalReportToPDF({ title, subtitle, data, filename, type: 'duration' });
            } else if (type === 'location' && locationData) {
                data = locationData;
                title = 'Location Utilization Report';
                subtitle = `From ${startDate} to ${endDate}`;
                filename = `location-utilization-${startDate}-${endDate}.pdf`;
                await exportOperationalReportToPDF({ title, subtitle, data, filename, type: 'location' });
            } else if (type === 'peak-hours' && peakHoursData) {
                data = peakHoursData;
                title = 'Peak Hours Analysis';
                subtitle = `From ${startDate} to ${endDate}`;
                filename = `peak-hours-${startDate}-${endDate}.pdf`;
                await exportOperationalReportToPDF({ title, subtitle, data, filename, type: 'peak-hours' });
            } else if (type === 'plate-code-dist' && plateCodeDistData) {
                data = plateCodeDistData;
                title = 'Plate Code Distribution';
                subtitle = `From ${startDate} to ${endDate}`;
                filename = `plate-code-distribution-${startDate}-${endDate}.pdf`;
                await exportOperationalReportToPDF({ title, subtitle, data, filename, type: 'plate-code-dist' });
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
            setError('Failed to export PDF. Please try again.');
        }
    };

    return (
        <div className="operational-reports">
            <div className="report-tabs">
                <button 
                    className={activeReport === 'activity' ? 'active' : ''}
                    onClick={() => setActiveReport('activity')}
                >
                    <Activity size={18} />
                    Parking Activity
                </button>
                <button 
                    className={activeReport === 'duration' ? 'active' : ''}
                    onClick={() => setActiveReport('duration')}
                >
                    <Clock size={18} />
                    Duration Analysis
                </button>
                <button 
                    className={activeReport === 'location' ? 'active' : ''}
                    onClick={() => setActiveReport('location')}
                >
                    <MapPin size={18} />
                    Location Utilization
                </button>
                <button 
                    className={activeReport === 'peak-hours' ? 'active' : ''}
                    onClick={() => setActiveReport('peak-hours')}
                >
                    <TrendingUp size={18} />
                    Peak Hours
                </button>
                <button 
                    className={activeReport === 'plate-code-dist' ? 'active' : ''}
                    onClick={() => setActiveReport('plate-code-dist')}
                >
                    <BarChart3 size={18} />
                    Plate Code Distribution
                </button>
            </div>

            <div className="report-filters">
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
                <button onClick={loadReport} className="btn-refresh" disabled={loading}>
                    {loading ? 'Loading...' : 'Refresh'}
                </button>
                {(activityData || durationData || locationData || peakHoursData || plateCodeDistData) && (
                    <button onClick={() => handleExportPDF(activeReport)} className="btn-export">
                        <Download size={16} />
                        Export PDF
                    </button>
                )}
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {activeReport === 'activity' && activityData && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Parking Activity Report</h2>
                    </div>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <h3>{activityData.totalParked}</h3>
                            <p>Total Parked</p>
                        </div>
                        <div className="stat-card">
                            <h3>{activityData.checkedOut}</h3>
                            <p>Checked Out</p>
                        </div>
                        <div className="stat-card">
                            <h3>{activityData.stillParked}</h3>
                            <p>Still Parked</p>
                        </div>
                        <div className="stat-card">
                            <h3>{activityData.violations}</h3>
                            <p>Violations</p>
                        </div>
                        <div className="stat-card">
                            <h3>{activityData.checkoutRate.toFixed(1)}%</h3>
                            <p>Checkout Rate</p>
                        </div>
                    </div>
                    {activityData.dailyActivity && activityData.dailyActivity.length > 0 && (
                        <div className="report-table-section">
                            <h3>Daily Activity Breakdown</h3>
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Parked</th>
                                        <th>Checked Out</th>
                                        <th>Violations</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activityData.dailyActivity.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{item.date}</td>
                                            <td>{item.parked}</td>
                                            <td>{item.checkedOut}</td>
                                            <td>{item.violations}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeReport === 'duration' && durationData && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Parking Duration Analysis</h2>
                    </div>
                    <div className="stats-grid">
                        <div className="stat-card">
                            <h3>{durationData.averageDuration.toFixed(2)}</h3>
                            <p>Average Duration (hours)</p>
                        </div>
                        <div className="stat-card">
                            <h3>{durationData.minDuration.toFixed(2)}</h3>
                            <p>Min Duration (hours)</p>
                        </div>
                        <div className="stat-card">
                            <h3>{durationData.maxDuration.toFixed(2)}</h3>
                            <p>Max Duration (hours)</p>
                        </div>
                        <div className="stat-card">
                            <h3>{durationData.totalCheckedOut}</h3>
                            <p>Total Checked Out</p>
                        </div>
                    </div>
                    {durationData.distribution && (
                        <div className="report-table-section">
                            <h3>Duration Distribution</h3>
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Duration Range</th>
                                        <th>Count</th>
                                        <th>Percentage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(durationData.distribution).map(([range, count]) => (
                                        <tr key={range}>
                                            <td>{range} hours</td>
                                            <td>{count}</td>
                                            <td>{durationData.totalCheckedOut > 0 
                                                ? ((count / durationData.totalCheckedOut) * 100).toFixed(1) 
                                                : 0}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeReport === 'location' && locationData && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Location Utilization Report</h2>
                    </div>
                    {locationData.locationStats && locationData.locationStats.length > 0 && (
                        <div className="report-table-section">
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Location</th>
                                        <th>Total Parked</th>
                                        <th>Checked Out</th>
                                        <th>Still Parked</th>
                                        <th>Utilization Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {locationData.locationStats.map((item, idx) => (
                                        <tr key={idx}>
                                            <td><strong>{item.location}</strong></td>
                                            <td>{item.totalParked}</td>
                                            <td>{item.checkedOut}</td>
                                            <td>{item.stillParked}</td>
                                            <td>{item.utilizationRate.toFixed(1)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeReport === 'peak-hours' && peakHoursData && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Peak Hours Analysis</h2>
                    </div>
                    {peakHoursData.hourlyStats && peakHoursData.hourlyStats.length > 0 && (
                        <div className="report-table-section">
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Hour</th>
                                        <th>Parked</th>
                                        <th>Checked Out</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {peakHoursData.hourlyStats.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{item.hourLabel}</td>
                                            <td>{item.parked}</td>
                                            <td>{item.checkedOut}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeReport === 'plate-code-dist' && plateCodeDistData && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Plate Code Distribution</h2>
                    </div>
                    {plateCodeDistData.plateCodeStats && plateCodeDistData.plateCodeStats.length > 0 && (
                        <div className="report-table-section">
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>Plate Code</th>
                                        <th>Count</th>
                                        <th>Percentage</th>
                                        <th>Top Regions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plateCodeDistData.plateCodeStats.map((item, idx) => (
                                        <tr key={idx}>
                                            <td><strong>{item.plateCode}</strong></td>
                                            <td>{item.count}</td>
                                            <td>{item.percentage.toFixed(1)}%</td>
                                            <td>
                                                {item.regions && item.regions.length > 0
                                                    ? item.regions.slice(0, 3).map(r => r.region).join(', ')
                                                    : 'N/A'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {loading && <div className="loading">Loading report data...</div>}
            {!loading && !activityData && !durationData && !locationData && !peakHoursData && !plateCodeDistData && (
                <div className="no-data">No data available. Select date range and click Refresh.</div>
            )}
        </div>
    );
};

export default OperationalReports;

