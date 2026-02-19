import { renderHook, act, waitFor } from '@testing-library/react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/stores/authStore';
import { useAuth } from '@/lib/hooks/useAuth';

// Cast the mocked supabase auth methods for type-safe assertions
const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;
const mockSignInWithPassword = supabase.auth.signInWithPassword as jest.Mock;
const mockSignUp = supabase.auth.signUp as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;
const mockResetPasswordForEmail = supabase.auth.resetPasswordForEmail as jest.Mock;

describe('useAuth', () => {
  const mockUnsubscribe = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the auth store to its initial state before each test
    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: true,
    });

    // Default mock implementations
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });

  // -------------------------------------------------------------------
  // Initialization and listener setup
  // -------------------------------------------------------------------
  describe('initialization', () => {
    it('calls supabase.auth.getSession on mount', () => {
      renderHook(() => useAuth());

      expect(mockGetSession).toHaveBeenCalledTimes(1);
    });

    it('sets up an onAuthStateChange listener on mount', () => {
      renderHook(() => useAuth());

      expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
      expect(mockOnAuthStateChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it('sets the session from getSession and stops loading', async () => {
      const fakeSession = {
        access_token: 'token-abc',
        user: { id: 'user-1', email: 'a@b.com' },
      };
      mockGetSession.mockResolvedValue({ data: { session: fakeSession } });

      renderHook(() => useAuth());

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.session).toEqual(fakeSession);
        expect(state.user).toEqual(fakeSession.user);
        expect(state.isLoading).toBe(false);
      });
    });

    it('sets session to null and stops loading when no session exists', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } });

      renderHook(() => useAuth());

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.session).toBeNull();
        expect(state.user).toBeNull();
        expect(state.isLoading).toBe(false);
      });
    });

    it('updates the store when onAuthStateChange fires', async () => {
      let authChangeCallback: Function;
      mockOnAuthStateChange.mockImplementation((cb: Function) => {
        authChangeCallback = cb;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      renderHook(() => useAuth());

      const newSession = {
        access_token: 'token-xyz',
        user: { id: 'user-2', email: 'c@d.com' },
      };

      act(() => {
        authChangeCallback('SIGNED_IN', newSession);
      });

      await waitFor(() => {
        const state = useAuthStore.getState();
        expect(state.session).toEqual(newSession);
        expect(state.user).toEqual(newSession.user);
      });
    });
  });

  // -------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------
  describe('cleanup', () => {
    it('unsubscribes from auth state changes on unmount', () => {
      const { unmount } = renderHook(() => useAuth());

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------
  // signIn
  // -------------------------------------------------------------------
  describe('signIn', () => {
    it('calls signInWithPassword with the correct email and password', async () => {
      mockSignInWithPassword.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn('test@example.com', 'secret123');
      });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'secret123',
      });
    });

    it('sets loading to true before the call and false after', async () => {
      const loadingStates: boolean[] = [];

      mockSignInWithPassword.mockImplementation(async () => {
        loadingStates.push(useAuthStore.getState().isLoading);
        return { error: null };
      });

      const { result } = renderHook(() => useAuth());

      // Wait for the initial getSession to set loading to false
      await waitFor(() => {
        expect(useAuthStore.getState().isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn('a@b.com', 'pass');
      });

      // During the call, isLoading should have been true
      expect(loadingStates[0]).toBe(true);
      // After the call, isLoading should be false again
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('throws the error returned by supabase', async () => {
      const authError = new Error('Invalid credentials');
      mockSignInWithPassword.mockResolvedValue({ error: authError });

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn('bad@email.com', 'wrong');
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('sets loading back to false even when an error is thrown', async () => {
      mockSignInWithPassword.mockResolvedValue({
        error: new Error('fail'),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(useAuthStore.getState().isLoading).toBe(false);
      });

      try {
        await act(async () => {
          await result.current.signIn('a@b.com', 'bad');
        });
      } catch {
        // expected
      }

      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  // -------------------------------------------------------------------
  // signUp
  // -------------------------------------------------------------------
  describe('signUp', () => {
    it('calls supabase.auth.signUp with email, password, and full name', async () => {
      mockSignUp.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp('new@user.com', 'pass123', 'Jane Doe');
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@user.com',
        password: 'pass123',
        options: {
          data: { full_name: 'Jane Doe' },
        },
      });
    });

    it('merges additional metadata into the options.data', async () => {
      mockSignUp.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp('new@user.com', 'pass123', 'Jane Doe', {
          skill_level: 'beginner',
          phone: '+1234567890',
        });
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@user.com',
        password: 'pass123',
        options: {
          data: {
            full_name: 'Jane Doe',
            skill_level: 'beginner',
            phone: '+1234567890',
          },
        },
      });
    });

    it('works without fullName or metadata (both undefined)', async () => {
      mockSignUp.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp('min@user.com', 'pass');
      });

      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'min@user.com',
        password: 'pass',
        options: {
          data: { full_name: undefined },
        },
      });
    });

    it('sets loading to true during the request', async () => {
      const loadingStates: boolean[] = [];

      mockSignUp.mockImplementation(async () => {
        loadingStates.push(useAuthStore.getState().isLoading);
        return { error: null };
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(useAuthStore.getState().isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.signUp('a@b.com', 'pass');
      });

      expect(loadingStates[0]).toBe(true);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('throws the error returned by supabase', async () => {
      const signUpError = new Error('Email already registered');
      mockSignUp.mockResolvedValue({ error: signUpError });

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signUp('dup@user.com', 'pass');
        })
      ).rejects.toThrow('Email already registered');
    });
  });

  // -------------------------------------------------------------------
  // signOut
  // -------------------------------------------------------------------
  describe('signOut', () => {
    it('calls supabase.auth.signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('clears the auth store on success', async () => {
      mockSignOut.mockResolvedValue({ error: null });

      // Set up a non-null session so we can verify it gets cleared
      useAuthStore.setState({
        user: { id: 'user-1' } as any,
        session: { access_token: 'abc' } as any,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signOut();
      });

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.session).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it('throws the error returned by supabase and does NOT clear the store', async () => {
      const signOutError = new Error('Network error');
      mockSignOut.mockResolvedValue({ error: signOutError });

      const fakeSession = { access_token: 'abc', user: { id: 'user-1' } };

      // Make getSession return the same session so the useEffect does not
      // overwrite our manually-set state with null.
      mockGetSession.mockResolvedValue({ data: { session: fakeSession } });

      useAuthStore.setState({
        user: fakeSession.user as any,
        session: fakeSession as any,
        isLoading: false,
      });

      const { result } = renderHook(() => useAuth());

      // Wait for the initial getSession to settle
      await waitFor(() => {
        expect(useAuthStore.getState().session).not.toBeNull();
      });

      await expect(
        act(async () => {
          await result.current.signOut();
        })
      ).rejects.toThrow('Network error');

      // The store should NOT have been cleared because the error was thrown
      // before clear() was called
      const state = useAuthStore.getState();
      expect(state.session).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------
  // resetPassword
  // -------------------------------------------------------------------
  describe('resetPassword', () => {
    it('calls resetPasswordForEmail with the correct email', async () => {
      mockResetPasswordForEmail.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.resetPassword('forgot@example.com');
      });

      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'forgot@example.com'
      );
    });

    it('throws the error returned by supabase', async () => {
      const resetError = new Error('Rate limit exceeded');
      mockResetPasswordForEmail.mockResolvedValue({ error: resetError });

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.resetPassword('forgot@example.com');
        })
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  // -------------------------------------------------------------------
  // Return values
  // -------------------------------------------------------------------
  describe('returned values', () => {
    it('returns user, session, isLoading, and action functions', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('session');
      expect(result.current).toHaveProperty('isLoading');
      expect(typeof result.current.signIn).toBe('function');
      expect(typeof result.current.signUp).toBe('function');
      expect(typeof result.current.signOut).toBe('function');
      expect(typeof result.current.resetPassword).toBe('function');
    });

    it('reflects the current store state', async () => {
      const fakeSession = {
        access_token: 'tok',
        user: { id: 'u1', email: 'test@test.com' },
      };
      mockGetSession.mockResolvedValue({ data: { session: fakeSession } });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.session).toEqual(fakeSession);
        expect(result.current.user).toEqual(fakeSession.user);
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
