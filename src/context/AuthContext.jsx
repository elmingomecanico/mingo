import React, { createContext, useContext, useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { rtdb } from '../firebase';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check si hay sesión guardada en localStorage
    const savedUser = localStorage.getItem('mingo_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

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
      toast.error("Error de conexión: " + error.message);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('mingo_user');
    toast.success("Sesión cerrada");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
