import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CompanySettingsProvider } from './context/CompanySettingsContext';
import ProtectedRoute from './components/ProtectedRoute';

// Import Pages
import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Projects     from './pages/Projects';
import Quotations   from './pages/Quotations';
import ProjectDetail from './pages/ProjectDetail';
import Finance      from './pages/Finance';
import Inventory    from './pages/Inventory';
import Labour       from './pages/Labour';
import Reports      from './pages/Reports';
import ClientPortal from './pages/ClientPortal';
import Settings     from './pages/Settings';

export default function App() {
  return (
    <AuthProvider>
      <CompanySettingsProvider>
      <Router>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* All protected routes — single admin has full access */}
          <Route path="/"              element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/projects"      element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/quotations"    element={<ProtectedRoute><Quotations /></ProtectedRoute>} />
          <Route path="/projects/:id"  element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
          <Route path="/finance"       element={<ProtectedRoute><Finance /></ProtectedRoute>} />
          <Route path="/inventory"     element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
          <Route path="/labour"        element={<ProtectedRoute><Labour /></ProtectedRoute>} />
          <Route path="/reports"       element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/client-portal" element={<ProtectedRoute><ClientPortal /></ProtectedRoute>} />
          <Route path="/settings"      element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      </CompanySettingsProvider>
    </AuthProvider>
  );
}