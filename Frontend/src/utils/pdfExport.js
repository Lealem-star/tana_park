import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to load image as base64
const getImageAsBase64 = () => {
    return new Promise((resolve) => {
        // Try multiple paths for the logo
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
                    // Try next path
                    tryLoadLogo(index + 1);
                }
            };
            
            img.onerror = () => {
                // Try next path
                tryLoadLogo(index + 1);
            };
            
            img.src = logoPaths[index];
        };

        // Also try fetching as blob
        const tryFetchLogo = async () => {
            for (const path of logoPaths) {
                try {
                    const response = await fetch(path);
                    if (response.ok) {
                        const blob = await response.blob();
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.onerror = () => {};
                        reader.readAsDataURL(blob);
                        return;
                    }
                } catch (e) {
                    // Continue to next path
                }
            }
            // If all paths fail, try image loading
            tryLoadLogo(0);
        };

        tryFetchLogo();
    });
};

// Format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ET', {
        style: 'currency',
        currency: 'ETB',
        minimumFractionDigits: 2
    }).format(amount || 0);
};

// Format date
const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// Format datetime
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

// Create PDF header with logo and company name
const createPDFHeader = async (doc, title, subtitle = null) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    
    // Try to load logo
    let logoBase64 = null;
    try {
        logoBase64 = await getImageAsBase64();
    } catch (e) {
        console.warn('Could not load logo:', e);
    }

    // Add logo if available
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', margin, 15, 40, 15);
        } catch (e) {
            console.warn('Could not add logo to PDF:', e);
        }
    }

    // Company name and title
    doc.setFontSize(20);
    doc.setTextColor(102, 126, 234); // #667eea
    doc.setFont('helvetica', 'bold');
    doc.text('TanaPark', logoBase64 ? margin + 45 : margin, 25);
    
    doc.setFontSize(16);
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(title, margin, 35);
    
    if (subtitle) {
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.text(subtitle, margin, 42);
    }

    // Date and time
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    doc.text(`Generated on: ${dateStr}`, pageWidth - margin, 25, { align: 'right' });

    // Draw line separator
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, 48, pageWidth - margin, 48);
    
    return 55; // Return Y position after header
};

// Export table data to PDF
export const exportTableToPDF = async ({
    title,
    subtitle = null,
    columns = [],
    data = [],
    filename = 'report.pdf',
    summary = null,
    additionalInfo = null
}) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = await createPDFHeader(doc, title, subtitle);

    // Pre-render header once and reuse logo for subsequent pages
    // Add summary if provided
    if (summary) {
        yPos += 5;
        doc.setFontSize(12);
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'bold');
        doc.text('Summary', margin, yPos);
        yPos += 5;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);

        for (const item of summary) {
            if (yPos > pageHeight - 40) {
                doc.addPage();
                // For additional pages we just reset yPos below the header area
                yPos = margin + 35;
                yPos += 5;
            }
            doc.text(`${item.label}: ${item.value}`, margin, yPos);
            yPos += 6;
        }
        yPos += 3;
    }

    // Add additional info if provided
    if (additionalInfo) {
        yPos += 5;
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);

        for (const info of additionalInfo) {
            if (yPos > pageHeight - 40) {
                doc.addPage();
                yPos = margin + 35;
                yPos += 5;
            }
            doc.text(info, margin, yPos);
            yPos += 5;
        }
        yPos += 3;
    }

    // Prepare table data
    const tableData = data.map(row => {
        return columns.map(col => {
            const value = row[col.key];
            if (col.format === 'currency') {
                return formatCurrency(value);
            } else if (col.format === 'date') {
                return formatDate(value);
            } else if (col.format === 'datetime') {
                return formatDateTime(value);
            } else if (col.format === 'percentage') {
                return typeof value === 'number' ? `${value.toFixed(2)}%` : value;
            } else if (col.format === 'number') {
                return typeof value === 'number' ? value.toLocaleString() : value;
            }
            return value !== null && value !== undefined ? String(value) : 'N/A';
        });
    });

    // Add table
    autoTable(doc, {
        startY: yPos,
        head: [columns.map(col => col.label)],
        body: tableData,
        theme: 'striped',
        headStyles: {
            fillColor: [102, 126, 234],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 10
        },
        bodyStyles: {
            fontSize: 9,
            textColor: [60, 60, 60]
        },
        alternateRowStyles: {
            fillColor: [248, 249, 250]
        },
        margin: { left: margin, right: margin },
        styles: {
            cellPadding: 3,
            overflow: 'linebreak',
            cellWidth: 'wrap'
        },
        columnStyles: columns.reduce((acc, col, idx) => {
            if (col.width) {
                acc[idx] = { cellWidth: col.width };
            }
            if (col.align) {
                acc[idx] = { ...acc[idx], halign: col.align };
            }
            return acc;
        }, {}),
        didDrawPage: (data) => {
            // Add page number
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            const pageCount = doc.internal.getNumberOfPages();
            doc.text(
                `Page ${data.pageNumber} of ${pageCount}`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );
        }
    });

    // Add footer
    const finalY = doc.lastAutoTable.finalY || yPos;
    if (finalY < pageHeight - 20) {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
            'TanaPark - Professional Parking Management System',
            pageWidth / 2,
            pageHeight - 10,
            { align: 'center' }
        );
    }

    // Save PDF
    doc.save(filename);
};

