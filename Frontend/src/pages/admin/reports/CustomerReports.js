import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { 
    fetchVehicleHistoryReport, 
    fetchCustomerActivityReport 
} from '../../../api/api';
import { Car, Users, Search, Download } from 'lucide-react';
import { exportCustomerReportToPDF } from '../../../utils/pdfExport';
import '../../../css/reports.scss';

const CustomerReports = () => {
    const user = useSelector((state) => state.user);
    const [activeReport, setActiveReport] = useState('vehicle-history');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Vehicle History State
    const [licensePlate, setLicensePlate] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [vehicleHistoryData, setVehicleHistoryData] = useState(null);

    // Customer Activity State
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [minVisits, setMinVisits] = useState('');
    const [customerActivityData, setCustomerActivityData] = useState(null);

    const loadVehicleHistory = () => {
        if (!licensePlate && !phoneNumber) {
            setError('Please enter license plate or phone number');
            return;
        }

        setLoading(true);
        setError('');
        fetchVehicleHistoryReport({
            token: user?.token,
            licensePlate: licensePlate || undefined,
            phoneNumber: phoneNumber || undefined,
            setData: (data) => {
                setVehicleHistoryData(data);
                setLoading(false);
            },
            handleError: (err) => {
                setError(err);
                setLoading(false);
            }
        });
    };

    const loadCustomerActivity = () => {
        setLoading(true);
        setError('');
        fetchCustomerActivityReport({
            token: user?.token,
            startDate,
            endDate,
            minVisits: minVisits || undefined,
            setData: (data) => {
                setCustomerActivityData(data);
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
            let data;
            let title;
            let subtitle;
            let filename;
            
            if (type === 'vehicle-history' && vehicleHistoryData) {
                data = vehicleHistoryData;
                title = 'Vehicle History Report';
                subtitle = licensePlate 
                    ? `License Plate: ${licensePlate}` 
                    : (phoneNumber ? `Phone: ${phoneNumber}` : '');
                filename = `vehicle-history-${licensePlate || phoneNumber || 'search'}.pdf`;
                await exportCustomerReportToPDF({ title, subtitle, data, filename, type: 'vehicle-history' });
            } else if (type === 'customer-activity' && customerActivityData) {
                data = customerActivityData;
                title = 'Customer Activity Report';
                subtitle = `From ${startDate} to ${endDate}`;
                filename = `customer-activity-${startDate}-${endDate}.pdf`;
                await exportCustomerReportToPDF({ title, subtitle, data, filename, type: 'customer-activity' });
            }
        } catch (err) {
            console.error('Error exporting PDF:', err);
            setError('Failed to export PDF. Please try again.');
        }
    };

    return (
        <div className="customer-reports">
            <div className="report-tabs">
                <button 
                    className={activeReport === 'vehicle-history' ? 'active' : ''}
                    onClick={() => setActiveReport('vehicle-history')}
                >
                    <Car size={18} />
                    Vehicle History
                </button>
                <button 
                    className={activeReport === 'customer-activity' ? 'active' : ''}
                    onClick={() => setActiveReport('customer-activity')}
                >
                    <Users size={18} />
                    Customer Activity
                </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {activeReport === 'vehicle-history' && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Vehicle History Report</h2>
                        {vehicleHistoryData && (
                            <div className="report-controls">
                                <button 
                                    onClick={() => handleExportPDF('vehicle-history')} 
                                    className="btn-export"
                                >
                                    <Download size={16} />
                                    Export PDF
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="search-section">
                        <div className="search-inputs">
                            <input
                                type="text"
                                placeholder="License Plate (e.g., 01-AA-12345)"
                                value={licensePlate}
                                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                                className="search-input"
                            />
                            <span>OR</span>
                            <input
                                type="text"
                                placeholder="Phone Number"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="search-input"
                            />
                            <button onClick={loadVehicleHistory} className="btn-search" disabled={loading}>
                                <Search size={16} />
                                {loading ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading vehicle history...</div>
                    ) : vehicleHistoryData ? (
                        <div className="report-content">
                            <div className="summary-section">
                                <div className="summary-card">
                                    <h3>{vehicleHistoryData.totalVisits}</h3>
                                    <p>Total Visits</p>
                                </div>
                                <div className="summary-card">
                                    <h3>{formatCurrency(vehicleHistoryData.totalPaid)}</h3>
                                    <p>Total Paid</p>
                                </div>
                                <div className="summary-card">
                                    <h3>{formatCurrency(vehicleHistoryData.averagePayment)}</h3>
                                    <p>Average Payment</p>
                                </div>
                            </div>

                            {vehicleHistoryData.history && vehicleHistoryData.history.length > 0 ? (
                                <div className="report-table-section">
                                    <h3>Parking History</h3>
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                <th>Date Parked</th>
                                                <th>Date Checked Out</th>
                                                <th>License Plate</th>
                                                <th>Model</th>
                                                <th>Location</th>
                                                <th>Status</th>
                                                <th>Payment Method</th>
                                                <th>Amount Paid</th>
                                                <th>Duration</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vehicleHistoryData.history.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>{new Date(item.parkedAt).toLocaleString()}</td>
                                                    <td>{item.checkedOutAt ? new Date(item.checkedOutAt).toLocaleString() : 'N/A'}</td>
                                                    <td>{item.licensePlate}</td>
                                                    <td>{item.model}</td>
                                                    <td>{item.location}</td>
                                                    <td>
                                                        <span className={`status-badge ${item.status}`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                    <td>{item.paymentMethod || 'manual'}</td>
                                                    <td>{formatCurrency(item.totalPaidAmount || 0)}</td>
                                                    <td>{item.duration || 'N/A'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="no-data">No history found for this vehicle.</div>
                            )}
                        </div>
                    ) : (
                        <div className="no-data">Enter license plate or phone number and click Search.</div>
                    )}
                </div>
            )}

            {activeReport === 'customer-activity' && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Customer Activity Report</h2>
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
                            <input
                                type="number"
                                placeholder="Min visits"
                                value={minVisits}
                                onChange={(e) => setMinVisits(e.target.value)}
                                className="number-input"
                                min="1"
                            />
                            <button onClick={loadCustomerActivity} className="btn-refresh" disabled={loading}>
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
                            {customerActivityData && (
                                <button 
                                    onClick={() => handleExportPDF('customer-activity')} 
                                    className="btn-export"
                                >
                                    <Download size={16} />
                                    Export PDF
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading customer activity...</div>
                    ) : customerActivityData ? (
                        <div className="report-content">
                            <div className="summary-section">
                                <div className="summary-card">
                                    <h3>{customerActivityData.totalCustomers}</h3>
                                    <p>Total Customers</p>
                                </div>
                            </div>

                            {customerActivityData.customers && customerActivityData.customers.length > 0 ? (
                                <div className="report-table-section">
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                <th>Phone Number</th>
                                                <th>Visit Count</th>
                                                <th>Total Paid</th>
                                                <th>Average Payment</th>
                                                <th>Preferred Payment</th>
                                                <th>Last Visit</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {customerActivityData.customers.map((customer, idx) => (
                                                <tr key={idx}>
                                                    <td>{customer.phoneNumber}</td>
                                                    <td>{customer.visitCount}</td>
                                                    <td>{formatCurrency(customer.totalPaid)}</td>
                                                    <td>{formatCurrency(customer.averagePayment)}</td>
                                                    <td>
                                                        <span className={`payment-badge ${customer.preferredPaymentMethod}`}>
                                                            {customer.preferredPaymentMethod}
                                                        </span>
                                                    </td>
                                                    <td>{new Date(customer.lastVisit).toLocaleDateString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="no-data">No customer data available for the selected period.</div>
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

export default CustomerReports;


