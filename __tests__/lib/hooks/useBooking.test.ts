import { renderHook, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createBooking, cancelBooking } from '@/lib/api/bookings';
import { useCreateBooking, useCancelBooking } from '@/lib/hooks/useBooking';
import type { Booking } from '@/lib/types/database';

jest.mock('@/lib/api/bookings', () => ({
  createBooking: jest.fn(),
  cancelBooking: jest.fn(),
}));

const mockCreateBooking = createBooking as jest.MockedFunction<typeof createBooking>;
const mockCancelBooking = cancelBooking as jest.MockedFunction<typeof cancelBooking>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

/**
 * Creates a wrapper whose QueryClient is returned alongside the wrapper
 * so we can spy on invalidateQueries.
 */
function createWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
  return { wrapper, queryClient };
}

const mockBooking: Booking = {
  id: 'booking-1',
  session_id: 'session-42',
  user_id: 'user-1',
  status: 'confirmed',
  reserved_at: '2025-06-01T10:00:00Z',
  confirmed_at: '2025-06-01T10:01:00Z',
  cancelled_at: null,
  guests: 2,
};

describe('useCreateBooking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls createBooking with sessionId and guests on mutate', async () => {
    mockCreateBooking.mockResolvedValue(mockBooking);

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ sessionId: 'session-42', guests: 2 });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockCreateBooking).toHaveBeenCalledWith('session-42', 2);
  });

  it('calls createBooking without guests when guests is omitted', async () => {
    mockCreateBooking.mockResolvedValue({ ...mockBooking, guests: 0 });

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ sessionId: 'session-42' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockCreateBooking).toHaveBeenCalledWith('session-42', undefined);
  });

  it('returns the booking data on success', async () => {
    mockCreateBooking.mockResolvedValue(mockBooking);

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ sessionId: 'session-42', guests: 2 });
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toEqual(mockBooking);
  });

  it('invalidates bookings, session, and feed queries on success', async () => {
    mockCreateBooking.mockResolvedValue(mockBooking);

    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateBooking(), { wrapper });

    await act(async () => {
      result.current.mutate({ sessionId: 'session-42', guests: 2 });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['session', 'session-42'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['feed'] });
  });

  it('enters error state when createBooking rejects', async () => {
    mockCreateBooking.mockRejectedValue(new Error('Session full'));

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate({ sessionId: 'session-42', guests: 1 });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('Session full');
  });

  it('does not invalidate queries on error', async () => {
    mockCreateBooking.mockRejectedValue(new Error('fail'));

    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateBooking(), { wrapper });

    await act(async () => {
      result.current.mutate({ sessionId: 'session-42' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('is idle before mutate is called', () => {
    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isIdle).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('supports mutateAsync for promise-based usage', async () => {
    mockCreateBooking.mockResolvedValue(mockBooking);

    const { result } = renderHook(() => useCreateBooking(), {
      wrapper: createWrapper(),
    });

    let returnedBooking: Booking | undefined;
    await act(async () => {
      returnedBooking = await result.current.mutateAsync({
        sessionId: 'session-42',
        guests: 3,
      });
    });

    expect(returnedBooking).toEqual(mockBooking);
  });
});

describe('useCancelBooking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const cancelledBooking: Booking = {
    ...mockBooking,
    status: 'cancelled',
    cancelled_at: '2025-06-02T08:00:00Z',
  };

  it('calls cancelBooking with the bookingId on mutate', async () => {
    mockCancelBooking.mockResolvedValue(cancelledBooking);

    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('booking-1');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockCancelBooking).toHaveBeenCalledWith('booking-1');
  });

  it('returns the cancelled booking data on success', async () => {
    mockCancelBooking.mockResolvedValue(cancelledBooking);

    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('booking-1');
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toEqual(cancelledBooking);
    expect(result.current.data!.status).toBe('cancelled');
  });

  it('invalidates bookings, booking, session, and feed queries on success', async () => {
    mockCancelBooking.mockResolvedValue(cancelledBooking);

    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCancelBooking(), { wrapper });

    await act(async () => {
      result.current.mutate('booking-1');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should invalidate all four query keys
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['booking', 'booking-1'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['session', 'session-42'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['feed'] });
  });

  it('enters error state when cancelBooking rejects', async () => {
    mockCancelBooking.mockRejectedValue(new Error('Already cancelled'));

    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.mutate('booking-1');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error!.message).toBe('Already cancelled');
  });

  it('does not invalidate queries on error', async () => {
    mockCancelBooking.mockRejectedValue(new Error('fail'));

    const { wrapper, queryClient } = createWrapperWithClient();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCancelBooking(), { wrapper });

    await act(async () => {
      result.current.mutate('booking-1');
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('is idle before mutate is called', () => {
    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isIdle).toBe(true);
  });

  it('supports mutateAsync for promise-based usage', async () => {
    mockCancelBooking.mockResolvedValue(cancelledBooking);

    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createWrapper(),
    });

    let returnedBooking: Booking | undefined;
    await act(async () => {
      returnedBooking = await result.current.mutateAsync('booking-1');
    });

    expect(returnedBooking).toEqual(cancelledBooking);
  });

  it('can be called multiple times (resets between mutations)', async () => {
    const booking2: Booking = {
      ...cancelledBooking,
      id: 'booking-2',
      session_id: 'session-99',
    };

    mockCancelBooking
      .mockResolvedValueOnce(cancelledBooking)
      .mockResolvedValueOnce(booking2);

    const { result } = renderHook(() => useCancelBooking(), {
      wrapper: createWrapper(),
    });

    // First mutation
    await act(async () => {
      result.current.mutate('booking-1');
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data!.id).toBe('booking-1');

    // Second mutation
    await act(async () => {
      result.current.mutate('booking-2');
    });

    await waitFor(() => {
      expect(result.current.data!.id).toBe('booking-2');
    });

    expect(mockCancelBooking).toHaveBeenCalledTimes(2);
  });
});
