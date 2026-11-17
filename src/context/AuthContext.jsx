import React, { createContext, useContext, useState, useEffect } from 'react';
import { ref, get, push, set } from 'firebase/database';
import { rtdb } from '../firebase';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sucursalActiva, setSucursalActivaState] = useState(null);

  useEffect(() => {
    // Check si hay sesión guardada en localStorage
    const savedUser = localStorage.getItem('mingo_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      try {
        const savedSuc = JSON.parse(localStorage.getItem('mingo_sucursal_activa') || 'null');
        if (savedSuc && savedSuc.userId === parsed.id && savedSuc.sucursalId) {
          setSucursalActivaState(savedSuc.sucursalId);
        }
      } catch { /* sin sucursal guardada */ }
    }
    setLoading(false);
  }, []);

  // Define la sucursal de trabajo de la sesión y deja constancia en la bitácora de accesos
  const seleccionarSucursal = async (sucursalId, sucursalNombre = '', tipo = 'inicio_sesion') => {
    if (!user || !sucursalId) return;
    setSucursalActivaState(sucursalId);
    localStorage.setItem('mingo_sucursal_activa', JSON.stringify({ userId: user.id, sucursalId }));
    try {
      const ahora = new Date();
      const fecha = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      await set(push(ref(rtdb, 'bitacora_accesos_sucursal')), {
        id_usuario: user.id,
        usuario: user.usuario || '',
        nombre_completo: user.nombre_completo || '',
        rol: user.rol || '',
        id_sucursal: sucursalId,
        nombre_sucursal: sucursalNombre || sucursalId,
        tipo,
        fecha,
        timestamp: ahora.toISOString()
      });
    } catch (err) {
      console.warn('No se pudo registrar el acceso a sucursal:', err);
    }
  };

  const login = async (username, password) => {
    try {
      const usersRef = ref(rtdb, 'usuarios');
      const snapshot = await get(usersRef);
      
      if (snapshot.exists()) {
        const users = snapshot.val();
        // Buscar coincidencia de usuario y contraseña
        const userKey = Object.keys(users).find(
          key => users[key].usuario === username && users[key].password === password
        );

        if (userKey) {
          const userData = { id: userKey, ...users[userKey] };
          
          if (userData.estado === 'Inactivo') {
            toast.error("Este usuario está desactivado");
            return false;
          }

          setUser(userData);
          setSucursalActivaState(null);
          localStorage.removeItem('mingo_sucursal_activa');
          localStorage.setItem('mingo_user', JSON.stringify(userData));
          toast.success(`Bienvenido, ${userData.nombre_completo}`);
          return true;
        } else {
          toast.error("Usuario o contraseña incorrectos");
          return false;
        }
      } else {
        toast.error("No hay usuarios registrados en el sistema");
        return false;
      }
    } catch (error) {
      const msg = error?.message || '';
      if (msg.includes('permission_denied') || msg.includes('Permission denied')) {
        toast.error("Error de permisos en Firebase: Las reglas de la base de datos están bloqueadas o expiraron. Verifique las reglas en la consola de Firebase.", { duration: 6000 });
      } else {
        toast.error("Error de conexión: " + error.message);
      }
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setSucursalActivaState(null);
    localStorage.removeItem('mingo_sucursal_activa');
    localStorage.removeItem('mingo_user');
    toast.success("Sesión cerrada");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, sucursalActiva, seleccionarSucursal }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

