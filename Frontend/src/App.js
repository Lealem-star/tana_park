import './App.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout, Home, NoPage, Users, About, Login, Register, AdminDashboard, DashboardOverview, UserManagement, Settings, ValetDashboard, ValetOverview, RegisterCar, ParkedCarsList } from './pages/common';
import Profile from './pages/valet/Profile';
import PaymentCallback from './pages/valet/PaymentCallback';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="profile" element={<Profile />} />
          <Route path="users" element={<Users />} />
          <Route path="about" element={<About />} />
        </Route>
        <Route path="/admin" element={<AdminDashboard />}>
          <Route index element={<DashboardOverview />} />
          <Route path="dashboard" element={<DashboardOverview />} />
          <Route path="dashboard/profile" element={<DashboardOverview />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/valet" element={<ValetDashboard />}>
          <Route index element={<ValetOverview />} />
          <Route path="dashboard" element={<ValetOverview />} />
          <Route path="register-car" element={<RegisterCar />} />
          <Route path="cars" element={<ParkedCarsList />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="payment/success" element={<PaymentCallback />} />
        <Route path="payment/callback" element={<PaymentCallback />} />
        <Route path="*" element={<NoPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
