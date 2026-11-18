import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ConfirmProvider } from './context/ConfirmContext'
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
import OrdenesTrabajo from './pages/OrdenesTrabajo'
import RRHH from './pages/RRHH'
import PortalEmpleado from './pages/PortalEmpleado'
import EcommerceStore from './pages/EcommerceStore'
import PendientesEntrega from './pages/PendientesEntrega'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Se produjo un error inesperado</h1>
                <p className="text-sm text-slate-400">El sistema protegió la sesión para evitar pérdida de datos.</p>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-700/60 rounded-xl p-4 text-xs font-mono text-red-300 break-words">
              {this.state.error?.toString() || 'Error desconocido'}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 min-w-[140px] px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors text-center"
              >
                Recargar página
              </button>
              <button
                onClick={() => { window.location.href = '/dashboard'; }}
                className="flex-1 min-w-[140px] px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl text-sm transition-colors text-center"
              >
                Ir al Dashboard
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 font-semibold rounded-xl text-sm transition-colors"
              >
                Reintentar
              </button>
            </div>

            {this.state.errorInfo && (
              <div className="pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                  className="text-xs text-slate-400 hover:text-slate-300 underline"
                >
                  {this.state.showDetails ? 'Ocultar detalles técnicos' : 'Ver detalles técnicos'}
                </button>
                {this.state.showDetails && (
                  <pre className="mt-2 p-3 bg-slate-950 rounded-lg text-[10px] text-slate-400 overflow-x-auto max-h-48 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
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

  // Función para validar permiso
  const hasPermission = (perm) => {
    if (!user) return false;
    if (user.rol === 'SuperAdmin') return true;
    if (perm === 'VER_TALLER' && user.funcion === 'Mecánico') return true;
    if (perm === 'VER_CONTABILIDAD' && (user.permisos?.includes('VER_CONTABILIDAD') || user.permisos?.includes('VER_CXP') || user.permisos?.includes('VER_REPORTES'))) return true;
    return user.permisos && user.permisos.includes(perm);
  };

  const ProtectedRoute = ({ children, perm }) => {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    if (perm && !hasPermission(perm)) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Layout>{children}</Layout>;
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* PÁGINA PRINCIPAL PÚBLICA: ECOMMERCE & CATÁLOGO EN LÍNEA */}
        <Route path="/" element={<EcommerceStore />} />
        <Route path="/tienda" element={<EcommerceStore />} />

        {/* ACCESO PERSONAL / FACTURACIÓN */}
        <Route path="/login" element={<Login />} />

        {/* RUTAS INTERNAS DEL ERP (PROTEGIDAS) */}
        <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute perm="VER_POS"><POS /></ProtectedRoute>} />
        <Route path="/entregas" element={<ProtectedRoute perm="VER_POS"><PendientesEntrega /></ProtectedRoute>} />
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
        <Route path="/usuarios" element={<ProtectedRoute perm="VER_USUARIOS"><Navigate to="/rrhh" replace /></ProtectedRoute>} />
        <Route path="/rrhh" element={<ProtectedRoute perm="VER_USUARIOS"><RRHH /></ProtectedRoute>} />
        <Route path="/mi-portal" element={<ProtectedRoute><PortalEmpleado /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfirmProvider>
          <AppRouter />
        </ConfirmProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App

