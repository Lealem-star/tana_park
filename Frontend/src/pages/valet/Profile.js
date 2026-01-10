import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setUser } from '../../reducers/userReducer';
import { resetPassword, updateUser, uploadProfilePhoto } from '../../api/api';
import { X, User, Camera } from 'lucide-react';
import '../../css/valetDashboard.scss';

const Profile = () => {
    const [showProfileModal, setShowProfileModal] = useState(true); // Always show when routed to /valet/profile
    const [profileForm, setProfileForm] = useState({
        name: '',
        phoneNumber: '',
        password: '',
        confirmPassword: '',
        profilePhoto: null,
        profilePhotoPreview: null
    });
    const [isUpdated, setIsUpdated] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const user = useSelector((state) => state.user);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        const BASE_URL = process.env.REACT_APP_BASE_URL || "http://localhost:4000/";
        const photoUrl = user?.profilePhoto 
            ? (user.profilePhoto.startsWith('http') 
                ? user.profilePhoto 
                : `${BASE_URL}${user.profilePhoto.startsWith('/') ? user.profilePhoto.substring(1) : user.profilePhoto}`)
            : null;

        setProfileForm({
            name: user?.name || '',
            phoneNumber: user?.phoneNumber || '',
            password: '',
            confirmPassword: '',
            profilePhoto: null,
            profilePhotoPreview: photoUrl
        });
    }, [user, navigate]);

    const handleCloseProfileModal = () => {
        navigate('/valet/dashboard'); // Navigate back to valet dashboard
        setShowProfileModal(false);
        setError('');
        setIsUpdated(false);
    };

    const handleProfileFormChange = (field, value) => {
        setProfileForm({ ...profileForm, [field]: value });
        setError('');
        setIsUpdated(false);
    };

    const handleProfilePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfileForm({
                    ...profileForm,
                    profilePhoto: file,
                    profilePhotoPreview: reader.result
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUpdateProfile = () => {
        setError('');
        setIsUpdated(false);
        setLoading(true);

        if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
            setError('New password and confirm password must match');
            setLoading(false);
            return;
        }

        const needsNameUpdate = profileForm.name !== user?.name;
        const needsPhoneNumberUpdate = profileForm.phoneNumber !== user?.phoneNumber;
        const needsPasswordUpdate = profileForm.password && profileForm.password.length > 0;
        const needsPhotoUpdate = profileForm.profilePhoto !== null;

        if (!needsNameUpdate && !needsPhoneNumberUpdate && !needsPasswordUpdate && !needsPhotoUpdate) {
            setError('No changes to save');
            setLoading(false);
            return;
        }

        // Handle updates sequentially
        let updatedUser = { ...user };
        let updateChain = Promise.resolve();

        // 1. Upload profile photo first if needed
        if (needsPhotoUpdate) {
            updateChain = updateChain.then(() => {
                return new Promise((resolve, reject) => {
                    uploadProfilePhoto({
                        user_id: user?._id,
                        file: profileForm.profilePhoto,
                        handleUploadSuccess: (data) => {
                            updatedUser = { ...updatedUser, ...data?.user };
                            dispatch(setUser(updatedUser));
                            resolve();
                        },
                        handleUploadFailure: (error) => {
                            reject(error);
                        }
                    });
                });
            });
        }

        // 2. Update name and phone number if changed
        if (needsNameUpdate || needsPhoneNumberUpdate) {
            updateChain = updateChain.then(() => {
                return new Promise((resolve, reject) => {
                    updateUser({
                        user_id: user?._id,
                        body: { 
                            name: profileForm.name,
                            phoneNumber: profileForm.phoneNumber
                        },
                        handleUpdateUserSuccess: (data) => {
                            updatedUser = { ...updatedUser, ...data?.user };
                            dispatch(setUser(updatedUser));
                            resolve();
                        },
                        handleUpdateUserFailure: (error) => {
                            reject(error);
                        }
                    });
                });
            });
        }

        // 3. Update password if changed
        if (needsPasswordUpdate) {
            updateChain = updateChain.then(() => {
                return new Promise((resolve, reject) => {
                    resetPassword({
                        user_id: user?._id,
                        body: { password: profileForm.password },
                        handleResetPasswordSuccess: () => {
                            resolve();
                        },
                        handleResetPasswordFailure: (error) => {
                            reject(error);
                        }
                    });
                });
            });
        }

        // Execute all updates
        updateChain
            .then(() => {
                setIsUpdated(true);
                setLoading(false);
                setTimeout(() => {
                    handleCloseProfileModal();
                }, 2000);
            })
            .catch((error) => {
                setError(error || 'Failed to update profile');
                setLoading(false);
            });
    };

    if (!showProfileModal) {
        return null;
    }

    return (
        <div className="valet-dashboard">
            <div className="profile-modal-overlay" onClick={handleCloseProfileModal}>
                <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="profile-modal-header">
                        <h2>Update Profile</h2>
                        <button className="modal-close-btn" onClick={handleCloseProfileModal}>
                            <X size={24} />
                        </button>
                    </div>

                <div className="profile-modal-body">
                    {isUpdated && (
                        <div className="alert alert-success">
                            Profile updated successfully!
                        </div>
                    )}
                    {error && (
                        <div className="alert alert-danger">
                            {error}
                        </div>
                    )}

                    {/* Profile Photo Upload */}
                    <div className="profile-photo-section">
                        <div className="profile-photo-preview">
                            {profileForm.profilePhotoPreview ? (
                                <img 
                                    src={profileForm.profilePhotoPreview} 
                                    alt="Profile" 
                                    className="profile-photo-img"
                                />
                            ) : (
                                <div className="profile-photo-placeholder">
                                    <User size={48} />
                                </div>
                            )}
                            <label className="profile-photo-upload-btn">
                                <Camera size={20} />
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleProfilePhotoChange}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                        <p className="profile-photo-hint">Click camera icon to upload photo</p>
                    </div>

                    {/* Name Field */}
                    <div className="form-group">
                        <label htmlFor="profile-name">Name</label>
                        <input
                            type="text"
                            id="profile-name"
                            className="form-control"
                            value={profileForm.name}
                            onChange={(e) => handleProfileFormChange('name', e.target.value)}
                            placeholder="Enter your name"
                        />
                    </div>

                    {/* Phone Number Field */}
                    <div className="form-group">
                        <label htmlFor="profile-phone">Phone Number</label>
                        <input
                            type="text"
                            id="profile-phone"
                            className="form-control"
                            value={profileForm.phoneNumber}
                            onChange={(e) => handleProfileFormChange('phoneNumber', e.target.value)}
                            placeholder="Enter your phone number"
                        />
                    </div>

                    {/* Password Change Section */}
                    <div className="password-section">
                        <h3>Change Password</h3>
                        <div className="form-group">
                            <label htmlFor="profile-password">New Password</label>
                            <input
                                type="password"
                                id="profile-password"
                                className="form-control"
                                value={profileForm.password}
                                onChange={(e) => handleProfileFormChange('password', e.target.value)}
                                placeholder="Enter new password"
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="profile-confirm-password">Confirm Password</label>
                            <input
                                type="password"
                                id="profile-confirm-password"
                                className="form-control"
                                value={profileForm.confirmPassword}
                                onChange={(e) => handleProfileFormChange('confirmPassword', e.target.value)}
                                placeholder="Confirm new password"
                            />
                        </div>
                    </div>

                    <div className="profile-modal-actions">
                        <button 
                            className="btn-cancel"
                            onClick={handleCloseProfileModal}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button 
                            className="btn-submit"
                            onClick={handleUpdateProfile}
                            disabled={loading}
                        >
                            {loading ? 'Updating...' : 'Update Profile'}
                        </button>
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
};

export default Profile;
