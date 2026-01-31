import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { pdf } from '@react-pdf/renderer';

// Register fonts for Amharic (Ethiopic script) support
// @react-pdf/renderer supports Unicode by default, but we register fonts for better rendering
// Using Noto Sans Ethiopic for Amharic support
try {
    Font.register({
        family: 'NotoSansEthiopic',
        fonts: [
            {
                src: 'https://fonts.gstatic.com/s/notosansethiopic/v26/7cHtv4sD05XfeXFEeyuGGOqg5zhkS1n3p3_NHP.woff2',
            },
            {
                src: 'https://fonts.gstatic.com/s/notosansethiopic/v26/7cHrv4sD05XfeXFEeyuGGOqg5zhkS1n3p3_NHP.woff2',
                fontWeight: 'bold',
            },
        ],
    });
} catch (e) {
    console.warn('Could not register Amharic font:', e);
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
        fontFamily: 'Helvetica',
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
        fontFamily: 'Helvetica',
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
        fontFamily: 'Helvetica',
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
        fontFamily: 'Helvetica',
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

// Helper function to format date
const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
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

            const img = new Image();
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
        const gregorianDate = new Date(dateString);
        return gregorianDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
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
    const renderSummary = () => (
        type === 'period' && (
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
                    <Text style={styles.summaryLabel}>Total Cars Parked:</Text>
                    <Text style={styles.summaryValue}>
                        {(data.dailyBreakdown || []).reduce((sum, item) => sum + (item.dailyParkedCar || 0), 0)}
                    </Text>
                </View>
            </View>
        )
    );

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

