import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/stores/authStore';

/**
 * Authentication hook that wraps authStore + supabase.auth.
 *
 * Listens to onAuthStateChange and syncs state to the Zustand store.
 * Returns the current auth state plus action methods.
 */
export function useAuth() {
  const { user, session, isLoading, setSession, setLoading, clear } =
    useAuthStore();

  useEffect(() => {
    // Fetch the initial session on mount
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setSession, setLoading]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (error) throw error;
    },
    [setLoading]
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName?: string,
      metadata?: Record<string, unknown>
    ) => {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, ...metadata },
        },
      });
      setLoading(false);
      if (error) throw error;
    },
    [setLoading]
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    clear();
  }, [clear]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }, []);

  return {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}
