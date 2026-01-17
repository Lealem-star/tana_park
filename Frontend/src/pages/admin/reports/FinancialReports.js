import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { 
    fetchPeriodRevenueReport
} from '../../../api/api';
import { Download, DollarSign, Car } from 'lucide-react';
import { exportFinancialReportToPDF } from '../../../utils/pdfExport';
import { EthiopianDatePicker } from '../../../components';
import { EthiopianDateUtil } from 'habesha-datepicker';
import '../../../css/reports.scss';

const FinancialReports = () => {
    const user = useSelector((state) => state.user);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Period Revenue State
    const [periodStartDate, setPeriodStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [periodEndDate, setPeriodEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [periodData, setPeriodData] = useState(null);

    const loadPeriodReport = useCallback(() => {
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
    }, [user?.token, periodStartDate, periodEndDate]);

    useEffect(() => {
        loadPeriodReport();
    }, [loadPeriodReport]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-ET', {
            style: 'currency',
            currency: 'ETB',
            minimumFractionDigits: 2
        }).format(amount);
    };

    const handleExportPDF = async () => {
        try {
            if (periodData) {
                const title = 'Period Revenue Report';
                const subtitle = `From ${periodStartDate} to ${periodEndDate}`;
                const filename = `period-revenue-${periodStartDate}-${periodEndDate}.pdf`;
                await exportFinancialReportToPDF({ 
                    title, 
                    subtitle, 
                    data: periodData, 
                    filename, 
                    type: 'period' 
                });
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
            setError('Failed to export PDF. Please try again.');
        }
    };

    const formatDate = (dateString) => {
        // Convert Gregorian date to Ethiopian format since we're using Ethiopian date picker
        const gregorianDate = new Date(dateString);
        const ethiopianDate = EthiopianDateUtil.toEth(gregorianDate);
        
        // Format as "Day MonthName Year" (e.g., "10 ጃንዋሪ 2016" or "10 Jan 2026")
        return EthiopianDateUtil.formatEtDate(ethiopianDate, 'EC');
    };

    return (
        <div className="financial-reports">
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="report-section">
                <div className="report-header">
                    <h2>Period Revenue Report</h2>
                    <EthiopianDatePicker
                        value={periodStartDate}
                        onChange={(date) => setPeriodStartDate(date)}
                        label="Start Date"
                        className="date-input"
                    />
                    <span>to</span>
                    <EthiopianDatePicker
                        value={periodEndDate}
                        onChange={(date) => setPeriodEndDate(date)}
                        label="End Date"
                        className="date-input"
                    />
                    <button onClick={loadPeriodReport} className="btn-refresh" disabled={loading}>
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                    {periodData && (
                        <button 
                            onClick={handleExportPDF}
                            className="btn-export"
                        >
                            <Download size={16} />
                            Export PDF
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="loading">Loading report data...</div>
                ) : periodData ? (
                    <div className="report-content">
                        <div className="stats-grid">
                            <div className="stat-card revenue">
                                <div className="stat-icon">
                                    <DollarSign size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>{formatCurrency(periodData.totalRevenue || 0)}</h3>
                                    <p>Total Revenue</p>
                                </div>
                            </div>
                            <div className="stat-card cars">
                                <div className="stat-icon">
                                    <Car size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>{
                                        periodData.dailyBreakdown 
                                            ? periodData.dailyBreakdown.reduce((sum, item) => sum + (item.dailyParkedCar || 0), 0)
                                            : 0
                                    }</h3>
                                    <p>Total Car Parked</p>
                                </div>
                            </div>
                        </div>

                        {periodData.dailyBreakdown && periodData.dailyBreakdown.length > 0 && (() => {
                            // Group data by date
                            const groupedByDate = {};
                            periodData.dailyBreakdown.forEach(item => {
                                if (!groupedByDate[item.date]) {
                                    groupedByDate[item.date] = [];
                                }
                                groupedByDate[item.date].push(item);
                            });

                            // Sort dates in descending order (newest first) - latest date at top
                            const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
                                // Compare as strings (YYYY-MM-DD format sorts correctly)
                                // Descending order: b > a returns positive, so b comes first
                                return b.localeCompare(a);
                            });

                            return (
                                <div className="report-table-section">
                                    <h3>Daily Breakdown</h3>
                                    {sortedDates.map((date, dateIdx) => (
                                        <div key={dateIdx} className="daily-breakdown-group">
                                            <h4 className="date-header">{formatDate(date)}</h4>
                                            <table className="report-table">
                                                <thead>
                                                    <tr>
                                                        <th>Park Zone Code</th>
                                                        <th>Valet Officer Name</th>
                                                        <th>Daily Parked Car</th>
                                                        <th>Daily Revenue</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {groupedByDate[date].map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td>{item.parkZoneCode}</td>
                                                            <td>{item.valetName}</td>
                                                            <td>{item.dailyParkedCar}</td>
                                                            <td>{formatCurrency(item.dailyRevenue)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    <div className="no-data">No data available. Select date range and click Refresh.</div>
                )}
            </div>
        </div>
    );
};

export default FinancialReports;

