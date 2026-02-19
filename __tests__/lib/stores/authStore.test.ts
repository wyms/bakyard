import { useAuthStore } from '@/lib/stores/authStore';
import type { User, Session } from '@supabase/supabase-js';

// Minimal mock user object matching the Supabase User type shape
const mockUser: User = {
  id: 'user-123',
  email: 'test@bakyard.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00.000Z',
} as User;

const mockUser2: User = {
  id: 'user-456',
  email: 'other@bakyard.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-15T00:00:00.000Z',
} as User;

// Minimal mock session
const mockSession: Session = {
  access_token: 'access-token-abc',
  refresh_token: 'refresh-token-abc',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 1700000000,
  user: mockUser,
} as Session;

// Reset the store before each test
beforeEach(() => {
  useAuthStore.setState({
    user: null,
    session: null,
    isLoading: true,
  });
});

describe('authStore', () => {
  // ---------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------
  describe('initial state', () => {
    it('has null user', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('has null session', () => {
      expect(useAuthStore.getState().session).toBeNull();
    });

    it('has isLoading set to true', () => {
      expect(useAuthStore.getState().isLoading).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // setUser
  // ---------------------------------------------------------------
  describe('setUser', () => {
    it('sets the user', () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });

    it('clears the user when set to null', () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().setUser(null);
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('overwrites a previously set user', () => {
      useAuthStore.getState().setUser(mockUser);
      useAuthStore.getState().setUser(mockUser2);
      expect(useAuthStore.getState().user).toEqual(mockUser2);
    });
  });

  // ---------------------------------------------------------------
  // setSession
  // ---------------------------------------------------------------
  describe('setSession', () => {
    it('sets the session and extracts the user from it', () => {
      useAuthStore.getState().setSession(mockSession);

      const state = useAuthStore.getState();
      expect(state.session).toEqual(mockSession);
      expect(state.user).toEqual(mockUser);
    });

    it('clears session and user when set to null', () => {
      useAuthStore.getState().setSession(mockSession);
      useAuthStore.getState().setSession(null);

      const state = useAuthStore.getState();
      expect(state.session).toBeNull();
      expect(state.user).toBeNull();
    });

    it('updates the user when session changes', () => {
      useAuthStore.getState().setSession(mockSession);
      expect(useAuthStore.getState().user?.id).toBe('user-123');

      const newSession: Session = {
        ...mockSession,
        access_token: 'new-token',
        user: mockUser2,
      };
      useAuthStore.getState().setSession(newSession);
      expect(useAuthStore.getState().user?.id).toBe('user-456');
    });
  });

  // ---------------------------------------------------------------
  // setLoading
  // ---------------------------------------------------------------
  describe('setLoading', () => {
    it('sets isLoading to false', () => {
      useAuthStore.getState().setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('sets isLoading back to true', () => {
      useAuthStore.getState().setLoading(false);
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // clear
  // ---------------------------------------------------------------
  describe('clear', () => {
    it('resets user, session, and sets isLoading to false', () => {
      // Set some state first
      useAuthStore.getState().setSession(mockSession);
      useAuthStore.getState().setLoading(true);

      // Clear
      useAuthStore.getState().clear();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('sets isLoading to false even if it was already false', () => {
      useAuthStore.getState().setLoading(false);
      useAuthStore.getState().clear();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });
});