// Export financial report to PDF
export const exportFinancialReportToPDF = async ({
    title,
    subtitle,
    data,
    filename,
    type = 'daily' // daily, period, plate-code, payment-methods
}) => {
    if (type === 'daily') {
        const summary = [
            { label: 'Total Revenue', value: formatCurrency(data.totalRevenue) },
            { label: 'Manual Payments', value: formatCurrency(data.manualRevenue) },
            { label: 'Online Payments', value: formatCurrency(data.onlineRevenue) },
            { label: 'Total Transactions', value: data.totalTransactions }
        ];

        const columns = [
            { key: 'valetName', label: 'Valet Name', width: 60 },
            { key: 'transactionCount', label: 'Transactions', width: 40, align: 'center' },
            { key: 'revenue', label: 'Revenue', width: 50, format: 'currency', align: 'right' }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: data.revenueByValet || [],
            filename,
            summary
        });
    } else if (type === 'period') {
        const summary = [
            { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(data.endDate)}` },
            { label: 'Total Revenue', value: formatCurrency(data.totalRevenue) },
            { label: 'Manual Payments', value: formatCurrency(data.manualRevenue) },
            { label: 'Online Payments', value: formatCurrency(data.onlineRevenue) },
            { label: 'Total Transactions', value: data.totalTransactions },
            { label: 'Average Transaction', value: formatCurrency(data.averageTransaction) }
        ];

        const columns = [
            { key: 'date', label: 'Date', width: 50 },
            { key: 'revenue', label: 'Revenue', width: 50, format: 'currency', align: 'right' },
            { key: 'count', label: 'Transactions', width: 40, align: 'center' }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: data.dailyBreakdown || [],
            filename,
            summary
        });
    } else if (type === 'plate-code') {
        const summary = [
            { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(data.endDate)}` }
        ];

        const columns = [
            { key: 'plateCode', label: 'Plate Code', width: 40 },
            { key: 'revenue', label: 'Revenue', width: 50, format: 'currency', align: 'right' },
            { key: 'transactionCount', label: 'Transactions', width: 35, align: 'center' },
            { key: 'averageRevenue', label: 'Avg Revenue', width: 45, format: 'currency', align: 'right' }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: data.revenueByPlateCode || [],
            filename,
            summary
        });
    } else if (type === 'payment-methods') {
        const summary = [
            { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(data.endDate)}` },
            { label: 'Manual Transactions', value: `${data.manual.count} (${data.manual.percentage.toFixed(1)}%)` },
            { label: 'Manual Revenue', value: formatCurrency(data.manual.revenue) },
            { label: 'Online Transactions', value: `${data.online.count} (${data.online.percentage.toFixed(1)}%)` },
            { label: 'Online Revenue', value: formatCurrency(data.online.revenue) },
            { label: 'Total Revenue', value: formatCurrency(data.total.revenue) }
        ];

        // Create comparison data
        const comparisonData = [
            {
                method: 'Manual',
                count: data.manual.count,
                revenue: data.manual.revenue,
                percentage: data.manual.percentage,
                average: data.manual.averageTransaction
            },
            {
                method: 'Online',
                count: data.online.count,
                revenue: data.online.revenue,
                percentage: data.online.percentage,
                average: data.online.averageTransaction
            }
        ];

        const columns = [
            { key: 'method', label: 'Payment Method', width: 50 },
            { key: 'count', label: 'Transactions', width: 40, align: 'center' },
            { key: 'revenue', label: 'Revenue', width: 50, format: 'currency', align: 'right' },
            { key: 'percentage', label: 'Percentage', width: 35, format: 'percentage', align: 'center' },
            { key: 'average', label: 'Avg Transaction', width: 45, format: 'currency', align: 'right' }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: comparisonData,
            filename,
            summary
        });
    }
};

// Export operational report to PDF
export const exportOperationalReportToPDF = async ({
    title,
    subtitle,
    data,
    filename,
    type = 'activity'
}) => {
    if (type === 'activity') {
        const summary = [
            { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(data.endDate)}` },
            { label: 'Total Parked', value: data.totalParked },
            { label: 'Checked Out', value: data.checkedOut },
            { label: 'Still Parked', value: data.stillParked },
            { label: 'Violations', value: data.violations },
            { label: 'Checkout Rate', value: `${data.checkoutRate.toFixed(1)}%` }
        ];

        const columns = [
            { key: 'date', label: 'Date', width: 50 },
            { key: 'parked', label: 'Parked', width: 30, align: 'center' },
            { key: 'checkedOut', label: 'Checked Out', width: 40, align: 'center' },
            { key: 'violations', label: 'Violations', width: 30, align: 'center' }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: data.dailyActivity || [],
            filename,
            summary
        });
    } else if (type === 'duration') {
        const summary = [
            { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(data.endDate)}` },
            { label: 'Total Checked Out', value: data.totalCheckedOut },
            { label: 'Average Duration', value: `${data.averageDuration.toFixed(2)} hours` },
            { label: 'Min Duration', value: `${data.minDuration.toFixed(2)} hours` },
            { label: 'Max Duration', value: `${data.maxDuration.toFixed(2)} hours` }
        ];

        const distributionData = Object.entries(data.distribution || {}).map(([range, count]) => ({
            range: `${range} hours`,
            count,
            percentage: data.totalCheckedOut > 0 ? ((count / data.totalCheckedOut) * 100).toFixed(1) : 0
        }));

        const columns = [
            { key: 'range', label: 'Duration Range', width: 50 },
            { key: 'count', label: 'Count', width: 40, align: 'center' },
            { key: 'percentage', label: 'Percentage', width: 40, format: 'percentage', align: 'center' }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: distributionData,
            filename,
            summary
        });
    } else if (type === 'location') {
        const summary = [
            { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(data.endDate)}` }
        ];

        const columns = [
            { key: 'location', label: 'Location', width: 50 },
            { key: 'totalParked', label: 'Total Parked', width: 35, align: 'center' },
            { key: 'checkedOut', label: 'Checked Out', width: 35, align: 'center' },
            { key: 'stillParked', label: 'Still Parked', width: 35, align: 'center' },
            { key: 'utilizationRate', label: 'Utilization Rate', width: 35, format: 'percentage', align: 'center' }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: data.locationStats || [],
            filename,
            summary
        });
    } else if (type === 'peak-hours') {
        const summary = [
            { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(data.endDate)}` }
        ];

        const columns = [
            { key: 'hourLabel', label: 'Hour', width: 40 },
            { key: 'parked', label: 'Parked', width: 40, align: 'center' },
            { key: 'checkedOut', label: 'Checked Out', width: 50, align: 'center' }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: data.hourlyStats || [],
            filename,
            summary
        });
    } else if (type === 'plate-code-dist') {
        const summary = [
            { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(data.endDate)}` }
        ];

        const columns = [
            { key: 'plateCode', label: 'Plate Code', width: 40 },
            { key: 'count', label: 'Count', width: 30, align: 'center' },
            { key: 'percentage', label: 'Percentage', width: 35, format: 'percentage', align: 'center' },
            { key: 'topRegions', label: 'Top Regions', width: 55 }
        ];

        const tableData = (data.plateCodeStats || []).map(item => {
            let topRegions = 'N/A';
            if (item.regions && Array.isArray(item.regions) && item.regions.length > 0) {
                topRegions = item.regions.slice(0, 3).map(r => {
                    if (typeof r === 'string') return r;
                    return r.region || r;
                }).join(', ');
            }
            return {
                plateCode: item.plateCode,
                count: item.count,
                percentage: item.percentage,
                topRegions
            };
        });

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: tableData,
            filename,
            summary
        });
    }
};

