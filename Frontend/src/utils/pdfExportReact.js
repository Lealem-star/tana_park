import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { pdf } from '@react-pdf/renderer';
import { EthiopianDateUtil } from 'habesha-datepicker';

// Register fonts for Amharic (Ethiopic script) support
// @react-pdf/renderer requires TTF or OTF format fonts (not WOFF/WOFF2)
// IMPORTANT: For proper Amharic support, you need to download TTF files:
// 1. Go to https://fonts.google.com/noto/specimen/Noto+Sans+Ethiopic
// 2. Download the TTF files (Regular and Bold)
// 3. Create public/fonts/ folder and place the TTF files there
// 4. Name them: NotoSansEthiopic-Regular.ttf and NotoSansEthiopic-Bold.ttf

// Try to register Amharic font from local TTF files
try {
    Font.register({
        family: 'NotoSansEthiopic',
        fonts: [
            {
                src: '/fonts/NotoSansEthiopic-Regular.ttf',
                fontWeight: 'normal',
            },
            {
                src: '/fonts/NotoSansEthiopic-Bold.ttf',
                fontWeight: 'bold',
            },
        ],
    });
    console.log('Amharic font registered successfully from local TTF files');
} catch (e) {
    console.warn('Amharic font not found. To enable proper Amharic support in PDFs:');
    console.warn('1. Download Noto Sans Ethiopic TTF files from Google Fonts');
    console.warn('2. Create public/fonts/ folder');
    console.warn('3. Place NotoSansEthiopic-Regular.ttf and NotoSansEthiopic-Bold.ttf in public/fonts/');
    console.warn('PDF will still work but Amharic characters may display incorrectly');
    // Will fall back to Helvetica which has limited Ethiopic support
}

// Register Helvetica as fallback (built-in support)
// @react-pdf/renderer has built-in Helvetica that supports basic Unicode

// Define styles
const styles = StyleSheet.create({
    page: {
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        padding: 20,
        fontFamily: 'Helvetica', // Built-in font with Unicode support
    },
    header: {
        marginBottom: 20,
        borderBottom: '2px solid #667eea',
        paddingBottom: 10,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    logo: {
        width: 40,
        height: 15,
        marginRight: 10,
    },
    companyName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#667eea',
        fontFamily: 'Helvetica', // Supports Unicode including Amharic
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#3c3c3c',
        marginTop: 5,
        fontFamily: 'Helvetica', // Supports Unicode including Amharic
    },
    subtitle: {
        fontSize: 11,
        color: '#646464',
        marginTop: 3,
        fontFamily: 'Helvetica', // Supports Unicode including Amharic
    },
    generatedDate: {
        fontSize: 10,
        color: '#787878',
        textAlign: 'right',
        marginTop: 5,
        fontFamily: 'Helvetica',
    },
    summary: {
        marginTop: 15,
        marginBottom: 15,
        padding: 10,
        backgroundColor: '#f8f9fa',
        borderRadius: 5,
    },
    summaryTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#3c3c3c',
        fontFamily: 'Helvetica',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
        fontSize: 10,
        fontFamily: 'Helvetica',
    },
    summaryLabel: {
        fontWeight: 'bold',
        color: '#505050',
        fontFamily: 'Helvetica',
    },
    summaryValue: {
        color: '#3c3c3c',
        fontFamily: 'NotoSansEthiopic',
    },
    table: {
        marginTop: 15,
        marginBottom: 15,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#667eea',
        padding: 8,
        borderRadius: 3,
    },
    tableHeaderCell: {
        flex: 1,
        fontSize: 10,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        fontFamily: 'NotoSansEthiopic',
    },
    tableRow: {
        flexDirection: 'row',
        padding: 8,
        borderBottom: '1px solid #e0e0e0',
    },
    tableRowEven: {
        backgroundColor: '#f8f9fa',
    },
    tableCell: {
        flex: 1,
        fontSize: 9,
        color: '#3c3c3c',
        textAlign: 'left',
        fontFamily: 'NotoSansEthiopic',
    },
    tableCellRight: {
        textAlign: 'right',
    },
    tableCellCenter: {
        textAlign: 'center',
    },
    dateSection: {
        marginTop: 20,
        marginBottom: 10,
    },
    dateHeader: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#3c3c3c',
        marginBottom: 8,
        fontFamily: 'NotoSansEthiopic',
    },
    footer: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        fontSize: 8,
        color: '#969696',
        textAlign: 'center',
        fontFamily: 'Helvetica',
    },
    pageNumber: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        fontSize: 8,
        color: '#969696',
        textAlign: 'center',
        fontFamily: 'Helvetica',
    },
});

