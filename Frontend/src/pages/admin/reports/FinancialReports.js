import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { 
    fetchPeriodRevenueReport
} from '../../../api/api';
import { Download, DollarSign, Car } from 'lucide-react';
import { exportFinancialReportToPDF } from '../../../utils/pdfExportReact';
import { EthiopianDatePicker } from '../../../components';
import { EthiopianDateUtil } from 'habesha-datepicker';
import '../../../css/reports.scss';

const FinancialReports = () => {
    const { t } = useTranslation();
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
                const title = t('reports.periodRevenueReport');
                const subtitle = `${t('reports.from')} ${periodStartDate} ${t('reports.to')} ${periodEndDate}`;
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
            setError(t('reports.failedToExport'));
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
                        <h2>{t('reports.periodRevenueReport')}</h2>
                    <EthiopianDatePicker
                                value={periodStartDate}
                        onChange={(date) => setPeriodStartDate(date)}
                        label={t('reports.startDate')}
                                className="date-input"
                            />
                            <span>{t('reports.to')}</span>
                    <EthiopianDatePicker
                                value={periodEndDate}
                        onChange={(date) => setPeriodEndDate(date)}
                        label={t('reports.endDate')}
                                className="date-input"
                            />
                            <button onClick={loadPeriodReport} className="btn-refresh" disabled={loading}>
                                {loading ? t('common.loading') : t('common.refresh')}
                            </button>
                            {periodData && (
                                <button 
                            onClick={handleExportPDF}
                                    className="btn-export"
                                >
                                    <Download size={16} />
                                    {t('reports.exportPDF')}
                                </button>
                            )}
                    </div>

                    {loading ? (
                        <div className="loading">{t('reports.loadingReport')}</div>
                    ) : periodData ? (
                        <div className="report-content">
                            <div className="stats-grid">
                                <div className="stat-card revenue">
                                <div className="stat-icon">
                                    <DollarSign size={24} />
                                </div>
                                <div className="stat-info">
                                    <h3>{formatCurrency(periodData.totalRevenue || 0)}</h3>
                                    <p>{t('admin.totalRevenue')}</p>
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
                                    <p>{t('admin.totalCarParked')}</p>
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
                                    <h3>{t('admin.dailyBreakdown')}</h3>
                                    {sortedDates.map((date, dateIdx) => (
                                        <div key={dateIdx} className="daily-breakdown-group">
                                            <h4 className="date-header">{formatDate(date)}</h4>
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                        <th>{t('dashboard.parkZoneCode')}</th>
                                                        <th>{t('dashboard.valetOfficerName')}</th>
                                                        <th>{t('dashboard.dailyParkedCar')}</th>
                                                        <th>{t('dashboard.dailyRevenue')}</th>
                                                        <th>{t('dashboard.vat')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                                    {groupedByDate[date].map((item, idx) => (
                                                <tr key={idx}>
                                                            <td>{item.parkZoneCode}</td>
                                                            <td>{item.valetName}</td>
                                                            <td>{item.dailyParkedCar}</td>
                                                            <td>{formatCurrency(item.dailyRevenue)}</td>
                                                            <td>{formatCurrency(item.dailyVAT || 0)}</td>
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
                        <div className="no-data">{t('reports.noDataForPeriod')}</div>
                    )}
                </div>
        </div>
    );
};

export default FinancialReports;

