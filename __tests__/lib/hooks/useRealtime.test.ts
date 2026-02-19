import { renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/hooks/useRealtime';

// Cast supabase mocks for type-safe assertions
const mockChannel = supabase.channel as jest.Mock;
const mockRemoveChannel = supabase.removeChannel as jest.Mock;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
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

function createWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
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

describe('useRealtime', () => {
  // Hold a reference to the mocked channel object returned by supabase.channel()
  let mockChannelObj: { on: jest.Mock; subscribe: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the mock channel with chainable methods
    mockChannelObj = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    };
    mockChannel.mockReturnValue(mockChannelObj);
  });

  // -------------------------------------------------------------------
  // Channel creation
  // -------------------------------------------------------------------
  describe('channel creation', () => {
    it('creates a Supabase channel when enabled (default)', () => {
      renderHook(
        () => useRealtime({ table: 'bookings' }),
        { wrapper: createWrapper() }
      );

      expect(mockChannel).toHaveBeenCalledTimes(1);
      expect(mockChannel).toHaveBeenCalledWith('realtime:bookings');
    });

    it('includes the filter in the channel name when provided', () => {
      renderHook(
        () =>
          useRealtime({
            table: 'bookings',
            filter: 'user_id=eq.user-1',
          }),
        { wrapper: createWrapper() }
      );

      expect(mockChannel).toHaveBeenCalledWith(
        'realtime:bookings:user_id=eq.user-1'
      );
    });

    it('does NOT create a channel when enabled is false', () => {
      renderHook(
        () => useRealtime({ table: 'bookings', enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(mockChannel).not.toHaveBeenCalled();
    });

    it('subscribes to postgres_changes with the correct config', () => {
      renderHook(
        () =>
          useRealtime({
            table: 'sessions',
            event: 'UPDATE',
          }),
        { wrapper: createWrapper() }
      );

      expect(mockChannelObj.on).toHaveBeenCalledTimes(1);
      expect(mockChannelObj.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
        },
        expect.any(Function)
      );
    });

    it('includes filter in the channel config when provided', () => {
      renderHook(
        () =>
          useRealtime({
            table: 'bookings',
            filter: 'user_id=eq.user-1',
            event: 'INSERT',
          }),
        { wrapper: createWrapper() }
      );

      expect(mockChannelObj.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: 'user_id=eq.user-1',
        },
        expect.any(Function)
      );
    });

    it('defaults event to "*" when not specified', () => {
      renderHook(
        () => useRealtime({ table: 'orders' }),
        { wrapper: createWrapper() }
      );

      expect(mockChannelObj.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ event: '*' }),
        expect.any(Function)
      );
    });

    it('calls subscribe on the channel', () => {
      renderHook(
        () => useRealtime({ table: 'bookings' }),
        { wrapper: createWrapper() }
      );

      expect(mockChannelObj.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------
  describe('cleanup', () => {
    it('removes the channel on unmount', () => {
      const { unmount } = renderHook(
        () => useRealtime({ table: 'bookings' }),
        { wrapper: createWrapper() }
      );

      expect(mockRemoveChannel).not.toHaveBeenCalled();

      unmount();

      expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
      // The channel object returned by subscribe (chainable) is passed to removeChannel
      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannelObj);
    });

    it('does not call removeChannel on unmount when disabled', () => {
      const { unmount } = renderHook(
        () => useRealtime({ table: 'bookings', enabled: false }),
        { wrapper: createWrapper() }
      );

      unmount();

      expect(mockRemoveChannel).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // Callback behavior
  // -------------------------------------------------------------------
  describe('callback handling', () => {
    it('calls the provided callback when a change event fires', () => {
      const callback = jest.fn();

      renderHook(
        () =>
          useRealtime({
            table: 'bookings',
            callback,
          }),
        { wrapper: createWrapper() }
      );

      // Extract the handler that was passed to .on()
      const handler = mockChannelObj.on.mock.calls[0][2];

      const payload = {
        eventType: 'INSERT',
        new: { id: 'booking-new' },
        old: {},
      };

      handler(payload);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(payload);
    });

    it('invalidates provided queryKeys when no callback is given', () => {
      const { queryClient } = createWrapperWithClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(
          QueryClientProvider,
          { client: queryClient },
          children
        );
      };

      renderHook(
        () =>
          useRealtime({
            table: 'bookings',
            queryKeys: [['bookings'], ['feed']],
          }),
        { wrapper }
      );

      // Fire the handler
      const handler = mockChannelObj.on.mock.calls[0][2];
      handler({ eventType: 'INSERT', new: {}, old: {} });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['feed'] });
    });

    it('invalidates the table name as default when neither callback nor queryKeys are provided', () => {
      const { queryClient } = createWrapperWithClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(
          QueryClientProvider,
          { client: queryClient },
          children
        );
      };

      renderHook(
        () => useRealtime({ table: 'sessions' }),
        { wrapper }
      );

      const handler = mockChannelObj.on.mock.calls[0][2];
      handler({ eventType: 'UPDATE', new: {}, old: {} });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sessions'] });
    });

    it('does not invalidate queries when a callback is provided', () => {
      const { queryClient } = createWrapperWithClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');
      const callback = jest.fn();

      const wrapper = function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(
          QueryClientProvider,
          { client: queryClient },
          children
        );
      };

      renderHook(
        () =>
          useRealtime({
            table: 'bookings',
            callback,
            queryKeys: [['bookings']],
          }),
        { wrapper }
      );

      const handler = mockChannelObj.on.mock.calls[0][2];
      handler({ eventType: 'INSERT', new: {}, old: {} });

      // Callback takes precedence; queryKeys should NOT be invalidated
      expect(callback).toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('does not invalidate when queryKeys is an empty array', () => {
      const { queryClient } = createWrapperWithClient();
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const wrapper = function Wrapper({ children }: { children: React.ReactNode }) {
        return React.createElement(
          QueryClientProvider,
          { client: queryClient },
          children
        );
      };

      renderHook(
        () =>
          useRealtime({
            table: 'bookings',
            queryKeys: [],
          }),
        { wrapper }
      );

      const handler = mockChannelObj.on.mock.calls[0][2];
      handler({ eventType: 'DELETE', new: {}, old: {} });

      // Empty queryKeys should fall through to the default (table name)
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
    });
  });

  // -------------------------------------------------------------------
  // Re-subscription on dependency changes
  // -------------------------------------------------------------------
  describe('re-subscription', () => {
    it('re-creates the channel when the table changes', () => {
      const { rerender } = renderHook(
        ({ table }: { table: string }) =>
          useRealtime({ table }),
        {
          wrapper: createWrapper(),
          initialProps: { table: 'bookings' },
        }
      );

      expect(mockChannel).toHaveBeenCalledTimes(1);
      expect(mockChannel).toHaveBeenLastCalledWith('realtime:bookings');

      rerender({ table: 'sessions' });

      // Old channel removed, new one created
      expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
      expect(mockChannel).toHaveBeenCalledTimes(2);
      expect(mockChannel).toHaveBeenLastCalledWith('realtime:sessions');
    });

    it('re-creates the channel when enabled switches from false to true', () => {
      const { rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          useRealtime({ table: 'bookings', enabled }),
        {
          wrapper: createWrapper(),
          initialProps: { enabled: false },
        }
      );

      expect(mockChannel).not.toHaveBeenCalled();

      rerender({ enabled: true });

      expect(mockChannel).toHaveBeenCalledTimes(1);
      expect(mockChannel).toHaveBeenCalledWith('realtime:bookings');
    });

    it('removes the channel when enabled switches from true to false', () => {
      const { rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          useRealtime({ table: 'bookings', enabled }),
        {
          wrapper: createWrapper(),
          initialProps: { enabled: true },
        }
      );

      expect(mockChannel).toHaveBeenCalledTimes(1);

      rerender({ enabled: false });

      expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles DELETE event type', () => {
      renderHook(
        () =>
          useRealtime({
            table: 'bookings',
            event: 'DELETE',
          }),
        { wrapper: createWrapper() }
      );

      expect(mockChannelObj.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({ event: 'DELETE' }),
        expect.any(Function)
      );
    });

    it('handles INSERT event type', () => {
      renderHook(
        () =>
          useRealtime({
            table: 'notifications',
            event: 'INSERT',
          }),
        { wrapper: createWrapper() }
      );

      expect(mockChannelObj.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          table: 'notifications',
        }),
        expect.any(Function)
      );
    });

    it('creates a channel name without trailing colon when filter is undefined', () => {
      renderHook(
        () =>
          useRealtime({
            table: 'bookings',
            filter: undefined,
          }),
        { wrapper: createWrapper() }
      );

      expect(mockChannel).toHaveBeenCalledWith('realtime:bookings');
    });
  });
});