// Helper function to format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ET', {
        style: 'currency',
        currency: 'ETB',
        minimumFractionDigits: 2
    }).format(amount || 0);
};

// Helper function to format date in Ethiopian calendar
const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
        const gregorianDate = new Date(date);
        const ethiopianDate = EthiopianDateUtil.toEth(gregorianDate);
        // Format as "Day MonthName Year" in Ethiopian calendar
        return EthiopianDateUtil.formatEtDate(ethiopianDate, 'EC');
    } catch (e) {
        // Fallback to Gregorian if conversion fails
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
};

// Helper function to get image as base64
const getImageAsBase64 = () => {
    return new Promise((resolve) => {
        const logoPaths = [
            '/Tana.png',
            './Tana.png',
            '../img/Tana.png',
            'Tana.png'
        ];

        const tryLoadLogo = (index) => {
            if (index >= logoPaths.length) {
                resolve(null);
                return;
            }

            const img = new window.Image();
            img.crossOrigin = 'Anonymous';
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    const base64 = canvas.toDataURL('image/png');
                    resolve(base64);
                } catch (e) {
                    tryLoadLogo(index + 1);
                }
            };
            
            img.onerror = () => {
                tryLoadLogo(index + 1);
            };
            
            img.src = logoPaths[index];
        };

        tryLoadLogo(0);
    });
};

// PDF Document Component for Financial Reports
const FinancialReportPDF = ({ title, subtitle, data, logoBase64, type = 'period' }) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Group data by date for period reports
    const groupedByDate = {};
    if (type === 'period' && data.dailyBreakdown) {
        data.dailyBreakdown.forEach(item => {
            if (!groupedByDate[item.date]) {
                groupedByDate[item.date] = [];
            }
            groupedByDate[item.date].push(item);
        });
    }

    const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

    const formatEthiopianDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const gregorianDate = new Date(dateString);
            const ethiopianDate = EthiopianDateUtil.toEth(gregorianDate);
            // Format as "Day MonthName Year" in Ethiopian calendar
            return EthiopianDateUtil.formatEtDate(ethiopianDate, 'EC');
        } catch (e) {
            // Fallback to Gregorian if conversion fails
            return new Date(dateString).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        }
    };

    // Render header component (reusable)
    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.logoContainer}>
                {logoBase64 && (
                    <Image src={logoBase64} style={styles.logo} />
                )}
                <Text style={styles.companyName}>TanaPark</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            <Text style={styles.generatedDate}>Generated on: {dateStr}</Text>
        </View>
    );

    // Render summary component
    const renderSummary = () => {
        if (type !== 'period') return null;
        
        // Calculate total VAT from daily breakdown
        const totalVAT = (data.dailyBreakdown || []).reduce((sum, item) => sum + (item.dailyVAT || 0), 0);
        
        return (
            <View style={styles.summary}>
                <Text style={styles.summaryTitle}>Summary</Text>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Period:</Text>
                    <Text style={styles.summaryValue}>
                        {formatDate(data.startDate)} to {formatDate(data.endDate)}
                    </Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Revenue:</Text>
                    <Text style={styles.summaryValue}>
                        {formatCurrency(data.totalRevenue || 0)}
                    </Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total VAT:</Text>
                    <Text style={styles.summaryValue}>
                        {formatCurrency(totalVAT)}
                    </Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Total Cars Parked:</Text>
                    <Text style={styles.summaryValue}>
                        {(data.dailyBreakdown || []).reduce((sum, item) => sum + (item.dailyParkedCar || 0), 0)}
                    </Text>
                </View>
            </View>
        );
    };

    // Render table for a date
    const renderDateTable = (date, dateItems) => (
        <View key={date}>
            <View style={styles.dateSection}>
                <Text style={styles.dateHeader}>{formatEthiopianDate(date)}</Text>
            </View>

            {/* Table Header */}
            <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Park Zone Code</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Valet Officer Name</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Daily Parked Car</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Daily Revenue</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>VAT</Text>
            </View>

            {/* Table Rows */}
            {dateItems.map((item, rowIndex) => (
                <View 
                    key={rowIndex} 
                    style={[
                        styles.tableRow,
                        rowIndex % 2 === 1 && styles.tableRowEven
                    ]}
                >
                    <Text style={[styles.tableCell, { flex: 0.7 }]}>
                        {item.parkZoneCode || 'N/A'}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>
                        {item.valetName || 'Unknown'}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellCenter, { flex: 0.7 }]}>
                        {item.dailyParkedCar || 0}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellRight, { flex: 0.8 }]}>
                        {formatCurrency(item.dailyRevenue || 0)}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableCellRight, { flex: 0.7 }]}>
                        {formatCurrency(item.dailyVAT || 0)}
                    </Text>
                </View>
            ))}
        </View>
    );

    return (
        <Document>
            {/* First page with header and summary */}
            <Page size="A4" style={styles.page}>
                {renderHeader()}
                {renderSummary()}
                
                {/* First date table if available */}
                {sortedDates.length > 0 && renderDateTable(sortedDates[0], groupedByDate[sortedDates[0]])}
                
                <Text style={styles.footer}>
                    TanaPark - Professional Parking Management System
                </Text>
            </Page>

            {/* Additional pages for remaining dates */}
            {sortedDates.slice(1).map((date) => (
                <Page key={date} size="A4" style={styles.page}>
                    {renderHeader()}
                    {renderDateTable(date, groupedByDate[date])}
                    <Text style={styles.footer}>
                        TanaPark - Professional Parking Management System
                    </Text>
                </Page>
            ))}
        </Document>
    );
};

