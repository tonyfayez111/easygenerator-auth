import React, { useCallback, useEffect, useState } from 'react';
import { authApi } from '../features/auth/api/authApi';
import { setAccessToken } from '../api/axios';
import { queryClient } from '../lib/queryClient';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const data = await authApi.refreshToken();
        setToken(data.access_token);
        setAccessToken(data.access_token);
      } catch {
        setToken(null);
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback((token: string) => {
    setToken(token);
    setAccessToken(token);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.signOut();
    } catch {
      // best-effort
    } finally {
      setToken(null);
      setAccessToken(null);
      queryClient.clear();
    }
  }, []);

  return (
    <AuthContext.Provider value={{ accessToken, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
