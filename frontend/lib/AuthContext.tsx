'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, User } from './auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (params: { email: string; password: string }) => Promise<{
    success: boolean;
    message: string;
    user?: User;
    requiresVerification?: boolean;
    otpCode?: string;
    lockoutSeconds?: number;
  }>;
  register: (params: {
    fullName: string;
    email: string;
    password: string;
    role?: string;
    organization?: string;
  }) => Promise<{ success: boolean; message: string; otpCode?: string }>;
  verifyOTP: (email: string, code: string) => Promise<{ success: boolean; message: string; user?: User; lockoutSeconds?: number }>;
  resendOTP: (email: string) => Promise<{ success: boolean; message: string; otpCode?: string; cooldownSeconds?: number }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; message: string; otpCode?: string }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; message: string; lockoutSeconds?: number }>;
  checkRateLimit: (key: string) => { isLocked: boolean; remainingSeconds: number };
  clearRateLimit: (key: string) => void;
  logout: () => void;
  refreshSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = () => {
    const current = authService.getCurrentUser();
    setUser(current);
    setIsLoading(false);
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = async (params: { email: string; password: string }) => {
    const res = await authService.login(params);
    if (res.success && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const register = async (params: {
    fullName: string;
    email: string;
    password: string;
    role?: string;
    organization?: string;
  }) => {
    return await authService.register(params);
  };

  const verifyOTP = async (email: string, code: string) => {
    const res = await authService.verifyOTP(email, code);
    if (res.success && res.user) {
      setUser(res.user);
    }
    return res;
  };

  const resendOTP = async (email: string) => {
    return await authService.resendOTP(email);
  };

  const requestPasswordReset = async (email: string) => {
    return await authService.requestPasswordReset(email);
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    return await authService.resetPassword(email, code, newPassword);
  };

  const checkRateLimit = (key: string) => {
    return authService.checkRateLimit(key);
  };

  const clearRateLimit = (key: string) => {
    authService.clearRateLimit(key);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        verifyOTP,
        resendOTP,
        requestPasswordReset,
        resetPassword,
        checkRateLimit,
        clearRateLimit,
        logout,
        refreshSession,
      }}
    >
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
