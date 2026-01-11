import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { fetchPricingSettings, updatePricingSettings } from '../../api/api';
import { Plus, X } from 'lucide-react';
import '../../css/settings.scss';

const Settings = () => {
    const user = useSelector((state) => state.user);
    const [plateCodes, setPlateCodes] = useState([]);
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newPlateCode, setNewPlateCode] = useState({
        code: '',
        pricePerHour: ''
    });
    const [modalError, setModalError] = useState('');

    useEffect(() => {
        fetchPricingSettings({
            setPricingSettings: (data) => {
                // Default plate codes if database is empty
                const defaultCodes = ['01', '02', '03', '04', '05', 'police', 'AO', 'ተላላፊ', 'የእለት', 'DF', 'AU', 'AU-CD', 'UN', 'UN-CD', 'CD'];
                
                // Extract all plate codes from the data, or use defaults if empty
                const codes = Object.keys(data).length > 0 ? Object.keys(data) : defaultCodes;
                setPlateCodes(codes);
                
                // Convert API format to settings format
                const mergedSettings = {};
                codes.forEach(code => {
                    if (data[code] && data[code].pricePerHour !== undefined) {
                        mergedSettings[code] = { pricePerHour: data[code].pricePerHour.toString() };
                    } else {
                        mergedSettings[code] = { pricePerHour: '' };
                    }
                });
                setSettings(mergedSettings);
            }
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleChange = (code, field, value) => {
        setSettings(prevSettings => ({
            ...prevSettings,
            [code]: {
                ...prevSettings[code],
                [field]: value,
            },
        }));
        setError('');
        setSuccess('');
    };

    const handleSave = () => {
        setLoading(true);
        setError('');
        setSuccess('');

        // Convert settings to the format expected by API
        const settingsToSave = {};
        Object.keys(settings).forEach(code => {
            const priceValue = settings[code].pricePerHour;
            if (priceValue !== '' && priceValue !== null && priceValue !== undefined) {
                settingsToSave[code] = {
                    pricePerHour: parseFloat(priceValue) || 0
                };
            }
        });

        updatePricingSettings({
            settings: settingsToSave,
            token: user?.token,
            handleUpdateSuccess: (data) => {
                setSuccess('Settings saved successfully!');
                setLoading(false);
                setTimeout(() => setSuccess(''), 3000);
            },
            handleUpdateFailure: (errorMessage) => {
                setError(errorMessage);
                setLoading(false);
            }
        });
    };

    const handleAddPlateCode = () => {
        setModalError('');
        if (!newPlateCode.code || !newPlateCode.code.trim()) {
            setModalError('Plate code is required');
            return;
        }
        if (!newPlateCode.pricePerHour || newPlateCode.pricePerHour === '') {
            setModalError('Price per hour is required');
            return;
        }
        const code = newPlateCode.code.trim();
        if (plateCodes.includes(code)) {
            setModalError('Plate code already exists');
            return;
        }

        // Add new plate code to the list and settings
        setPlateCodes([...plateCodes, code]);
        setSettings({
            ...settings,
            [code]: { pricePerHour: newPlateCode.pricePerHour }
        });
        setNewPlateCode({ code: '', pricePerHour: '' });
        setShowAddModal(false);
        setModalError('');
    };

    return (
        <div className="settings-page">
            <h1>Settings</h1>
            
            <div className="settings-card">
                <div className="card-header-row">
                    <h2>Pricing Configuration</h2>
                    <button 
                        className="btn-add-plate-code"
                        onClick={() => setShowAddModal(true)}
                    >
                        <Plus size={18} />
                        Add Plate Code
                    </button>
                </div>
                
                {success && <div className="alert alert-success">{success}</div>}
                {error && <div className="alert alert-danger">{error}</div>}
                
                {plateCodes.map((code) => (
                    <div className="form-group" key={code}>
                        <label>Price Per Hour for {code}</label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={settings[code].pricePerHour}
                            onChange={(e) => handleChange(code, 'pricePerHour', e.target.value)}
                            placeholder="0.00"
                            disabled={loading}
                        />
                    </div>
                ))}
                <button 
                    className="btn-save" 
                    onClick={handleSave}
                    disabled={loading}
                >
                    {loading ? 'Saving...' : 'Save Settings'}
                </button>
            </div>

            {/* Add Plate Code Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add New Plate Code</h2>
                            <button 
                                className="modal-close"
                                onClick={() => {
                                    setShowAddModal(false);
                                    setNewPlateCode({ code: '', pricePerHour: '' });
                                    setModalError('');
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {modalError && <div className="alert alert-danger">{modalError}</div>}
                            <div className="form-group">
                                <label>Plate Code</label>
                                <input
                                    type="text"
                                    value={newPlateCode.code}
                                    onChange={(e) => {
                                        setNewPlateCode({ ...newPlateCode, code: e.target.value });
                                        setModalError('');
                                    }}
                                    placeholder="Enter plate code (e.g., 01, AO, etc.)"
                                />
                            </div>
                            <div className="form-group">
                                <label>Price Per Hour (ETB)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={newPlateCode.pricePerHour}
                                    onChange={(e) => {
                                        setNewPlateCode({ ...newPlateCode, pricePerHour: e.target.value });
                                        setModalError('');
                                    }}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="btn-cancel"
                                onClick={() => {
                                    setShowAddModal(false);
                                    setNewPlateCode({ code: '', pricePerHour: '' });
                                    setModalError('');
                                }}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn-submit"
                                onClick={handleAddPlateCode}
                            >
                                Add Plate Code
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;