// Export function for Financial Reports
export const exportFinancialReportToPDF = async ({
    title,
    subtitle,
    data,
    filename,
    type = 'period'
}) => {
    try {
        // Load logo
        const logoBase64 = await getImageAsBase64();

        // Create PDF document
        const doc = (
            <FinancialReportPDF
                title={title}
                subtitle={subtitle}
                data={data}
                logoBase64={logoBase64}
                type={type}
            />
        );

        // Generate PDF blob
        const blob = await pdf(doc).toBlob();
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
};

// PDF Document Component for Administrative Reports
const AdministrativeReportPDF = ({ title, subtitle, data, logoBase64, type = 'users' }) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.logoContainer}>
                {logoBase64 && (
                    <Image src={logoBase64} style={styles.logo} />
                )}
                <Text style={styles.companyName}>TanaPark</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            <Text style={styles.generatedDate}>Generated on: {dateStr}</Text>
        </View>
    );

    if (type === 'users') {
        const valetUsers = [];
        const administrativeUsers = [];

        (data.usersByType || []).forEach(typeGroup => {
            if (typeGroup.type === 'valet') {
                valetUsers.push(...typeGroup.users);
            } else if (typeGroup.type === 'system_admin' || typeGroup.type === 'manager') {
                administrativeUsers.push(...typeGroup.users);
            }
        });

        return (
            <Document>
                <Page size="A4" style={styles.page}>
                    {renderHeader()}
                    
                    <View style={styles.summary}>
                        <Text style={styles.summaryTitle}>Summary</Text>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Total officers:</Text>
                            <Text style={styles.summaryValue}>{data.totalUsers || 0}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Valet:</Text>
                            <Text style={styles.summaryValue}>{valetUsers.length}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Administrative:</Text>
                            <Text style={styles.summaryValue}>{administrativeUsers.length}</Text>
                        </View>
                    </View>

                    {valetUsers.length > 0 && (
                        <View style={{ marginTop: 15 }}>
                            <Text style={styles.dateHeader}>Valet ({valetUsers.length})</Text>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Name</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Phone Number</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Park Zone Code</Text>
                            </View>
                            {valetUsers.map((user, index) => (
                                <View key={index} style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}>
                                    <Text style={[styles.tableCell, { flex: 1 }]}>{user.name || 'N/A'}</Text>
                                    <Text style={[styles.tableCell, { flex: 1 }]}>{user.phoneNumber || 'N/A'}</Text>
                                    <Text style={[styles.tableCell, { flex: 0.8 }]}>{user.parkZoneCode || 'N/A'}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {administrativeUsers.length > 0 && (
                        <View style={{ marginTop: 15 }}>
                            <Text style={styles.dateHeader}>Administrative ({administrativeUsers.length})</Text>
                            <View style={styles.tableHeader}>
                                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Name</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Phone Number</Text>
                                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Role</Text>
                            </View>
                            {administrativeUsers.map((user, index) => (
                                <View key={index} style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}>
                                    <Text style={[styles.tableCell, { flex: 1 }]}>{user.name || 'N/A'}</Text>
                                    <Text style={[styles.tableCell, { flex: 1 }]}>{user.phoneNumber || 'N/A'}</Text>
                                    <Text style={[styles.tableCell, { flex: 0.8 }]}>
                                        {user.role || (data.usersByType?.find(t => t.type === 'system_admin' || t.type === 'manager')?.type || 'N/A')}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    <Text style={styles.footer}>
                        TanaPark - Professional Parking Management System
                    </Text>
                </Page>
            </Document>
        );
    }

    return null;
};

// Export function for Administrative Reports
export const exportAdministrativeReportToPDF = async ({
    title,
    subtitle,
    data,
    filename,
    type = 'users'
}) => {
    try {
        const logoBase64 = await getImageAsBase64();
        const doc = (
            <AdministrativeReportPDF
                title={title}
                subtitle={subtitle}
                data={data}
                logoBase64={logoBase64}
                type={type}
            />
        );
        const blob = await pdf(doc).toBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
};

// PDF Document Component for Customer Reports
const CustomerReportPDF = ({ title, subtitle, data, logoBase64, type = 'vehicle-history' }) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.logoContainer}>
                {logoBase64 && (
                    <Image src={logoBase64} style={styles.logo} />
                )}
                <Text style={styles.companyName}>TanaPark</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            <Text style={styles.generatedDate}>Generated on: {dateStr}</Text>
        </View>
    );

    if (type === 'vehicle-history') {
        const formatDateTime = (date) => {
            if (!date) return 'N/A';
            return new Date(date).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        return (
            <Document>
                <Page size="A4" style={styles.page}>
                    {renderHeader()}
                    
                    {data.totalVisits && (
                        <View style={styles.summary}>
                            <Text style={styles.summaryTitle}>Summary</Text>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Total Visits:</Text>
                                <Text style={styles.summaryValue}>{data.totalVisits}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Total Paid:</Text>
                                <Text style={styles.summaryValue}>{formatCurrency(data.totalPaid || 0)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Average Payment:</Text>
                                <Text style={styles.summaryValue}>{formatCurrency(data.averagePayment || 0)}</Text>
                            </View>
                        </View>
                    )}

                    <View style={{ marginTop: 15 }}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Parked At</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Checked Out At</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>License Plate</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Model</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 0.5 }]}>Status</Text>
                            <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Amount</Text>
                        </View>
                        {(data.history || []).map((item, index) => (
                            <View key={index} style={[styles.tableRow, index % 2 === 1 && styles.tableRowEven]}>
                                <Text style={[styles.tableCell, { flex: 0.8, fontSize: 8 }]}>
                                    {formatDateTime(item.parkedAt)}
                                </Text>
                                <Text style={[styles.tableCell, { flex: 0.8, fontSize: 8 }]}>
                                    {formatDateTime(item.checkedOutAt)}
                                </Text>
                                <Text style={[styles.tableCell, { flex: 0.7 }]}>{item.licensePlate || 'N/A'}</Text>
                                <Text style={[styles.tableCell, { flex: 0.6 }]}>{item.model || 'N/A'}</Text>
                                <Text style={[styles.tableCell, { flex: 0.5 }]}>{item.status || 'N/A'}</Text>
                                <Text style={[styles.tableCell, styles.tableCellRight, { flex: 0.6 }]}>
                                    {formatCurrency(item.totalPaidAmount || 0)}
                                </Text>
                            </View>
                        ))}
                    </View>

                    <Text style={styles.footer}>
                        TanaPark - Professional Parking Management System
                    </Text>
                </Page>
            </Document>
        );
    }

    return null;
};

// Export function for Customer Reports
export const exportCustomerReportToPDF = async ({
    title,
    subtitle,
    data,
    filename,
    type = 'vehicle-history'
}) => {
    try {
        const logoBase64 = await getImageAsBase64();
        const doc = (
            <CustomerReportPDF
                title={title}
                subtitle={subtitle}
                data={data}
                logoBase64={logoBase64}
                type={type}
            />
        );
        const blob = await pdf(doc).toBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
};