// Export customer report to PDF
export const exportCustomerReportToPDF = async ({
    title,
    subtitle,
    data,
    filename,
    type = 'vehicle-history'
}) => {
    if (type === 'vehicle-history') {
        const summary = [
            { label: 'Total Visits', value: data.totalVisits },
            { label: 'Total Paid', value: formatCurrency(data.totalPaid) },
            { label: 'Average Payment', value: formatCurrency(data.averagePayment) }
        ];

        const columns = [
            { key: 'parkedAt', label: 'Parked At', width: 50, format: 'datetime' },
            { key: 'checkedOutAt', label: 'Checked Out At', width: 50, format: 'datetime' },
            { key: 'licensePlate', label: 'License Plate', width: 45 },
            { key: 'model', label: 'Model', width: 40 },
            { key: 'location', label: 'Location', width: 35 },
            { key: 'status', label: 'Status', width: 30 },
            { key: 'paymentMethod', label: 'Payment', width: 30 },
            { key: 'totalPaidAmount', label: 'Amount', width: 35, format: 'currency', align: 'right' },
            { key: 'duration', label: 'Duration', width: 35 }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: data.history || [],
            filename,
            summary
        });
    } else if (type === 'customer-activity') {
        const summary = [
            { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(data.endDate)}` },
            { label: 'Total Customers', value: data.totalCustomers }
        ];

        const columns = [
            { key: 'phoneNumber', label: 'Phone Number', width: 50 },
            { key: 'visitCount', label: 'Visits', width: 25, align: 'center' },
            { key: 'totalPaid', label: 'Total Paid', width: 40, format: 'currency', align: 'right' },
            { key: 'averagePayment', label: 'Avg Payment', width: 40, format: 'currency', align: 'right' },
            { key: 'preferredPaymentMethod', label: 'Preferred Method', width: 45 },
            { key: 'lastVisit', label: 'Last Visit', width: 40, format: 'date' }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: data.customers || [],
            filename,
            summary
        });
    }
};

// Export administrative report to PDF
export const exportAdministrativeReportToPDF = async ({
    title,
    subtitle,
    data,
    filename,
    type = 'users'
}) => {
    if (type === 'users') {
        const summary = [
            { label: 'Total Users', value: data.totalUsers }
        ];

        // Export each user type separately or combine
        const allUsers = (data.usersByType || []).flatMap(typeGroup => 
            typeGroup.users.map(user => ({
                name: user.name,
                phoneNumber: user.phoneNumber,
                type: typeGroup.type,
                parkZoneCode: user.parkZoneCode || 'N/A',
                carsParked: user.activity?.carsParked || 0,
                carsCheckedOut: user.activity?.carsCheckedOut || 0,
                hasProfilePhoto: user.hasProfilePhoto ? 'Yes' : 'No'
            }))
        );

        const columns = [
            { key: 'name', label: 'Name', width: 50 },
            { key: 'phoneNumber', label: 'Phone', width: 45 },
            { key: 'type', label: 'Type', width: 40 },
            { key: 'parkZoneCode', label: 'Zone Code', width: 35 },
            { key: 'carsParked', label: 'Cars Parked', width: 30, align: 'center' },
            { key: 'carsCheckedOut', label: 'Cars Checked Out', width: 40, align: 'center' },
            { key: 'hasProfilePhoto', label: 'Has Photo', width: 30, align: 'center' }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: allUsers,
            filename,
            summary
        });
    } else if (type === 'valet-performance') {
        const summary = [
            { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(data.endDate)}` }
        ];

        const columns = [
            { key: 'valetName', label: 'Valet Name', width: 50 },
            { key: 'phoneNumber', label: 'Phone', width: 45 },
            { key: 'parkZoneCode', label: 'Zone', width: 30 },
            { key: 'carsParked', label: 'Parked', width: 25, align: 'center' },
            { key: 'carsCheckedOut', label: 'Checked Out', width: 35, align: 'center' },
            { key: 'revenue', label: 'Revenue', width: 40, format: 'currency', align: 'right' },
            { key: 'averageRevenue', label: 'Avg Revenue', width: 40, format: 'currency', align: 'right' },
            { key: 'checkoutRate', label: 'Checkout Rate', width: 35, format: 'percentage', align: 'center' }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: data.performance || [],
            filename,
            summary
        });
    }
};

