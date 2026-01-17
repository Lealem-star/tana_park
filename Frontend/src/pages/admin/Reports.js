import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { FileText, DollarSign, Users } from 'lucide-react';
import FinancialReports from './reports/FinancialReports';
import CustomerReports from './reports/CustomerReports';
import AdministrativeReports from './reports/AdministrativeReports';
import '../../css/reports.scss';

const Reports = () => {
    const user = useSelector((state) => state.user);
    const [activeTab, setActiveTab] = useState('financial');

    const tabs = [
        { id: 'financial', label: 'Financial Reports', icon: DollarSign, component: FinancialReports },
        { id: 'customer', label: 'Customer Reports', icon: Users, component: CustomerReports },
        { id: 'administrative', label: 'Administrative Reports', icon: FileText, component: AdministrativeReports },
    ];

    const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || FinancialReports;

    if (!user || !['system_admin', 'manager', 'admin'].includes(user.type)) {
        return (
            <div className="reports-container">
                <div className="access-denied">
                    <h2>Access Denied</h2>
                    <p>You don't have permission to view reports.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="reports-container">

            <div className="reports-tabs">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <Icon size={20} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="reports-content">
                <ActiveComponent />
            </div>
        </div>
    );
};

export default Reports;

