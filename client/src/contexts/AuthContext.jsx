import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('bento_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('bento_token');
    if (token) {
      api.getMe()
        .then(u => {
          setUser(u);
          localStorage.setItem('bento_user', JSON.stringify(u));
        })
        .catch(() => {
          localStorage.removeItem('bento_token');
          localStorage.removeItem('bento_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (employee_number, password) => {
    const result = await api.login(employee_number, password);
    localStorage.setItem('bento_token', result.token);
    localStorage.setItem('bento_user', JSON.stringify(result.user));
    setUser(result.user);
    return result.user;
  };

  const logout = () => {
    localStorage.removeItem('bento_token');
    localStorage.removeItem('bento_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