// Export compliance report to PDF
export const exportComplianceReportToPDF = async ({
    title,
    subtitle,
    data,
    filename,
    type = 'transactions'
}) => {
    if (type === 'transactions') {
        const summary = [
            { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(data.endDate)}` },
            { label: 'Payment Method', value: data.paymentMethod || 'All Methods' },
            { label: 'Total Transactions', value: data.totalTransactions }
        ];

        const columns = [
            { key: 'licensePlate', label: 'License Plate', width: 40 },
            { key: 'parkedAt', label: 'Parked At', width: 45, format: 'datetime' },
            { key: 'checkedOutAt', label: 'Checked Out At', width: 45, format: 'datetime' },
            { key: 'paymentMethod', label: 'Payment Method', width: 35 },
            { key: 'paymentReference', label: 'Reference', width: 40 },
            { key: 'amount', label: 'Amount', width: 35, format: 'currency', align: 'right' },
            { key: 'valetName', label: 'Valet', width: 40 },
            { key: 'location', label: 'Location', width: 30 }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: data.transactions || [],
            filename,
            summary
        });
    } else if (type === 'system-activity') {
        const summary = [
            { label: 'Period', value: `${formatDate(data.startDate)} to ${formatDate(data.endDate)}` },
            { label: 'Cars Registered', value: data.activitySummary?.carsRegistered || 0 },
            { label: 'Cars Checked Out', value: data.activitySummary?.carsCheckedOut || 0 },
            { label: 'Total Revenue', value: formatCurrency(data.activitySummary?.totalRevenue || 0) },
            { label: 'Violations', value: data.activitySummary?.violations || 0 }
        ];

        const columns = [
            { key: 'timestamp', label: 'Timestamp', width: 50, format: 'datetime' },
            { key: 'action', label: 'Action', width: 30 },
            { key: 'licensePlate', label: 'License Plate', width: 40 },
            { key: 'performedBy', label: 'Performed By', width: 40 },
            { key: 'amount', label: 'Amount', width: 30, format: 'currency', align: 'right' },
            { key: 'paymentMethod', label: 'Payment Method', width: 30 }
        ];

        await exportTableToPDF({
            title,
            subtitle,
            columns,
            data: data.activities || [],
            filename,
            summary
        });
    }
};

