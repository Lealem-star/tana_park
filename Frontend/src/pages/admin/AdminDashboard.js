import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { clearUser, setUser } from '../../reducers/userReducer';
import { resetPassword, updateUser, uploadProfilePhoto } from '../../api/api';
import TanaLogo from '../../img/Tana.png';
import { 
    LayoutDashboard, 
    Users, 
    Settings, 
    LogOut, 
    Menu,
    X,
    Bell,
    User,
    Camera
} from 'lucide-react';

import '../../css/adminDashboard.scss';

const AdminDashboard = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profileForm, setProfileForm] = useState({
        name: '',
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
    const location = useLocation();
    const dispatch = useDispatch();

    // Protect route - only system admin can access
    useEffect(() => {
        if (!user) {
            navigate('/login');
        } else if (user.type !== 'system_admin') {
            navigate('/');
        }
    }, [user, navigate]);

    // Show profile modal when route matches
    useEffect(() => {
        if (location.pathname === '/admin/dashboard/profile') {
            setShowProfileModal(true);
            const BASE_URL = process.env.REACT_APP_BASE_URL || "http://localhost:4000/";
            const photoUrl = user?.profilePhoto 
                ? (user.profilePhoto.startsWith('http') 
                    ? user.profilePhoto 
                    : `${BASE_URL}${user.profilePhoto.startsWith('/') ? user.profilePhoto.substring(1) : user.profilePhoto}`)
                : null;
            console.log('User profilePhoto from Redux:', user?.profilePhoto);
            console.log('Constructed photoUrl for modal:', photoUrl);
            setProfileForm({
                name: user?.name || '',
                password: '',
                confirmPassword: '',
                profilePhoto: null,
                profilePhotoPreview: photoUrl
            });
        } else {
            setShowProfileModal(false);
        }
    }, [location.pathname, user]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profileDropdownOpen && !event.target.closest('.user-profile-dropdown')) {
                setProfileDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [profileDropdownOpen]);

    const handleLogout = () => {
        dispatch(clearUser());
        navigate('/login');
        setProfileDropdownOpen(false);
    };

    const handleProfileUpdate = () => {
        navigate('/admin/dashboard/profile');
        setProfileDropdownOpen(false);
    };

    const handleCloseProfileModal = () => {
        navigate('/admin/dashboard');
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

        // Validate password if provided
        if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
            setError('New password and confirm password must match');
            setLoading(false);
            return;
        }

        // Track what needs to be updated
        const needsNameUpdate = profileForm.name !== user?.name;
        const needsPasswordUpdate = profileForm.password && profileForm.password.length > 0;
        const needsPhotoUpdate = profileForm.profilePhoto !== null;

        if (!needsNameUpdate && !needsPasswordUpdate && !needsPhotoUpdate) {
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

        // 2. Update name if changed
        if (needsNameUpdate) {
            updateChain = updateChain.then(() => {
                return new Promise((resolve, reject) => {
                    updateUser({
                        user_id: user?._id,
                        body: { name: profileForm.name },
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

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
        { icon: Users, label: 'User Management', path: '/admin/users' },
        { icon: Settings, label: 'Settings', path: '/admin/settings' },
    ];

    const isActive = (path) => {
        return location.pathname === path;
    };

    return (
        <div className="admin-dashboard">
            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        <img src={TanaLogo} alt="Logo" className="logo-img" />
                        <span className="logo-text">{user?.type === 'system_admin' ? 'System Admin' : (user?.type === 'admin' ? 'Admin' : 'Manager')}</span>
                    </div>
                    <button 
                        className="sidebar-toggle"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
                
                <nav className="sidebar-nav">
                    {menuItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={index}
                                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                                onClick={() => {
                                    navigate(item.path);
                                    setMobileMenuOpen(false);
                                }}
                            >
                                <Icon size={20} />
                                {sidebarOpen && <span>{item.label}</span>}
                            </button>
                        );
                    })}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-profile-dropdown">
                        <button 
                            className="nav-item user-profile-btn"
                            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                        >
                            {user?.profilePhoto ? (
                                <img 
                                    src={user.profilePhoto.startsWith('http') 
                                        ? user.profilePhoto 
                                        : `${process.env.REACT_APP_BASE_URL || 'http://localhost:4000/'}${user.profilePhoto.startsWith('/') ? user.profilePhoto.substring(1) : user.profilePhoto}`}
                                    alt="Profile" 
                                    className="user-avatar-img"
                                />
                            ) : (
                                <div className="user-avatar">
                                    {user?.name?.[0]?.toUpperCase()}
                                </div>
                            )}
                            {sidebarOpen && (
                                <>
                                    <span className="user-name">{user?.name || 'Admin'}</span>
                                    <span className="dropdown-arrow">▼</span>
                                </>
                            )}
                        </button>
                        {profileDropdownOpen && sidebarOpen && (
                            <div className="profile-dropdown-menu">
                                <button 
                                    className="dropdown-item"
                                    onClick={handleProfileUpdate}
                                >
                                    <span>Profile Update</span>
                                </button>
                                <button 
                                    className="dropdown-item logout-item"
                                    onClick={handleLogout}
                                >
                                    <LogOut size={16} />
                                    <span>Logout</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-content">
                {/* Header */}
                <header className="dashboard-header">
                    <div className="header-left">
                        <button 
                            className="mobile-menu-btn"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            <Menu size={24} />
                        </button>
                        <div className="welcome-message">
                            <span>Welcome, {user?.type === 'system_admin' ? 'System Admin' : (user?.type === 'admin' ? 'Admin' : 'Manager')}</span>
                        </div>
                    </div>
                    
                    <div className="header-right">
                        <button className="icon-btn">
                            <Bell size={20} />
                            <span className="badge">2</span>
                        </button>
                    </div>
                </header>


                {/* Mobile Sidebar Overlay */}
                {mobileMenuOpen && (
                    <div 
                        className="mobile-overlay"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        <aside 
                            className={`mobile-sidebar ${mobileMenuOpen ? 'open' : ''}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sidebar-header">
                                <div className="logo">
                                    <img src={TanaLogo} alt="Logo" className="logo-img" />
                                    <span className="logo-text">{user?.type === 'system_admin' ? 'System Admin' : (user?.type === 'admin' ? 'Admin' : 'Manager')}</span>
                                </div>
                                <button
                                    className="sidebar-toggle"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <nav className="sidebar-nav">
                                {menuItems.map((item, index) => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={index}
                                            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                                            onClick={() => {
                                                navigate(item.path);
                                                setMobileMenuOpen(false);
                                            }}
                                        >
                                            <Icon size={20} />
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </nav>
                        </aside>
                    </div>
                )}

                {/* Page Content */}
                <div className="content-area">
                    <Outlet />
                </div>
            </div>

            {/* Profile Update Modal */}
            {showProfileModal && (
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

                            {/* Email (read-only) */}
                            <div className="form-group">
                                <label htmlFor="profile-email">Email</label>
                                <input
                                    type="email"
                                    id="profile-email"
                                    className="form-control"
                                    value={user?.email || ''}
                                    disabled
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
            )}
        </div>
    );
};

export default AdminDashboard;

