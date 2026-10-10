import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, Package, BarChart2, Settings, LogOut } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import logoIcon from '../assets/logo-icon.jpg';

export default function Layout({ children }) {
  const location = useLocation();
  
  const menu = [
    { name: 'Dashboard', path: '/', icon: <Home size={20} /> },
    { name: 'Caja POS', path: '/pos', icon: <ShoppingCart size={20} /> },
    { name: 'Inventario', path: '/inventario', icon: <Package size={20} /> },
    { name: 'Reportes', path: '/reportes', icon: <BarChart2 size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-800">
      <Toaster position="top-right" />
      
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex w-64 bg-white shadow-xl flex-col z-10">
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-gray-50/50 pb-20 md:pb-0 flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden bg-white shadow-sm border-b border-gray-100 p-4 flex items-center justify-center gap-2 sticky top-0 z-20">
          <img src={logoIcon} alt="Logo" className="w-8 h-8 object-contain rounded" />
          <h1 className="font-black text-lg text-blue-950">Taller El Mingo</h1>
        </header>

        <div className="p-4 md:p-8 flex-1">
          {children}
        </div>
      </main>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.05)] border-t border-gray-100 flex justify-around items-center p-2 z-20 pb-safe">
        {menu.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path} 
              to={item.path}
              className={`flex flex-col items-center gap-1 p-2 min-w-[4rem] ${
                isActive ? 'text-blue-600 font-bold' : 'text-gray-400'
              }`}
            >
              <div className={`${isActive ? 'bg-blue-100' : ''} p-1.5 rounded-xl transition-colors`}>
                {item.icon}
              </div>
              <span className="text-[10px] text-center leading-none">{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  );
}
