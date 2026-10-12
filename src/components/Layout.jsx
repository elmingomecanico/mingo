import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Package, BarChart2, Settings, LogOut, Activity, Users, Wallet, Menu, X, ShieldCheck, Truck, Wrench, ShoppingBag, UserCheck, Landmark } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import logoIcon from '../assets/logo-icon.jpg';

export default function Layout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  
  const menuSections = [
    {
      title: 'Operaciones',
      items: [
        { name: 'Dashboard', path: '/', icon: <Home size={18} />, perm: 'VER_REPORTES' },
        { name: 'Caja POS', path: '/pos', icon: <ShoppingCart size={18} />, perm: 'VER_POS' },
        { name: 'Órdenes (Taller)', path: '/taller', icon: <Wrench size={18} />, perm: 'VER_TALLER' },
      ]
    },
    {
      title: 'Inventario & Compras',
      items: [
        { name: 'Inventario', path: '/inventario', icon: <Package size={18} />, perm: 'VER_INVENTARIO' },
        { name: 'Servicios', path: '/servicios', icon: <Wrench size={18} />, perm: 'VER_INVENTARIO' },
        { name: 'Compras', path: '/compras', icon: <ShoppingBag size={18} />, perm: 'VER_COMPRAS' },
        { name: 'Kardex', path: '/kardex', icon: <Activity size={18} />, perm: 'VER_REPORTES' },
      ]
    },
    {
      title: 'Comercial',
      items: [
        { name: 'Clientes', path: '/clientes', icon: <Users size={18} />, perm: 'VER_CLIENTES' },
        { name: 'Cuentas por Cobrar (CxC)', path: '/cxc', icon: <Wallet size={18} />, perm: 'VER_CXC' },
        { name: 'Proveedores', path: '/proveedores', icon: <Truck size={18} />, perm: 'VER_PROVEEDORES' },
      ]
    },
    {
      title: 'Finanzas',
      items: [
        { name: 'Contabilidad & CxP', path: '/contabilidad', icon: <Landmark size={18} />, perm: 'VER_CONTABILIDAD' },
        { name: 'Reportes y Ventas', path: '/reportes', icon: <BarChart2 size={18} />, perm: 'VER_REPORTES' },
      ]
    },
    {
      title: 'Recursos Humanos',
      items: [
        { name: 'Gestión RRHH', path: '/rrhh', icon: <Users size={18} />, perm: 'VER_USUARIOS' },
        { name: 'Portal Empleado', path: '/mi-portal', icon: <UserCheck size={18} />, perm: 'PUBLICO' },
      ]
    },
    {
      title: 'Administración',
      items: [
        { name: 'Configuración del Sistema', path: '/catalogos', icon: <Settings size={18} />, perm: 'VER_CATALOGOS' },
        { name: 'Usuarios', path: '/usuarios', icon: <ShieldCheck size={18} />, perm: 'VER_USUARIOS' },
      ]
    }
  ];

  // Función para verificar permiso
  const hasPermission = (perm) => {
    if (!user) return false;
    if (perm === 'PUBLICO') return true;
    if (user.rol === 'SuperAdmin') return true;
    if (perm === 'VER_TALLER' && user.funcion === 'Mecánico') return true;
    if (perm === 'VER_CONTABILIDAD' && (user.permisos?.includes('VER_CONTABILIDAD') || user.permisos?.includes('VER_CXP') || user.permisos?.includes('VER_REPORTES'))) return true;
    return user.permisos && user.permisos.includes(perm);
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-800 overflow-hidden">
      <Toaster position="top-right" />
      
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)}></div>
      )}

      {/* Sidebar Desktop & Mobile */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-blue-900 text-white flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between border-b border-blue-800">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="El Mingo" className="w-10 h-10 rounded-full border-2 border-white" />
            <div>
              <h2 className="text-xl font-black tracking-tight leading-tight">El Mingo</h2>
              <p className="text-[10px] text-blue-300 font-mono tracking-widest uppercase">ERP System</p>
            </div>
          </div>
          <button className="md:hidden text-blue-200" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>

        {/* User Info */}
        <div className="px-6 py-4 border-b border-blue-800 bg-blue-950/30">
          <p className="text-xs text-blue-300 font-bold uppercase mb-1">Sesión Iniciada</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold">
              {user?.nombre_completo?.charAt(0) || 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-sm truncate">{user?.nombre_completo}</p>
              <p className="text-xs text-blue-300 truncate">{user?.rol} • {user?.id_sucursal}</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {menuSections.map((sec, secIdx) => {
            const visibleItems = sec.items.filter(item => {
              if (item.name === 'Dashboard' || item.path === '/mi-portal') return true;
              return hasPermission(item.perm);
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={secIdx} className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-blue-300/70 tracking-wider px-3 mb-1">
                  {sec.title}
                </p>
                {visibleItems.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link 
                      key={item.name} 
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 text-xs font-semibold
                        ${isActive 
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-950' 
                          : 'text-blue-100 hover:bg-blue-800 hover:text-white'
                        }`}
                    >
                      {item.icon}
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-800">
          <button onClick={logout} className="flex items-center gap-3 text-blue-200 hover:text-white hover:bg-red-500/20 px-4 py-3 rounded-xl w-full transition-colors font-bold">
            <LogOut size={20} />
            Cerrar Sesión
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header Mobile */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <img src={logoIcon} alt="El Mingo" className="w-8 h-8 rounded-full" />
            <h1 className="font-black text-gray-800 text-lg">El Mingo ERP</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600 p-2 hover:bg-gray-100 rounded-lg">
            <Menu size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
