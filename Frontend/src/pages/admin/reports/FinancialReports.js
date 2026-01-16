import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
    fetchDailyRevenueReport, 
    fetchPeriodRevenueReport, 
    fetchPlateCodeRevenueReport, 
    fetchPaymentMethodsReport 
} from '../../../api/api';
import { Calendar, DollarSign, TrendingUp, Download, BarChart3, PieChart } from 'lucide-react';
import { exportFinancialReportToPDF } from '../../../utils/pdfExport';
import '../../../css/reports.scss';

const FinancialReports = () => {
    const user = useSelector((state) => state.user);
    const [activeReport, setActiveReport] = useState('daily');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Daily Revenue State
    const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailyData, setDailyData] = useState(null);

    // Period Revenue State
    const [periodStartDate, setPeriodStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [periodEndDate, setPeriodEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [periodData, setPeriodData] = useState(null);

    // Plate Code Revenue State
    const [plateCodeStartDate, setPlateCodeStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [plateCodeEndDate, setPlateCodeEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [plateCodeData, setPlateCodeData] = useState(null);

    // Payment Methods State
    const [paymentStartDate, setPaymentStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [paymentEndDate, setPaymentEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentData, setPaymentData] = useState(null);

    useEffect(() => {
        if (activeReport === 'daily') {
            loadDailyReport();
        } else if (activeReport === 'period') {
            loadPeriodReport();
        } else if (activeReport === 'plate-code') {
            loadPlateCodeReport();
        } else if (activeReport === 'payment-methods') {
            loadPaymentMethodsReport();
        }
    }, [activeReport]);

    const loadDailyReport = () => {
        setLoading(true);
        setError('');
        fetchDailyRevenueReport({
            token: user?.token,
            date: dailyDate,
            setData: (data) => {
                setDailyData(data);
                setLoading(false);
            },
            handleError: (err) => {
                setError(err);
                setLoading(false);
            }
        });
    };

    const loadPeriodReport = () => {
        setLoading(true);
        setError('');
        fetchPeriodRevenueReport({
            token: user?.token,
            startDate: periodStartDate,
            endDate: periodEndDate,
            setData: (data) => {
                setPeriodData(data);
                setLoading(false);
            },
            handleError: (err) => {
                setError(err);
                setLoading(false);
            }
        });
    };

    const loadPlateCodeReport = () => {
        setLoading(true);
        setError('');
        fetchPlateCodeRevenueReport({
            token: user?.token,
            startDate: plateCodeStartDate,
            endDate: plateCodeEndDate,
            setData: (data) => {
                setPlateCodeData(data);
                setLoading(false);
            },
            handleError: (err) => {
                setError(err);
                setLoading(false);
            }
        });
    };

    const loadPaymentMethodsReport = () => {
        setLoading(true);
        setError('');
        fetchPaymentMethodsReport({
            token: user?.token,
            startDate: paymentStartDate,
            endDate: paymentEndDate,
            setData: (data) => {
                setPaymentData(data);
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
            
            if (type === 'daily' && dailyData) {
                data = dailyData;
                title = 'Daily Revenue Report';
                subtitle = `Date: ${dailyDate}`;
                filename = `daily-revenue-${dailyDate}.pdf`;
                await exportFinancialReportToPDF({ title, subtitle, data, filename, type: 'daily' });
            } else if (type === 'period' && periodData) {
                data = periodData;
                title = 'Period Revenue Report';
                subtitle = `From ${periodStartDate} to ${periodEndDate}`;
                filename = `period-revenue-${periodStartDate}-${periodEndDate}.pdf`;
                await exportFinancialReportToPDF({ title, subtitle, data, filename, type: 'period' });
            } else if (type === 'plate-code' && plateCodeData) {
                data = plateCodeData;
                title = 'Revenue by Plate Code';
                subtitle = `From ${plateCodeStartDate} to ${plateCodeEndDate}`;
                filename = `plate-code-revenue-${plateCodeStartDate}-${plateCodeEndDate}.pdf`;
                await exportFinancialReportToPDF({ title, subtitle, data, filename, type: 'plate-code' });
            } else if (type === 'payment-methods' && paymentData) {
                data = paymentData;
                title = 'Payment Methods Analysis';
                subtitle = `From ${paymentStartDate} to ${paymentEndDate}`;
                filename = `payment-methods-${paymentStartDate}-${paymentEndDate}.pdf`;
                await exportFinancialReportToPDF({ title, subtitle, data, filename, type: 'payment-methods' });
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
            setError('Failed to export PDF. Please try again.');
        }
    };

    return (
        <div className="financial-reports">
            <div className="report-tabs">
                <button 
                    className={activeReport === 'daily' ? 'active' : ''}
                    onClick={() => setActiveReport('daily')}
                >
                    <Calendar size={18} />
                    Daily Revenue
                </button>
                <button 
                    className={activeReport === 'period' ? 'active' : ''}
                    onClick={() => setActiveReport('period')}
                >
                    <TrendingUp size={18} />
                    Period Revenue
                </button>
                <button 
                    className={activeReport === 'plate-code' ? 'active' : ''}
                    onClick={() => setActiveReport('plate-code')}
                >
                    <BarChart3 size={18} />
                    Revenue by Plate Code
                </button>
                <button 
                    className={activeReport === 'payment-methods' ? 'active' : ''}
                    onClick={() => setActiveReport('payment-methods')}
                >
                    <PieChart size={18} />
                    Payment Methods
                </button>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {activeReport === 'daily' && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Daily Revenue Report</h2>
                        <div className="report-controls">
                            <input
                                type="date"
                                value={dailyDate}
                                onChange={(e) => setDailyDate(e.target.value)}
                                className="date-input"
                            />
                            <button onClick={loadDailyReport} className="btn-refresh" disabled={loading}>
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
                            {dailyData && (
                                <button 
                                    onClick={() => handleExportPDF('daily')}
                                    className="btn-export"
                                >
                                    <Download size={16} />
                                    Export PDF
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading report data...</div>
                    ) : dailyData ? (
                        <div className="report-content">
                            <div className="stats-grid">
                                <div className="stat-card revenue">
                                    <div className="stat-icon">
                                        <DollarSign size={24} />
                                    </div>
                                    <div className="stat-info">
                                        <h3>{formatCurrency(dailyData.totalRevenue)}</h3>
                                        <p>Total Revenue</p>
                                    </div>
                                </div>
                                <div className="stat-card manual">
                                    <div className="stat-icon">
                                        <DollarSign size={24} />
                                    </div>
                                    <div className="stat-info">
                                        <h3>{formatCurrency(dailyData.manualRevenue)}</h3>
                                        <p>Manual Payments</p>
                                    </div>
                                </div>
                                <div className="stat-card online">
                                    <div className="stat-icon">
                                        <DollarSign size={24} />
                                    </div>
                                    <div className="stat-info">
                                        <h3>{formatCurrency(dailyData.onlineRevenue)}</h3>
                                        <p>Online Payments</p>
                                    </div>
                                </div>
                                <div className="stat-card transactions">
                                    <div className="stat-icon">
                                        <TrendingUp size={24} />
                                    </div>
                                    <div className="stat-info">
                                        <h3>{dailyData.totalTransactions}</h3>
                                        <p>Total Transactions</p>
                                    </div>
                                </div>
                            </div>

                            {dailyData.revenueByValet && dailyData.revenueByValet.length > 0 && (
                                <div className="report-table-section">
                                    <h3>Revenue by Valet</h3>
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                <th>Valet Name</th>
                                                <th>Transactions</th>
                                                <th>Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dailyData.revenueByValet.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>{item.valetName}</td>
                                                    <td>{item.transactionCount}</td>
                                                    <td>{formatCurrency(item.revenue)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="no-data">No data available. Select a date and click Refresh.</div>
                    )}
                </div>
            )}

            {activeReport === 'period' && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Period Revenue Report</h2>
                        <div className="report-controls">
                            <input
                                type="date"
                                value={periodStartDate}
                                onChange={(e) => setPeriodStartDate(e.target.value)}
                                className="date-input"
                            />
                            <span>to</span>
                            <input
                                type="date"
                                value={periodEndDate}
                                onChange={(e) => setPeriodEndDate(e.target.value)}
                                className="date-input"
                            />
                            <button onClick={loadPeriodReport} className="btn-refresh" disabled={loading}>
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
                            {periodData && (
                                <button 
                                    onClick={() => handleExportPDF('period')}
                                    className="btn-export"
                                >
                                    <Download size={16} />
                                    Export PDF
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading report data...</div>
                    ) : periodData ? (
                        <div className="report-content">
                            <div className="stats-grid">
                                <div className="stat-card revenue">
                                    <h3>{formatCurrency(periodData.totalRevenue)}</h3>
                                    <p>Total Revenue</p>
                                </div>
                                <div className="stat-card manual">
                                    <h3>{formatCurrency(periodData.manualRevenue)}</h3>
                                    <p>Manual Payments</p>
                                </div>
                                <div className="stat-card online">
                                    <h3>{formatCurrency(periodData.onlineRevenue)}</h3>
                                    <p>Online Payments</p>
                                </div>
                                <div className="stat-card transactions">
                                    <h3>{periodData.totalTransactions}</h3>
                                    <p>Total Transactions</p>
                                </div>
                                <div className="stat-card average">
                                    <h3>{formatCurrency(periodData.averageTransaction)}</h3>
                                    <p>Average Transaction</p>
                                </div>
                            </div>

                            {periodData.dailyBreakdown && periodData.dailyBreakdown.length > 0 && (
                                <div className="report-table-section">
                                    <h3>Daily Breakdown</h3>
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Revenue</th>
                                                <th>Transactions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {periodData.dailyBreakdown.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>{item.date}</td>
                                                    <td>{formatCurrency(item.revenue)}</td>
                                                    <td>{item.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="no-data">No data available. Select date range and click Refresh.</div>
                    )}
                </div>
            )}

            {activeReport === 'plate-code' && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Revenue by Plate Code</h2>
                        <div className="report-controls">
                            <input
                                type="date"
                                value={plateCodeStartDate}
                                onChange={(e) => setPlateCodeStartDate(e.target.value)}
                                className="date-input"
                            />
                            <span>to</span>
                            <input
                                type="date"
                                value={plateCodeEndDate}
                                onChange={(e) => setPlateCodeEndDate(e.target.value)}
                                className="date-input"
                            />
                            <button onClick={loadPlateCodeReport} className="btn-refresh" disabled={loading}>
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
                            {plateCodeData && (
                                <button 
                                    onClick={() => handleExportPDF('plate-code')}
                                    className="btn-export"
                                >
                                    <Download size={16} />
                                    Export PDF
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading report data...</div>
                    ) : plateCodeData ? (
                        <div className="report-content">
                            {plateCodeData.revenueByPlateCode && plateCodeData.revenueByPlateCode.length > 0 && (
                                <div className="report-table-section">
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                <th>Plate Code</th>
                                                <th>Revenue</th>
                                                <th>Transactions</th>
                                                <th>Average Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {plateCodeData.revenueByPlateCode.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td><strong>{item.plateCode}</strong></td>
                                                    <td>{formatCurrency(item.revenue)}</td>
                                                    <td>{item.transactionCount}</td>
                                                    <td>{formatCurrency(item.averageRevenue)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="no-data">No data available. Select date range and click Refresh.</div>
                    )}
                </div>
            )}

            {activeReport === 'payment-methods' && (
                <div className="report-section">
                    <div className="report-header">
                        <h2>Payment Methods Analysis</h2>
                        <div className="report-controls">
                            <input
                                type="date"
                                value={paymentStartDate}
                                onChange={(e) => setPaymentStartDate(e.target.value)}
                                className="date-input"
                            />
                            <span>to</span>
                            <input
                                type="date"
                                value={paymentEndDate}
                                onChange={(e) => setPaymentEndDate(e.target.value)}
                                className="date-input"
                            />
                            <button onClick={loadPaymentMethodsReport} className="btn-refresh" disabled={loading}>
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
                            {paymentData && (
                                <button 
                                    onClick={() => handleExportPDF('payment-methods')}
                                    className="btn-export"
                                >
                                    <Download size={16} />
                                    Export PDF
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loading">Loading report data...</div>
                    ) : paymentData ? (
                        <div className="report-content">
                            <div className="stats-grid">
                                <div className="stat-card manual">
                                    <h3>{paymentData.manual.count}</h3>
                                    <p>Manual Transactions</p>
                                    <div className="stat-detail">
                                        <span>{formatCurrency(paymentData.manual.revenue)}</span>
                                        <span className="percentage">{paymentData.manual.percentage.toFixed(1)}%</span>
                                    </div>
                                </div>
                                <div className="stat-card online">
                                    <h3>{paymentData.online.count}</h3>
                                    <p>Online Transactions</p>
                                    <div className="stat-detail">
                                        <span>{formatCurrency(paymentData.online.revenue)}</span>
                                        <span className="percentage">{paymentData.online.percentage.toFixed(1)}%</span>
                                    </div>
                                </div>
                                <div className="stat-card revenue">
                                    <h3>{formatCurrency(paymentData.total.revenue)}</h3>
                                    <p>Total Revenue</p>
                                    <div className="stat-detail">
                                        <span>{paymentData.total.count} transactions</span>
                                    </div>
                                </div>
                            </div>

                            <div className="comparison-section">
                                <h3>Payment Method Comparison</h3>
                                <div className="comparison-bars">
                                    <div className="comparison-bar">
                                        <div className="bar-label">Manual</div>
                                        <div className="bar-container">
                                            <div 
                                                className="bar manual-bar" 
                                                style={{ width: `${paymentData.manual.percentage}%` }}
                                            >
                                                {paymentData.manual.percentage.toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>
                                    <div className="comparison-bar">
                                        <div className="bar-label">Online</div>
                                        <div className="bar-container">
                                            <div 
                                                className="bar online-bar" 
                                                style={{ width: `${paymentData.online.percentage}%` }}
                                            >
                                                {paymentData.online.percentage.toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="no-data">No data available. Select date range and click Refresh.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FinancialReports;

