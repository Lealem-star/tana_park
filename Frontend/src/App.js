import './App.css';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useEffect } from 'react';
import { Layout, Home, NoPage, Users, About, Login, Register, AdminDashboard, DashboardOverview, UserManagement, Settings, Reports, GroupChat, ValetDashboard, ValetOverview, RegisterCar, ParkedCarsList, FlaggedCustomers } from './pages/common';
import Profile from './pages/valet/Profile';
import PaymentCallback from './pages/valet/PaymentCallback';
import { syncLanguageWithUser } from './utils/languageSync';

// Protected route wrapper - redirects logged-in users away from login/register
function PublicRoute({ children }) {
  const user = useSelector((state) => state.user);
  
  // If user is logged in, redirect to their dashboard
  if (user && user.token) {
    if (user.type === 'system_admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (user.type === 'valet') {
      return <Navigate to="/valet/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }
  
  return children;
}

// Root redirect component - redirects based on user type
function RootRedirect() {
  const user = useSelector((state) => state.user);
  
  if (user && user.token) {
    if (user.type === 'system_admin') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (user.type === 'valet') {
      return <Navigate to="/valet/dashboard" replace />;
    }
  }
  
  return <Home />;
}

function App() {
  const user = useSelector((state) => state.user);

  // Sync language with user preference
  useEffect(() => {
    if (user?.language) {
      syncLanguageWithUser(user.language);
    }
  }, [user?.language]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<RootRedirect />} />
          <Route path="profile" element={<Profile />} />
          <Route path="users" element={<Users />} />
          <Route path="about" element={<About />} />
        </Route>
        <Route path="/admin" element={<AdminDashboard />}>
          <Route index element={<DashboardOverview />} />
          <Route path="dashboard" element={<DashboardOverview />} />
          <Route path="dashboard/profile" element={<DashboardOverview />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="chat" element={<GroupChat />} />
          <Route path="flagged-customers" element={<FlaggedCustomers />} />
        </Route>
        <Route path="/valet" element={<ValetDashboard />}>
          <Route index element={<ParkedCarsList />} />
          <Route path="dashboard" element={<ParkedCarsList />} />
          <Route path="register-car" element={<RegisterCar />} />
          <Route path="cars" element={<ValetOverview />} />
          <Route path="profile" element={<Profile />} />
          <Route path="chat" element={<GroupChat />} />
          <Route path="flagged-customers" element={<FlaggedCustomers />} />
        </Route>
        <Route path="login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />
        <Route path="register" element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        } />
        <Route path="payment/success" element={<PaymentCallback />} />
        <Route path="payment/callback" element={<PaymentCallback />} />
        <Route path="*" element={<NoPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
