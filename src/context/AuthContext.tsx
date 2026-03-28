import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getMe, type SpotifyUser } from '../spotify/api';
import { isLoggedIn, logout as doLogout } from '../spotify/auth';

interface AuthContextValue {
  user: SpotifyUser | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn()) {
      setLoading(false);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => {
        doLogout();
      })
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    doLogout();
    setUser(null);
    window.location.href = '/';
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
