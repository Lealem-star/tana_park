import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createParkedCar, sendSmsNotification } from '../../api/api';
import '../../css/registerCar.scss';

const plateCodes = [
    '01', '02', '03', '04', '05', 'police', 'AO', 'ተላላፊ', 'የእለት', 'DF', 'AU', 'AU-CD', 'UN', 'UN-CD', 'CD',
];

const regions = [
    'ET', 'AA', 'AF', 'AM', 'BG', 'DR', 'GM', 'HR', 'OR', 'SM', 'TG', 'SD', 'DE', 'ME', 'DM',
];

const RegisterCar = () => {
    const user = useSelector((state) => state.user);
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        plateCode: '',
        region: '', // New field for region
        licensePlateNumber: '', // New field for license plate number
        model: '',
        color: '',
        phoneNumber: '',
        notes: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (field, value) => {
        setFormData({ ...formData, [field]: value });
        setError('');
        setSuccess('');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        if (!formData.plateCode || !formData.region || !formData.licensePlateNumber || !formData.model || !formData.color || !formData.phoneNumber) {
            setError('Please fill in all required fields');
            setLoading(false);
            return;
        }

        createParkedCar({
            body: {
                plateCode: formData.plateCode,
                region: formData.region,
                licensePlateNumber: formData.licensePlateNumber,
                model: formData.model,
                color: formData.color,
                phoneNumber: formData.phoneNumber,
                notes: formData.notes
            },
            token: user?.token,
            handleCreateParkedCarSuccess,
            handleCreateParkedCarFailure
        });
    };

    const handleCreateParkedCarSuccess = async (carData) => {
        setSuccess('Car registered successfully!');

        // Construct SMS message
        const now = new Date();
        const parkingTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const parkingDate = now.toLocaleDateString();

        const smsMessage = `Dear customer,\nyour car (Plate Code: ${formData.plateCode}, License Plate Number: ${formData.licensePlateNumber}, Model: ${formData.model}) is now parked at Tana parking.\nParking started at ${parkingTime} on ${parkingDate}.\nThank you!`;

        // Send SMS notification
        try {
            await sendSmsNotification({
                phoneNumber: formData.phoneNumber,
                message: smsMessage,
                token: user?.token,
                handleSendSmsSuccess: () => console.log('SMS sent successfully'),
                handleSendSmsFailure: (smsError) => console.error('Failed to send SMS:', smsError)
            });
        } catch (smsError) {
            console.error('Error sending SMS notification:', smsError);
        }

        setFormData({
            plateCode: '',
            region: '',
            licensePlateNumber: '',
            model: '',
            color: '',
            phoneNumber: '',
            notes: ''
        });
        setLoading(false);
        setTimeout(() => {
            navigate('/valet/cars');
        }, 1500);
    };

    const handleCreateParkedCarFailure = (error) => {
        setError(error || 'Failed to register car');
        setLoading(false);
    };

    return (
        <div className="register-car">
            <div className="page-header">
                <h1>Register Parked Car</h1>
                <p>Record a new parked vehicle</p>
            </div>

            <div className="form-container">
                {success && <div className="alert alert-success">{success}</div>}
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Plate Code *</label>
                            <select
                                value={formData.plateCode}
                                onChange={(e) => handleChange('plateCode', e.target.value)}
                                required
                            >
                                <option value="" disabled>Select Plate Code</option>
                                {plateCodes.map((code) => (
                                    <option key={code} value={code}>
                                        {code}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Region *</label>
                            <select
                                value={formData.region}
                                onChange={(e) => handleChange('region', e.target.value)}
                                required
                            >
                                <option value="" disabled>Select Region</option>
                                {regions.map((regionCode) => (
                                    <option key={regionCode} value={regionCode}>
                                        {regionCode}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label>License Plate Number *</label>
                            <input
                                type="text"
                                value={formData.licensePlateNumber}
                                onChange={(e) => handleChange('licensePlateNumber', e.target.value.toUpperCase())}
                                placeholder="A12345"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Phone Number *</label>
                            <input
                                type="text"
                                value={formData.phoneNumber}
                                onChange={(e) => handleChange('phoneNumber', e.target.value)}
                                placeholder="e.g., 2519XXXXXXXX or 09XXXXXXXX"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Model *</label>
                            <input
                                type="text"
                                value={formData.model}
                                onChange={(e) => handleChange('model', e.target.value)}
                                placeholder="Camry, Civic, etc."
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Color *</label>
                            <input
                                type="text"
                                value={formData.color}
                                onChange={(e) => handleChange('color', e.target.value)}
                                placeholder="Red, Blue, Black, etc."
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Notes (Optional)</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            placeholder="Additional notes about the vehicle..."
                            rows="3"
                        />
                    </div>

                    <div className="form-actions">
                        <button 
                            type="button" 
                            className="btn-cancel"
                            onClick={() => navigate('/valet/dashboard')}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn-submit"
                            disabled={loading}
                        >
                            {loading ? 'Registering...' : 'Register Car'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RegisterCar;

