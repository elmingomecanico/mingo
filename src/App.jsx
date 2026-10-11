import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import POS from './components/POS'
import Home from './pages/Home'
import Inventario from './pages/Inventario'
import Reportes from './pages/Reportes'
import Kardex from './pages/Kardex'
import Catalogos from './pages/Catalogos'
import Clientes from './pages/Clientes'
import CxC from './pages/CxC'
import Proveedores from './pages/Proveedores'
import CxP from './pages/CxP'
import Compras from './pages/Compras'
import Contabilidad from './pages/Contabilidad'
import Servicios from './pages/Servicios'
import Login from './pages/Login'
import Usuarios from './pages/Usuarios'
import OrdenesTrabajo from './pages/OrdenesTrabajo'
import RRHH from './pages/RRHH'
import PortalEmpleado from './pages/PortalEmpleado'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: 'red', color: 'white' }}>
          <h1>¡Algo salió mal en el código!</h1>
          <pre>{this.state.error && this.state.error.toString()}</pre>
          <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-gray-100 font-bold text-gray-500">Cargando sistema...</div>;
  }

  if (!user) {
    return <Login />;
  }

  // Función para validar permiso
  const hasPermission = (perm) => {
    if (user.rol === 'SuperAdmin') return true;
    if (perm === 'VER_TALLER' && user.funcion === 'Mecánico') return true;
    if (perm === 'VER_CONTABILIDAD' && (user.permisos?.includes('VER_CONTABILIDAD') || user.permisos?.includes('VER_CXP') || user.permisos?.includes('VER_REPORTES'))) return true;
    return user.permisos && user.permisos.includes(perm);
  };

  const ProtectedRoute = ({ children, perm }) => {
    if (!hasPermission(perm)) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          {/* Home no requiere permiso específico, todos los logueados entran */}
          <Route path="/" element={<Home />} />
          <Route path="/pos" element={<ProtectedRoute perm="VER_POS"><POS /></ProtectedRoute>} />
          <Route path="/taller" element={<ProtectedRoute perm="VER_TALLER"><OrdenesTrabajo /></ProtectedRoute>} />
          <Route path="/inventario" element={<ProtectedRoute perm="VER_INVENTARIO"><Inventario /></ProtectedRoute>} />
          <Route path="/clientes" element={<ProtectedRoute perm="VER_CLIENTES"><Clientes /></ProtectedRoute>} />
          <Route path="/cxc" element={<ProtectedRoute perm="VER_CXC"><CxC /></ProtectedRoute>} />
          <Route path="/proveedores" element={<ProtectedRoute perm="VER_PROVEEDORES"><Proveedores /></ProtectedRoute>} />
          <Route path="/cxp" element={<ProtectedRoute perm="VER_CXP"><CxP /></ProtectedRoute>} />
          <Route path="/contabilidad" element={<ProtectedRoute perm="VER_CONTABILIDAD"><Contabilidad /></ProtectedRoute>} />
          <Route path="/compras" element={<ProtectedRoute perm="VER_COMPRAS"><Compras /></ProtectedRoute>} />
          <Route path="/servicios" element={<ProtectedRoute perm="VER_INVENTARIO"><Servicios /></ProtectedRoute>} />
          <Route path="/reportes" element={<ProtectedRoute perm="VER_REPORTES"><Reportes /></ProtectedRoute>} />
          <Route path="/kardex" element={<ProtectedRoute perm="VER_REPORTES"><Kardex /></ProtectedRoute>} />
          <Route path="/catalogos" element={<ProtectedRoute perm="VER_CATALOGOS"><Catalogos /></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute perm="VER_USUARIOS"><Usuarios /></ProtectedRoute>} />
          <Route path="/rrhh" element={<ProtectedRoute perm="VER_USUARIOS"><RRHH /></ProtectedRoute>} />
          <Route path="/mi-portal" element={<PortalEmpleado />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
