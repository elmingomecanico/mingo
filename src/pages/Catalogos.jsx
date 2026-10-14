import React, { useState } from 'react';
import { Settings, Building2, Printer, Hash, ShieldAlert, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BranchManager from '../components/catalogos/BranchManager';
import PrintFormatEditor from '../components/catalogos/PrintFormatEditor';
import ConsecutivosManager from '../components/catalogos/ConsecutivosManager';
import CajasManager from '../components/catalogos/CajasManager';

export default function Catalogos() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('sucursales');

  const tabs = [
    { 
      id: 'sucursales', 
      name: 'Sucursales y Sedes', 
      icon: <Building2 size={18} />,
      desc: 'Administración de sedes, encargados, direcciones y prefijos de sucursal.'
    },
    { 
      id: 'cajas', 
      name: 'Cajas Registradoras', 
      icon: <Store size={18} />,
      desc: 'Gestión de terminales de cobro, asignación de vendedores y control de turnos.'
    },
    { 
      id: 'impresion', 
      name: 'Formatos Imprimibles', 
      icon: <Printer size={18} />,
      desc: 'Editor WYSIWYG de tickets térmicos (80mm/58mm), encabezados y garantías.'
    },
    { 
      id: 'consecutivos', 
      name: 'Folios y Códigos', 
      icon: <Hash size={18} />,
      desc: 'Reglas de correlativos de factura, numeración inicial y formato de códigos visibles.'
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Settings className="text-gray-700" /> 
            Configuración del Sistema
          </h1>
          <p className="text-gray-500 text-sm">
            Parámetros delicados de empresa: sedes, formatos de impresión térmica y folios de facturación.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold">
          <ShieldAlert size={16} className="text-amber-600" />
          <span>Panel de Administración (SuperAdmin)</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row">
        
        {/* Sidebar de Tabs */}
        <div className="w-full md:w-64 bg-gray-50/50 border-r border-gray-100 p-4 space-y-1.5 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm text-left ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className={activeTab === tab.id ? 'text-white' : 'text-gray-500'}>
                {tab.icon}
              </span>
              <span className="truncate">{tab.name}</span>
            </button>
          ))}
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 p-4 sm:p-6 min-w-0">
          {activeTab === 'sucursales' && <BranchManager user={user} />}
          {activeTab === 'cajas' && <CajasManager user={user} />}
          {activeTab === 'impresion' && <PrintFormatEditor />}
          {activeTab === 'consecutivos' && <ConsecutivosManager user={user} />}
        </div>
      </div>
    </div>
  );
}
