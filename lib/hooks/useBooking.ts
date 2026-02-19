import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBooking, cancelBooking } from '@/lib/api/bookings';
import type { Booking } from '@/lib/types/database';

/**
 * Mutation hook for creating a booking.
 * Invalidates bookings list and the relevant session queries on success.
 */
export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation<
    Booking,
    Error,
    { sessionId: string; guests?: number }
  >({
    mutationFn: ({ sessionId, guests }) => createBooking(sessionId, guests),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['session', data.session_id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}

/**
 * Mutation hook for cancelling a booking.
 * Invalidates bookings list and the relevant session queries on success.
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation<Booking, Error, string>({
    mutationFn: (bookingId) => cancelBooking(bookingId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({
        queryKey: ['booking', data.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['session', data.session_id],
      });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });
}
