import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { clearUser } from '../../reducers/userReducer';
import TanaLogo from '../../img/Tana.png';
import { 
    LayoutDashboard, 
    Car, 
    List, 
    BarChart3,
    LogOut, 
    Menu,
    X,
    Bell,
    User
} from 'lucide-react';
import { socket } from '../../utils/chatSocket';
import '../../css/valetDashboard.scss';

const ValetDashboard = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const user = useSelector((state) => state.user);
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch();

    // Protect route - only valets can access
    useEffect(() => {
        if (!user) {
            navigate('/login');
        } else if (user.type !== 'valet') {
            navigate('/');
        }
    }, [user, navigate]);

    const handleLogout = () => {
        dispatch(clearUser());
        navigate('/login');
    };

    const handleProfileUpdate = () => {
        navigate('/valet/profile'); // Assuming 'profile' is the existing route for profile management
    };

    useEffect(() => {
        const handleNewMessage = (msg) => {
            if (location.pathname === '/valet/chat') return;
            setUnreadCount((prev) => prev + 1);
        };
        socket.on('chat:newMessage', handleNewMessage);
        return () => {
            socket.off('chat:newMessage', handleNewMessage);
        };
    }, [location.pathname]);

    const handleBellClick = () => {
        navigate('/valet/chat');
        setUnreadCount(0);
    };

    const menuItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/valet/dashboard' },
        { icon: Car, label: 'Register Car', path: '/valet/register-car' },
        { icon: List, label: 'Parked Cars', path: '/valet/cars' },
    ];

    const isActive = (path) => {
        return location.pathname === path;
    };

    if (!user || user.type !== 'valet') {
        return null;
    }

    return (
        <div className="valet-dashboard">
            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        <img src={TanaLogo} alt="Logo" className="logo-img" />
                        <span className="logo-text">{user?.type === 'valet' ? 'Valet' : (user?.type === 'admin' ? 'Admin' : 'Manager')}</span>
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
                            <span>Welcome, {user?.name || 'Valet'}</span>
                        </div>
                    </div>
                    
                    <div className="header-right">
                        <button className="icon-btn" onClick={handleBellClick}>
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <span className="badge">{unreadCount}</span>
                            )}
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
                                    <span className="logo-text">{user?.type === 'valet' ? 'Valet' : (user?.type === 'admin' ? 'Admin' : 'Manager')}</span>
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
                                <button
                                    className={`nav-item ${isActive('/valet/profile') ? 'active' : ''}`}
                                    onClick={() => {
                                        navigate('/valet/profile');
                                        setMobileMenuOpen(false);
                                    }}
                                >
                                    <User size={20} />
                                    <span>Profile</span>
                                </button>
                                <button
                                    className="nav-item logout-item"
                                    onClick={() => {
                                        handleLogout();
                                        setMobileMenuOpen(false);
                                    }}
                                >
                                    <LogOut size={20} />
                                    <span>Logout</span>
                                </button>
                            </nav>
                        </aside>
                    </div>
                )}

                {/* Page Content */}
                <div className="content-area">
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default ValetDashboard;

