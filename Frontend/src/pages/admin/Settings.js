import React, { useState } from 'react';
import '../../css/settings.scss';

const Settings = () => {
    const plateCodes = [
        '01', '02', '03', '04', '05', 'police', 'AO', 'ተላላፊ', 'የእለት', 'DF', 'AU', 'AU-CD', 'UN', 'UN-CD', 'CD',
    ];

    const [settings, setSettings] = useState(() => {
        const initialSettings = {};
        plateCodes.forEach(code => {
            initialSettings[code] = { pricePerHour: '' }; // Initialize each plate code with an object for its price per hour
        });
        return initialSettings;
    });

    const handleChange = (code, field, value) => {
        setSettings(prevSettings => ({
            ...prevSettings,
            [code]: {
                ...prevSettings[code],
                [field]: value,
            },
        }));
    };

    const handleSave = () => {
        // TODO: Implement save settings API call
        alert('Settings saved! (This will be implemented with backend API)');
    };

    return (
        <div className="settings-page">
            <h1>Settings</h1>
            
            <div className="settings-card">
                <h2>Pricing Configuration</h2>
                {plateCodes.map((code) => (
                    <div className="form-group" key={code}>
                        <label>Price Per Hour for {code}</label>
                        <input
                            type="number"
                            value={settings[code].pricePerHour}
                            onChange={(e) => handleChange(code, 'pricePerHour', e.target.value)}
                            placeholder="0.00"
                        />
                    </div>
                ))}
                <button className="btn-save" onClick={handleSave}>
                    Save Settings
                </button>
            </div>
        </div>
    );
};

export default Settings;

