import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ requiresConfirmation: boolean }>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_STORAGE_KEY = 'cs_demo_user';

// Isolated development-only mock adapter
const isDevMockEnabled = import.meta.env.DEV && localStorage.getItem('cs_dev_mock') === 'true';

function makeDemoUser(email: string): AuthUser {
  return {
    id: 'demo-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36),
    email,
    createdAt: new Date().toISOString(),
  };
}

// Map raw Supabase errors to human-readable strings
function mapAuthError(error: any): Error {
  const msg = error?.message || '';
  const status = error?.status || 0;

  if (status === 429 || msg.includes('Too many requests') || msg.includes('rate limit')) {
    return new Error('Too many attempts. Please try again later.');
  }
  if (msg.includes('Invalid login credentials')) {
    return new Error('Incorrect email or password. Please try again.');
  }
  if (msg.includes('Email not confirmed')) {
    return new Error('Please verify your email before signing in.');
  }
  if (msg.includes('User already registered')) {
    return new Error('An account with this email already exists.');
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return new Error('Unable to connect. Please check your connection and try again.');
  }
  return new Error(msg || 'Something went wrong. Please try again.');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    // Isolated dev mock check
    if (isDevMockEnabled) {
      const demoStr = localStorage.getItem(DEMO_STORAGE_KEY);
      if (demoStr) {
        try {
          setUser(JSON.parse(demoStr));
          setIsDemo(true);
        } catch {
          localStorage.removeItem(DEMO_STORAGE_KEY);
        }
      }
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Real Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email!, createdAt: session.user.created_at });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email!, createdAt: session.user.created_at });
        setIsDemo(false);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (isDevMockEnabled || !isSupabaseConfigured) {
      await new Promise(r => setTimeout(r, 600));
      if (password === 'fail') throw new Error('Incorrect email or password. Please try again.');
      const u = makeDemoUser(email);
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(u));
      setUser(u);
      setIsDemo(true);
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw mapAuthError(error);
    if (data.user) setUser({ id: data.user.id, email: data.user.email!, createdAt: data.user.created_at });
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (isDevMockEnabled || !isSupabaseConfigured) {
      await new Promise(r => setTimeout(r, 800));
      if (password === 'fail') throw new Error('An account with this email already exists.');
      // Simulate requiring email confirmation in dev mock if email contains "confirm"
      if (email.includes('confirm')) return { requiresConfirmation: true };
      
      const u = makeDemoUser(email);
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(u));
      setUser(u);
      setIsDemo(true);
      return { requiresConfirmation: false };
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw mapAuthError(error);
    
    // If we have a user but identities is empty, it might mean user already exists but isn't confirmed, 
    // or if session is null it means confirmation is required.
    const requiresConfirmation = !data.session;
    
    if (data.user && !requiresConfirmation) {
      setUser({ id: data.user.id, email: data.user.email!, createdAt: data.user.created_at });
    }
    return { requiresConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    if (isDevMockEnabled || !isSupabaseConfigured) {
      localStorage.removeItem(DEMO_STORAGE_KEY);
    } else {
      await supabase.auth.signOut().catch(() => {});
    }
    setUser(null);
    setIsDemo(false);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    if (isDevMockEnabled || !isSupabaseConfigured) {
      await new Promise(r => setTimeout(r, 600));
      return; 
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw mapAuthError(error);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (isDevMockEnabled || !isSupabaseConfigured) {
      await new Promise(r => setTimeout(r, 600));
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw mapAuthError(error);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isDemo, signIn, signUp, signOut, forgotPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
