import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { 
    fetchUsersReport
} from '../../../api/api';
import { Users, Download } from 'lucide-react';
import { exportAdministrativeReportToPDF } from '../../../utils/pdfExportReact';
import '../../../css/reports.scss';

const AdministrativeReports = () => {
    const user = useSelector((state) => state.user);
    const [activeReport, setActiveReport] = useState('users');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [usersData, setUsersData] = useState(null);

    const loadUsersReport = useCallback(() => {
        setLoading(true);
        setError('');
        fetchUsersReport({
            token: user?.token,
            setData: (data) => {
                setUsersData(data);
                setLoading(false);
            },
            handleError: (err) => {
                setError(err);
                setLoading(false);
            }
        });
    }, [user?.token]);

    useEffect(() => {
        if (activeReport === 'users') {
            loadUsersReport();
        }
    }, [activeReport, loadUsersReport]);

    const handleExportPDF = async (type) => {
        try {
            if (type === 'users' && usersData) {
                const data = usersData;
                const title = 'User Management Report';
                const subtitle = 'Complete user listing and activity';
                const filename = `user-management-${new Date().toISOString().split('T')[0]}.pdf`;
                await exportAdministrativeReportToPDF({ title, subtitle, data, filename, type: 'users' });
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
            setError('Failed to export PDF. Please try again.');
        }
    };

    return (
        <div className="administrative-reports">
            {error && <div className="alert alert-danger">{error}</div>}

            {activeReport === 'users' && (
                <div className="report-section">
                        <div className="report-controls">
                        <button 
                            className="btn-user-management"
                            onClick={() => setActiveReport('users')}
                        >
                            <Users size={16} />
                            User Management
                        </button>
                            <button onClick={loadUsersReport} className="btn-refresh" disabled={loading}>
                                {loading ? 'Loading...' : 'Refresh'}
                            </button>
                            {usersData && (
                                <button onClick={() => handleExportPDF('users')} className="btn-export">
                                    <Download size={16} />
                                    Export PDF
                                </button>
                            )}
                    </div>

                    {loading ? (
                        <div className="loading">Loading user data...</div>
                    ) : usersData ? (
                        <div className="report-content">
                            <div className="summary-section">
                                <div className="summary-card">
                                    <h3>{usersData.totalUsers}</h3>
                                    <p>Total officers</p>
                                </div>
                            </div>

                            {usersData.usersByType && usersData.usersByType.length > 0 && (() => {
                                // Group users into valet and administrative
                                const valetUsers = [];
                                const administrativeUsers = [];

                                usersData.usersByType.forEach(typeGroup => {
                                    if (typeGroup.type === 'valet') {
                                        valetUsers.push(...typeGroup.users);
                                    } else if (typeGroup.type === 'system_admin' || typeGroup.type === 'manager') {
                                        administrativeUsers.push(...typeGroup.users.map(user => ({
                                            ...user,
                                            role: typeGroup.type === 'system_admin' ? 'System Admin' : 
                                                  typeGroup.type === 'manager' ? 'Manager' : typeGroup.type
                                        })));
                                    }
                                });

                                return (
                                <div className="report-table-section">
                                        {/* Valet Users Section */}
                                        {valetUsers.length > 0 && (
                                            <div className="user-type-section">
                                                <h3>Valet ({valetUsers.length})</h3>
                                            <table className="report-table">
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>Phone Number</th>
                                                        <th>Park Zone Code</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                        {valetUsers.map((user, uIdx) => (
                                                        <tr key={uIdx}>
                                                            <td>{user.name}</td>
                                                            <td>{user.phoneNumber}</td>
                                                            <td>{user.parkZoneCode || 'N/A'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                </div>
            )}

                                        {/* Administrative Users Section */}
                                        {administrativeUsers.length > 0 && (
                                            <div className="user-type-section">
                                                <h3>Administrative ({administrativeUsers.length})</h3>
                                    <table className="report-table">
                                        <thead>
                                            <tr>
                                                            <th>Name</th>
                                                <th>Phone Number</th>
                                                            <th>Role</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                                        {administrativeUsers.map((user, uIdx) => (
                                                            <tr key={uIdx}>
                                                                <td>{user.name}</td>
                                                                <td>{user.phoneNumber}</td>
                                                                <td>{user.role}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="no-data">Click Refresh to load user data.</div>
                    )}
                </div>
            )}

        </div>
    );
};

export default AdministrativeReports;

