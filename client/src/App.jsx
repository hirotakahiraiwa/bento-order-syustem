import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Calendar from './pages/Calendar';
import OrderConfirm from './pages/OrderConfirm';
import MonthlySummary from './pages/MonthlySummary';
import EmployeeManagement from './pages/EmployeeManagement';

function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading"><div className="spinner" />読み込み中...</div>;
  }

  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading"><div className="spinner" />読み込み中...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Calendar />} />
        <Route path="admin/orders" element={<PrivateRoute adminOnly><OrderConfirm /></PrivateRoute>} />
        <Route path="admin/monthly" element={<PrivateRoute adminOnly><MonthlySummary /></PrivateRoute>} />
        <Route path="admin/employees" element={<PrivateRoute adminOnly><EmployeeManagement /></PrivateRoute>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
