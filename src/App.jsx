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
import Login from './pages/Login'
import Usuarios from './pages/Usuarios'

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

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/cxc" element={<CxC />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/cxp" element={<CxP />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/kardex" element={<Kardex />} />
          <Route path="/catalogos" element={<Catalogos />} />
          <Route path="/usuarios" element={<Usuarios />} />
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
