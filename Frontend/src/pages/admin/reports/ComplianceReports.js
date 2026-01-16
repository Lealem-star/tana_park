import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { 
    fetchTransactionsReport, 
    fetchSystemActivityReport 
} from '../../../api/api';
import { Shield, FileText, Download } from 'lucide-react';
import { exportComplianceReportToPDF } from '../../../utils/pdfExport';
import '../../../css/reports.scss';

const ComplianceReports = () => {
    const user = useSelector((state) => state.user);
    const [activeReport, setActiveReport] = useState('transactions');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('');

    const [transactionsData, setTransactionsData] = useState(null);
    const [systemActivityData, setSystemActivityData] = useState(null);

    const loadTransactionsReport = useCallback(() => {
        setLoading(true);
        setError('');
        fetchTransactionsReport({
            token: user?.token,
            startDate,
            endDate,
            paymentMethod: paymentMethod || undefined,
            setData: (data) => {
                setTransactionsData(data);
                setLoading(false);
            },
            handleError: (err) => {
                setError(err);
                setLoading(false);
            }
        });
    }, [user?.token, startDate, endDate, paymentMethod]);

    const loadSystemActivityReport = useCallback(() => {
        setLoading(true);
        setError('');
        fetchSystemActivityReport({
            token: user?.token,
            startDate,
            endDate,
            setData: (data) => {
                setSystemActivityData(data);
                setLoading(false);
            },
            handleError: (err) => {
                setError(err);
                setLoading(false);
            }
        });
    }, [user?.token, startDate, endDate]);

    useEffect(() => {
        if (activeReport === 'transactions') {
            loadTransactionsReport();
        } else if (activeReport === 'system-activity') {
            loadSystemActivityReport();
        }
    }, [activeReport, loadTransactionsReport, loadSystemActivityReport]);

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
            
            if (type === 'transactions' && transactionsData) {
                data = transactionsData;
                title = 'Transaction Audit Report';
                subtitle = `From ${startDate} to ${endDate}${paymentMethod ? ` - ${paymentMethod}` : ''}`;
                filename = `transaction-audit-${startDate}-${endDate}.pdf`;
                await exportComplianceReportToPDF({ title, subtitle, data, filename, type: 'transactions' });
            } else if (type === 'system-activity' && systemActivityData) {
                data = systemActivityData;
                title = 'System Activity Report';
                subtitle = `From ${startDate} to ${endDate}`;
                filename = `system-activity-${startDate}-${endDate}.pdf`;
                await exportComplianceReportToPDF({ title, subtitle, data, filename, type: 'system-activity' });
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
            setError('Failed to export PDF. Please try again.');
        }
    };

    return (
        <div className="compliance-reports">
            <div className="report-tabs">
                <button 
                    className={activeReport === 'transactions' ? 'active' : ''}
                    onClick={() => setActiveReport('transactions')}
                >
                    <FileText size={18} />
                    Transaction Audit
                </button>
                <button 
                    className={activeReport === 'system-activity' ? 'active' : ''}
                    onClick={() => setActiveReport('system-activity')}
                >
                    <Shield size={18} />
                    System Activity
                </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {activeReport === 'transactions' && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Transaction Audit Report</h2>
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
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="select-input"
                            >
                                <option value="">All Methods</option>
                                <option value="manual">Manual</option>
                                <option value="online">Online</option>
                            </select>
                            <button onClick={loadTransactionsReport} className="btn-refresh" disabled={loading}>
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
                            {transactionsData && (
                                <button onClick={() => handleExportPDF('transactions')} className="btn-export">
                                    <Download size={16} />
                                    Export PDF
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading transaction audit data...</div>
                    ) : transactionsData ? (
                        <div className="report-content">
                            <div className="summary-section">
                                <div className="summary-card">
                                    <h3>{transactionsData.totalTransactions}</h3>
                                    <p>Total Transactions</p>
                                </div>
                                <div className="summary-card">
                                    <h3>{transactionsData.paymentMethod || 'All Methods'}</h3>
                                    <p>Payment Method</p>
                                </div>
                            </div>

                            {transactionsData.transactions && transactionsData.transactions.length > 0 ? (
                                <div className="report-table-section">
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                <th>License Plate</th>
                                                <th>Parked At</th>
                                                <th>Checked Out At</th>
                                                <th>Payment Method</th>
                                                <th>Payment Reference</th>
                                                <th>Amount</th>
                                                <th>Valet</th>
                                                <th>Checked Out By</th>
                                                <th>Location</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {transactionsData.transactions.map((transaction, idx) => (
                                                <tr key={idx}>
                                                    <td>{transaction.licensePlate}</td>
                                                    <td>{new Date(transaction.parkedAt).toLocaleString()}</td>
                                                    <td>{new Date(transaction.checkedOutAt).toLocaleString()}</td>
                                                    <td>
                                                        <span className={`payment-badge ${transaction.paymentMethod}`}>
                                                            {transaction.paymentMethod || 'manual'}
                                                        </span>
                                                    </td>
                                                    <td>{transaction.paymentReference || 'N/A'}</td>
                                                    <td>{formatCurrency(transaction.amount)}</td>
                                                    <td>{transaction.valetName || 'N/A'}</td>
                                                    <td>{transaction.checkedOutByName || 'N/A'}</td>
                                                    <td>{transaction.location || 'N/A'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="no-data">No transactions found for the selected criteria.</div>
                            )}
                        </div>
                    ) : (
                        <div className="no-data">Select date range and click Refresh.</div>
                    )}
                </div>
            )}

            {activeReport === 'system-activity' && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>System Activity Report</h2>
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
                            <button onClick={loadSystemActivityReport} className="btn-refresh" disabled={loading}>
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
                            {systemActivityData && (
                                <button onClick={() => handleExportPDF('system-activity')} className="btn-export">
                                    <Download size={16} />
                                    Export PDF
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading system activity data...</div>
                    ) : systemActivityData ? (
                        <div className="report-content">
                            <div className="summary-section">
                                <div className="summary-card">
                                    <h3>{systemActivityData.activitySummary?.carsRegistered || 0}</h3>
                                    <p>Cars Registered</p>
                                </div>
                                <div className="summary-card">
                                    <h3>{systemActivityData.activitySummary?.carsCheckedOut || 0}</h3>
                                    <p>Cars Checked Out</p>
                                </div>
                                <div className="summary-card">
                                    <h3>{formatCurrency(systemActivityData.activitySummary?.totalRevenue || 0)}</h3>
                                    <p>Total Revenue</p>
                                </div>
                                <div className="summary-card">
                                    <h3>{systemActivityData.activitySummary?.violations || 0}</h3>
                                    <p>Violations</p>
                                </div>
                            </div>

                            {systemActivityData.activities && systemActivityData.activities.length > 0 ? (
                                <div className="report-table-section">
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                <th>Timestamp</th>
                                                <th>Action</th>
                                                <th>License Plate</th>
                                                <th>Performed By</th>
                                                <th>Amount</th>
                                                <th>Payment Method</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {systemActivityData.activities.map((activity, idx) => (
                                                <tr key={idx}>
                                                    <td>{new Date(activity.timestamp).toLocaleString()}</td>
                                                    <td>
                                                        <span className={`action-badge ${activity.action}`}>
                                                            {activity.action}
                                                        </span>
                                                    </td>
                                                    <td>{activity.licensePlate}</td>
                                                    <td>{activity.performedBy || 'N/A'}</td>
                                                    <td>{formatCurrency(activity.amount)}</td>
                                                    <td>
                                                        <span className={`payment-badge ${activity.paymentMethod}`}>
                                                            {activity.paymentMethod || 'manual'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="no-data">No system activity found for the selected period.</div>
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

export default ComplianceReports;

