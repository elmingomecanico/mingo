import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Package, BarChart2, Settings, LogOut } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import logoIcon from '../assets/logo-icon.jpg';

export default function Layout({ children }) {
  const location = useLocation();
  
  const menu = [
    { name: 'Dashboard', path: '/', icon: <Home size={20} /> },
    { name: 'Punto de Venta', path: '/pos', icon: <ShoppingCart size={20} /> },
    { name: 'Inventario', path: '/inventario', icon: <Package size={20} /> },
    { name: 'Reportes', path: '/reportes', icon: <BarChart2 size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-800">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-xl flex flex-col z-10">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <img src={logoIcon} alt="Logo" className="w-10 h-10 object-contain rounded" />
          <h1 className="font-black text-xl text-blue-950 leading-tight">Taller<br/>El Mingo</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menu.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200 font-bold' 
                  : 'text-gray-500 hover:bg-blue-50 hover:text-blue-700 font-medium'
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-gray-100">
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 w-full transition-colors font-bold">
            <LogOut size={20} />
            Salir
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 overflow-y-auto bg-gray-50/50">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
