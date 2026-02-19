import { supabase } from '@/lib/supabase';
import type { Booking } from '@/lib/types/database';

/**
 * Create a booking for a session via edge function.
 * The edge function handles capacity checks, pricing, and payment intent creation.
 */
export async function createBooking(
  sessionId: string,
  guests: number = 0
): Promise<Booking> {
  const { data, error } = await supabase.functions.invoke('create-booking', {
    body: { session_id: sessionId, guests },
  });

  if (error) throw new Error(error.message);
  return data as Booking;
}

/**
 * Cancel an existing booking via edge function.
 * Handles refund logic and freeing capacity.
 */
export async function cancelBooking(bookingId: string): Promise<Booking> {
  const { data, error } = await supabase.functions.invoke('cancel-booking', {
    body: { booking_id: bookingId },
  });

  if (error) throw new Error(error.message);
  return data as Booking;
}

/**
 * Get all bookings for the current authenticated user.
 */
export async function getMyBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      session:sessions (
        *,
        product:products (*),
        court:courts (*)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Booking[];
}

/**
 * Get a single booking by ID with full session details.
 */
export async function getBookingById(id: string): Promise<Booking> {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      session:sessions (
        *,
        product:products (*),
        court:courts (*)
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as Booking;
}
