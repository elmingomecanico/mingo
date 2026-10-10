import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Package, BarChart2, Settings, LogOut, Activity, Users, Wallet, Menu, X, ShieldCheck, Truck } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import logoIcon from '../assets/logo-icon.jpg';

export default function Layout({ children }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  
  const menu = [
    { name: 'Dashboard', path: '/', icon: <Home size={20} />, roles: ['Administrador', 'Cajero', 'Mecánico'] },
    { name: 'Caja POS', path: '/pos', icon: <ShoppingCart size={20} />, roles: ['Administrador', 'Cajero'] },
    { name: 'Inventario', path: '/inventario', icon: <Package size={20} />, roles: ['Administrador', 'Cajero'] },
    { name: 'Clientes', path: '/clientes', icon: <Users size={20} />, roles: ['Administrador', 'Cajero'] },
    { name: 'CxC', path: '/cxc', icon: <Wallet size={20} />, roles: ['Administrador', 'Cajero'] },
    { name: 'Proveedores', path: '/proveedores', icon: <Truck size={20} />, roles: ['Administrador'] },
    { name: 'CxP', path: '/cxp', icon: <Wallet size={20} />, roles: ['Administrador'] },
    { name: 'Kardex', path: '/kardex', icon: <Activity size={20} />, roles: ['Administrador'] },
    { name: 'Reportes', path: '/reportes', icon: <BarChart2 size={20} />, roles: ['Administrador'] },
    { name: 'Ajustes', path: '/catalogos', icon: <Settings size={20} />, roles: ['Administrador'] },
    { name: 'Usuarios', path: '/usuarios', icon: <ShieldCheck size={20} />, roles: ['Administrador'] },
  ];

  // Filtrar menú por rol
  const filteredMenu = menu.filter(item => item.roles.includes(user?.rol));

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
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {filteredMenu.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.name} 
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                    : 'text-blue-100 hover:bg-blue-800 hover:text-white'
                  }`}
              >
                {item.icon}
                {item.name}
              </Link>
            )
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
