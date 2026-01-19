import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { fetchPricingSettings, updatePricingSettings } from '../../api/api';
import { Edit2, Check, X as XIcon, Plus, Trash2 } from 'lucide-react';
import '../../css/settings.scss';

const carTypes = ['tripod', 'automobile', 'truck', 'trailer'];

const Settings = () => {
    const user = useSelector((state) => state.user);
    const [priceLevels, setPriceLevels] = useState({});
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [editingPriceLevel, setEditingPriceLevel] = useState(null);
    const [editingCarType, setEditingCarType] = useState(null);
    const [editPrices, setEditPrices] = useState({
        hourly: '',
        weekly: '',
        monthly: '',
        yearly: ''
    });
    const [showAddModal, setShowAddModal] = useState(false);
    const [newPriceLevelName, setNewPriceLevelName] = useState('');
    const [newPriceLevelPricing, setNewPriceLevelPricing] = useState({
        tripod: { hourly: '', weekly: '', monthly: '', yearly: '' },
        automobile: { hourly: '', weekly: '', monthly: '', yearly: '' },
        truck: { hourly: '', weekly: '', monthly: '', yearly: '' },
        trailer: { hourly: '', weekly: '', monthly: '', yearly: '' }
    });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [priceLevelToDelete, setPriceLevelToDelete] = useState(null);

    useEffect(() => {
        fetchPricingSettings({
            setPricingSettings: (data) => {
                // Support price levels structure: {priceLevels: {[name]: {carType: {...}}}}
                if (data && data.priceLevels) {
                    setPriceLevels(data.priceLevels);
                } else {
                    // Backward compatibility or empty state
                    setPriceLevels({});
                }
            }
        });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Save price levels to database
    const savePriceLevels = (updatedPriceLevels) => {
        setLoading(true);
        setError('');
        setSuccess('');

        // Convert to API format: {priceLevels: {[name]: {carType: {...}}}}
        const settingsToSave = { priceLevels: {} };
        Object.keys(updatedPriceLevels).forEach(priceLevelName => {
            const priceLevel = updatedPriceLevels[priceLevelName];
            settingsToSave.priceLevels[priceLevelName] = {};
            carTypes.forEach(carType => {
                const carPricing = priceLevel[carType] || {};
                settingsToSave.priceLevels[priceLevelName][carType] = {
                    hourly: carPricing.hourly ? parseFloat(carPricing.hourly) || 0 : 0,
                    weekly: carPricing.weekly ? parseFloat(carPricing.weekly) || 0 : 0,
                    monthly: carPricing.monthly ? parseFloat(carPricing.monthly) || 0 : 0,
                    yearly: carPricing.yearly ? parseFloat(carPricing.yearly) || 0 : 0
                };
            });
        });

        updatePricingSettings({
            settings: settingsToSave,
            token: user?.token,
            handleUpdateSuccess: (data) => {
                setSuccess('Price level saved successfully!');
                setLoading(false);
                setTimeout(() => setSuccess(''), 3000);
            },
            handleUpdateFailure: (errorMessage) => {
                setError(errorMessage);
                setLoading(false);
            }
        });
    };

    // Handle edit price level car type pricing
    const handleEditCarTypePricing = (priceLevelName, carType) => {
        setEditingPriceLevel(priceLevelName);
        setEditingCarType(carType);
        const priceLevel = priceLevels[priceLevelName] || {};
        const carPricing = priceLevel[carType] || {};
        setEditPrices({
            hourly: carPricing.hourly?.toString() || '',
            weekly: carPricing.weekly?.toString() || '',
            monthly: carPricing.monthly?.toString() || '',
            yearly: carPricing.yearly?.toString() || ''
        });
    };

    // Handle save edit
    const handleSaveEdit = () => {
        if (!editingPriceLevel || !editingCarType) return;
        
        const updatedPriceLevels = {
            ...priceLevels,
            [editingPriceLevel]: {
                ...priceLevels[editingPriceLevel],
                [editingCarType]: {
                    hourly: editPrices.hourly,
                    weekly: editPrices.weekly,
                    monthly: editPrices.monthly,
                    yearly: editPrices.yearly
                }
            }
        };
        
        setPriceLevels(updatedPriceLevels);
        setEditingPriceLevel(null);
        setEditingCarType(null);
        setEditPrices({ hourly: '', weekly: '', monthly: '', yearly: '' });
        savePriceLevels(updatedPriceLevels);
    };

    // Handle cancel edit
    const handleCancelEdit = () => {
        setEditingPriceLevel(null);
        setEditingCarType(null);
        setEditPrices({ hourly: '', weekly: '', monthly: '', yearly: '' });
    };

    // Handle add price level
    const handleAddPriceLevel = () => {
        if (!newPriceLevelName || !newPriceLevelName.trim()) {
            setError('Price level name is required');
            return;
        }
        if (priceLevels[newPriceLevelName.trim()]) {
            setError('Price level name already exists');
            return;
        }

        const updatedPriceLevels = {
            ...priceLevels,
            [newPriceLevelName.trim()]: newPriceLevelPricing
        };
        
        setPriceLevels(updatedPriceLevels);
        setNewPriceLevelName('');
        setNewPriceLevelPricing({
            tripod: { hourly: '', weekly: '', monthly: '', yearly: '' },
            automobile: { hourly: '', weekly: '', monthly: '', yearly: '' },
            truck: { hourly: '', weekly: '', monthly: '', yearly: '' },
            trailer: { hourly: '', weekly: '', monthly: '', yearly: '' }
        });
        setShowAddModal(false);
        setError('');
        savePriceLevels(updatedPriceLevels);
    };

    // Handle delete price level
    const handleDelete = (priceLevelName) => {
        setPriceLevelToDelete(priceLevelName);
        setShowDeleteModal(true);
    };

    // Confirm delete
    const confirmDelete = () => {
        if (!priceLevelToDelete) return;
        const updatedPriceLevels = { ...priceLevels };
        delete updatedPriceLevels[priceLevelToDelete];
        setPriceLevels(updatedPriceLevels);
        setShowDeleteModal(false);
        setPriceLevelToDelete(null);
        savePriceLevels(updatedPriceLevels);
    };

    // Cancel delete
    const cancelDelete = () => {
        setShowDeleteModal(false);
        setPriceLevelToDelete(null);
    };

    return (
        <div className="settings-page">
            {/* <h1>Settings</h1> */}
            
            <div className="settings-card">
                <div className="card-header-row">
                    <h2>Car Type Pricing Configuration</h2>
                    <button 
                        className="btn-add-plate-code"
                        onClick={() => setShowAddModal(true)}
                        disabled={loading}
                    >
                        <Plus size={18} />
                        Add Price Level
                    </button>
                </div>
                
                {success && <div className="alert alert-success">{success}</div>}
                {error && <div className="alert alert-danger">{error}</div>}
                
                {Object.keys(priceLevels).length === 0 ? (
                    <div className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
                        <p>No price levels configured. Click "Add Price Level" to get started.</p>
                    </div>
                ) : (
                    Object.keys(priceLevels).map((priceLevelName) => {
                        const priceLevel = priceLevels[priceLevelName] || {};
                        return (
                            <div key={priceLevelName} style={{ marginBottom: '2rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ margin: 0, color: '#000' }}>{priceLevelName}</h3>
                                    <button
                                        className="btn-icon btn-delete"
                                        onClick={() => handleDelete(priceLevelName)}
                                        title="Delete Price Level"
                                        disabled={loading}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                                <div className="table-container">
                                    <table className="settings-table">
                                        <thead>
                                            <tr>
                                                <th>Car Type</th>
                                                <th>Hourly Rate (ETB)</th>
                                                <th>Weekly Package (ETB)</th>
                                                <th>Monthly Package (ETB)</th>
                                                <th>Yearly Package (ETB)</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {carTypes.map((carType) => {
                                                const carPricing = priceLevel[carType] || {};
                                                const isEditing = editingPriceLevel === priceLevelName && editingCarType === carType;
                                                return (
                                                    <tr key={carType}>
                                                        <td className="car-type-cell" style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>
                                                            {carType}
                                                        </td>
                                                        <td className="price-cell">
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={editPrices.hourly}
                                                                    onChange={(e) => setEditPrices({ ...editPrices, hourly: e.target.value })}
                                                                    placeholder="0.00"
                                                                    className="edit-input"
                                                                />
                                                            ) : (
                                                                <span>{carPricing.hourly || '0.00'}</span>
                                                            )}
                                                        </td>
                                                        <td className="price-cell">
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={editPrices.weekly}
                                                                    onChange={(e) => setEditPrices({ ...editPrices, weekly: e.target.value })}
                                                                    placeholder="0.00"
                                                                    className="edit-input"
                                                                />
                                                            ) : (
                                                                <span>{carPricing.weekly || '0.00'}</span>
                                                            )}
                                                        </td>
                                                        <td className="price-cell">
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={editPrices.monthly}
                                                                    onChange={(e) => setEditPrices({ ...editPrices, monthly: e.target.value })}
                                                                    placeholder="0.00"
                                                                    className="edit-input"
                                                                />
                                                            ) : (
                                                                <span>{carPricing.monthly || '0.00'}</span>
                                                            )}
                                                        </td>
                                                        <td className="price-cell">
                                                            {isEditing ? (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    value={editPrices.yearly}
                                                                    onChange={(e) => setEditPrices({ ...editPrices, yearly: e.target.value })}
                                                                    placeholder="0.00"
                                                                    className="edit-input"
                                                                />
                                                            ) : (
                                                                <span>{carPricing.yearly || '0.00'}</span>
                                                            )}
                                                        </td>
                                                        <td className="actions-cell">
                                                            {isEditing ? (
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
                                                                        onClick={() => handleEditCarTypePricing(priceLevelName, carType)}
                                                                        title="Edit"
                                                                        disabled={loading}
                                                                    >
                                                                        <Edit2 size={16} />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Add Price Level Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
                        <div className="modal-header">
                            <h2>Add New Price Level</h2>
                            <button 
                                className="modal-close"
                                onClick={() => {
                                    setShowAddModal(false);
                                    setNewPriceLevelName('');
                                    setNewPriceLevelPricing({
                                        tripod: { hourly: '', weekly: '', monthly: '', yearly: '' },
                                        automobile: { hourly: '', weekly: '', monthly: '', yearly: '' },
                                        truck: { hourly: '', weekly: '', monthly: '', yearly: '' },
                                        trailer: { hourly: '', weekly: '', monthly: '', yearly: '' }
                                    });
                                    setError('');
                                }}
                            >
                                <XIcon size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {error && <div className="alert alert-danger">{error}</div>}
                            <div className="form-group">
                                <label>Price Level Name</label>
                                <input
                                    type="text"
                                    value={newPriceLevelName}
                                    onChange={(e) => {
                                        setNewPriceLevelName(e.target.value);
                                        setError('');
                                    }}
                                    placeholder="e.g., Premium Zone, Standard Zone"
                                />
                            </div>
                            <div style={{ marginTop: '1.5rem' }}>
                                <h4 style={{ marginBottom: '1rem', color: '#333', fontWeight: '600' }}>Pricing for Each Car Type:</h4>
                                {carTypes.map((carType) => (
                                    <div key={carType} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
                                        <h5 style={{ marginBottom: '0.5rem', textTransform: 'capitalize', color: '#333', fontWeight: '600' }}>{carType}</h5>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                                            <div className="form-group">
                                                <label style={{ color: '#333', display: 'block', marginBottom: '8px', fontWeight: '500' }}>Hourly (ETB)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={newPriceLevelPricing[carType].hourly}
                                                    onChange={(e) => setNewPriceLevelPricing({
                                                        ...newPriceLevelPricing,
                                                        [carType]: { ...newPriceLevelPricing[carType], hourly: e.target.value }
                                                    })}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ color: '#333', display: 'block', marginBottom: '8px', fontWeight: '500' }}>Weekly (ETB)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={newPriceLevelPricing[carType].weekly}
                                                    onChange={(e) => setNewPriceLevelPricing({
                                                        ...newPriceLevelPricing,
                                                        [carType]: { ...newPriceLevelPricing[carType], weekly: e.target.value }
                                                    })}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ color: '#333', display: 'block', marginBottom: '8px', fontWeight: '500' }}>Monthly (ETB)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={newPriceLevelPricing[carType].monthly}
                                                    onChange={(e) => setNewPriceLevelPricing({
                                                        ...newPriceLevelPricing,
                                                        [carType]: { ...newPriceLevelPricing[carType], monthly: e.target.value }
                                                    })}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label style={{ color: '#333', display: 'block', marginBottom: '8px', fontWeight: '500' }}>Yearly (ETB)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={newPriceLevelPricing[carType].yearly}
                                                    onChange={(e) => setNewPriceLevelPricing({
                                                        ...newPriceLevelPricing,
                                                        [carType]: { ...newPriceLevelPricing[carType], yearly: e.target.value }
                                                    })}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="btn-cancel"
                                onClick={() => {
                                    setShowAddModal(false);
                                    setNewPriceLevelName('');
                                    setNewPriceLevelPricing({
                                        tripod: { hourly: '', weekly: '', monthly: '', yearly: '' },
                                        automobile: { hourly: '', weekly: '', monthly: '', yearly: '' },
                                        truck: { hourly: '', weekly: '', monthly: '', yearly: '' },
                                        trailer: { hourly: '', weekly: '', monthly: '', yearly: '' }
                                    });
                                    setError('');
                                }}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn-submit"
                                onClick={handleAddPriceLevel}
                            >
                                Add Price Level
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="modal-overlay" onClick={cancelDelete}>
                    <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Delete Price Level</h2>
                            <button 
                                className="modal-close"
                                onClick={cancelDelete}
                            >
                                <XIcon size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>
                                Are you sure you want to delete price level <strong>"{priceLevelToDelete}"</strong>?
                            </p>
                            <p className="warning-text">This action cannot be undone.</p>
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="btn-cancel"
                                onClick={cancelDelete}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn-delete-confirm"
                                onClick={confirmDelete}
                                disabled={loading}
                            >
                                {loading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Settings;

