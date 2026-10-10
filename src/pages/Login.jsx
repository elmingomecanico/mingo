import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Wrench, Lock, User, ShieldAlert } from 'lucide-react';
import { ref, push, set, get } from 'firebase/database';
import { rtdb } from '../firebase';
import toast from 'react-hot-toast';
import logoIcon from '../assets/logo-icon.jpg';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await login(username.trim(), password.trim());
    setLoading(false);
  };

  // Función de emergencia para crear el primer administrador si la BD está vacía
  const createInitialAdmin = async () => {
    try {
      const usersRef = ref(rtdb, 'usuarios');
      const snapshot = await get(usersRef);
      if (snapshot.exists()) {
        return toast.error("Ya existen usuarios en la base de datos.");
      }

      const newAdminRef = push(usersRef);
      await set(newAdminRef, {
        nombre_completo: "Administrador del Sistema",
        usuario: "admin",
        password: "123", // Contraseña por defecto
        rol: "Administrador",
        estado: "Activo",
        id_sucursal: "SUC-01"
      });
      toast.success("Usuario administrador creado (admin / 123). Inicia sesión.");
    } catch (e) {
      toast.error("Error: " + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Lado de la Imagen / Branding */}
        <div className="w-full md:w-1/2 bg-blue-900 p-12 flex flex-col items-center justify-center text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="relative z-10">
            <img src={logoIcon} alt="Taller El Mingo Logo" className="w-32 h-32 rounded-full border-4 border-white/20 shadow-2xl mx-auto mb-6" />
            <h1 className="text-3xl font-black mb-2 tracking-tight">ERP TALLER EL MINGO</h1>
            <p className="text-blue-200 font-medium max-w-sm mx-auto">
              Sistema Integral de Facturación, Inventario y Control de Taller.
            </p>
          </div>
        </div>

        {/* Lado del Formulario */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-gray-800">Iniciar Sesión</h2>
            <p className="text-gray-500 text-sm mt-1">Ingresa tus credenciales para acceder al sistema.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Usuario</label>
              <div className="relative">
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full border-2 border-gray-200 pl-11 pr-4 py-3 rounded-xl outline-none focus:border-blue-600 transition-colors font-medium text-gray-800" 
                  placeholder="ej. admin" 
                />
                <User className="absolute left-4 top-3.5 text-gray-400" size={20} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border-2 border-gray-200 pl-11 pr-4 py-3 rounded-xl outline-none focus:border-blue-600 transition-colors font-medium text-gray-800" 
                  placeholder="••••••••" 
                />
                <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black text-lg py-3 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95 flex justify-center items-center gap-2 mt-4"
            >
              {loading ? 'Verificando...' : 'Entrar al Sistema'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <button 
              onClick={createInitialAdmin}
              className="text-xs text-gray-400 hover:text-blue-600 flex items-center justify-center gap-1 mx-auto transition-colors"
            >
              <ShieldAlert size={14} />
              Crear Admin Inicial (Solo si la BD está vacía)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
