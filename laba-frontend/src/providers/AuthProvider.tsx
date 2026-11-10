'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthUser } from '@/types/auth.types';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const res = await apiClient.get('/auth/me');
      setUser(res.data.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: any) => {
    const res = await apiClient.post('/auth/login', credentials);
    const { user: loggedInUser, token } = res.data.data;

    if (token && typeof window !== 'undefined') {
      localStorage.setItem('labe_token', token);
      localStorage.setItem('laba_token', token);
    }

    setUser(loggedInUser);

    // Redirect based on role
    const role = loggedInUser.role;
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      router.push('/admin');
    } else {
      router.push('/employee');
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('labe_token');
        localStorage.removeItem('laba_token');
      }
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

