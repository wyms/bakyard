import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AuthGuard from './components/AuthGuard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Sessions from './pages/Sessions';
import Courts from './pages/Courts';
import Orders from './pages/Orders';
import Memberships from './pages/Memberships';
import Pricing from './pages/Pricing';
import Reports from './pages/Reports';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="courts" element={<Courts />} />
        <Route path="orders" element={<Orders />} />
        <Route path="memberships" element={<Memberships />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
