import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { fetchPricingSettings, updatePricingSettings } from '../../api/api';
import { Plus, X, Edit2, Trash2, Check, X as XIcon } from 'lucide-react';
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
    const [editingCode, setEditingCode] = useState(null);
    const [editPrice, setEditPrice] = useState('');

    useEffect(() => {
        fetchPricingSettings({
            setPricingSettings: (data) => {
                // Default plate codes if database is empty
                const defaultCodes = ['01', '02', '03', '04', '05', 'police', 'AO', 'ተላላፊ', 'የእለት', 'DF', 'AU', 'AU-CD', 'UN', 'UN-CD', 'CD'];
                
                // Extract all plate codes from the data, or use defaults if empty
                const codes = (data && typeof data === 'object' && Object.keys(data).length > 0) ? Object.keys(data) : defaultCodes;
                setPlateCodes(codes);
                
                // Convert API format to settings format
                const mergedSettings = {};
                codes.forEach(code => {
                    if (data && data[code] && data[code].pricePerHour !== undefined) {
                        mergedSettings[code] = { pricePerHour: data[code].pricePerHour.toString() };
                    } else {
                        mergedSettings[code] = { pricePerHour: '' };
                    }
                });
                setSettings(mergedSettings);
            }
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Save settings to database
    const saveSettings = (updatedSettings) => {
        setLoading(true);
        setError('');
        setSuccess('');

        // Convert settings to the format expected by API
        const settingsToSave = {};
        Object.keys(updatedSettings).forEach(code => {
            const priceValue = updatedSettings[code].pricePerHour;
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

    // Handle edit button click
    const handleEdit = (code) => {
        setEditingCode(code);
        setEditPrice(settings[code]?.pricePerHour || '');
    };

    // Handle save edit
    const handleSaveEdit = () => {
        if (!editingCode) return;
        
        const updatedSettings = {
            ...settings,
            [editingCode]: {
                pricePerHour: editPrice
            }
        };
        
        setSettings(updatedSettings);
        setEditingCode(null);
        setEditPrice('');
        saveSettings(updatedSettings);
    };

    // Handle cancel edit
    const handleCancelEdit = () => {
        setEditingCode(null);
        setEditPrice('');
    };

    // Handle delete plate code
    const handleDelete = (code) => {
        if (window.confirm(`Are you sure you want to delete plate code "${code}"?`)) {
            const updatedPlateCodes = plateCodes.filter(c => c !== code);
            const updatedSettings = { ...settings };
            delete updatedSettings[code];
            
            setPlateCodes(updatedPlateCodes);
            setSettings(updatedSettings);
            saveSettings(updatedSettings);
        }
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
        const updatedPlateCodes = [...plateCodes, code];
        const updatedSettings = {
            ...settings,
            [code]: { pricePerHour: newPlateCode.pricePerHour }
        };
        
        setPlateCodes(updatedPlateCodes);
        setSettings(updatedSettings);
        setNewPlateCode({ code: '', pricePerHour: '' });
        setShowAddModal(false);
        setModalError('');
        
        // Save immediately after adding
        saveSettings(updatedSettings);
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
                        disabled={loading}
                    >
                        <Plus size={18} />
                        Add Plate Code
                    </button>
                </div>
                
                {success && <div className="alert alert-success">{success}</div>}
                {error && <div className="alert alert-danger">{error}</div>}
                
                <div className="table-container">
                    <table className="settings-table">
                        <thead>
                            <tr>
                                <th>Plate Code</th>
                                <th>Price Per Hour (ETB)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {plateCodes.length === 0 ? (
                                <tr>
                                    <td colSpan="3" className="empty-state">
                                        No plate codes configured. Click "Add Plate Code" to get started.
                                    </td>
                                </tr>
                            ) : (
                                plateCodes.map((code) => (
                                    <tr key={code}>
                                        <td className="plate-code-cell">{code}</td>
                                        <td className="price-cell">
                                            {editingCode === code ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={editPrice}
                                                    onChange={(e) => setEditPrice(e.target.value)}
                                                    placeholder="0.00"
                                                    className="edit-input"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span>{settings[code]?.pricePerHour || '0.00'}</span>
                                            )}
                                        </td>
                                        <td className="actions-cell">
                                            {editingCode === code ? (
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-icon btn-save-edit"
                                                        onClick={handleSaveEdit}
                                                        title="Save"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-cancel-edit"
                                                        onClick={handleCancelEdit}
                                                        title="Cancel"
                                                    >
                                                        <XIcon size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-icon btn-edit"
                                                        onClick={() => handleEdit(code)}
                                                        title="Edit"
                                                        disabled={loading}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-icon btn-delete"
                                                        onClick={() => handleDelete(code)}
                                                        title="Delete"
                                                        disabled={loading}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
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

