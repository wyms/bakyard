import { supabase } from '@/lib/supabase';
import { createBooking, cancelBooking, getMyBookings, getBookingById } from '@/lib/api/bookings';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('bookings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------
  // createBooking
  // ---------------------------------------------------------------
  describe('createBooking', () => {
    it('invokes the create-booking edge function with session ID and guests', async () => {
      const mockBooking = {
        id: 'booking-1',
        session_id: 'session-1',
        user_id: 'user-1',
        status: 'reserved',
        guests: 2,
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockBooking,
        error: null,
      });

      const result = await createBooking('session-1', 2);

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('create-booking', {
        body: { session_id: 'session-1', guests: 2 },
      });
      expect(result).toEqual(mockBooking);
    });

    it('defaults guests to 0 when not provided', async () => {
      const mockBooking = {
        id: 'booking-2',
        session_id: 'session-1',
        user_id: 'user-1',
        status: 'reserved',
        guests: 0,
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockBooking,
        error: null,
      });

      await createBooking('session-1');

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('create-booking', {
        body: { session_id: 'session-1', guests: 0 },
      });
    });

    it('throws an error when the edge function fails', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Session is full' },
      });

      await expect(createBooking('session-1')).rejects.toThrow('Session is full');
    });
  });

  // ---------------------------------------------------------------
  // cancelBooking
  // ---------------------------------------------------------------
  describe('cancelBooking', () => {
    it('invokes the cancel-booking edge function with the booking ID', async () => {
      const mockCancelled = {
        id: 'booking-1',
        status: 'cancelled',
        cancelled_at: '2026-02-17T12:00:00Z',
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockCancelled,
        error: null,
      });

      const result = await cancelBooking('booking-1');

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('cancel-booking', {
        body: { booking_id: 'booking-1' },
      });
      expect(result).toEqual(mockCancelled);
    });

    it('throws an error when cancellation fails', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Booking not found' },
      });

      await expect(cancelBooking('invalid-id')).rejects.toThrow('Booking not found');
    });
  });

  // ---------------------------------------------------------------
  // getMyBookings
  // ---------------------------------------------------------------
  describe('getMyBookings', () => {
    it('returns the list of bookings for the current user', async () => {
      const mockBookings = [
        { id: 'booking-1', status: 'confirmed', session: { id: 'sess-1' } },
        { id: 'booking-2', status: 'reserved', session: { id: 'sess-2' } },
      ];

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValueOnce({ data: mockBookings, error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      const result = await getMyBookings();

      expect(mockSupabase.from).toHaveBeenCalledWith('bookings');
      expect(mockChain.select).toHaveBeenCalledWith(expect.stringContaining('session:sessions'));
      expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(mockBookings);
    });

    it('returns an empty array when no bookings exist', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValueOnce({ data: null, error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      const result = await getMyBookings();
      expect(result).toEqual([]);
    });

    it('throws an error on database failure', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Permission denied' },
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      await expect(getMyBookings()).rejects.toThrow('Permission denied');
    });
  });

  // ---------------------------------------------------------------
  // getBookingById
  // ---------------------------------------------------------------
  describe('getBookingById', () => {
    it('returns a single booking by ID with session details', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: 'confirmed',
        session: {
          id: 'sess-1',
          product: { id: 'prod-1', title: 'Open Play' },
          court: { id: 'court-1', name: 'Court A' },
        },
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({ data: mockBooking, error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      const result = await getBookingById('booking-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('bookings');
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'booking-1');
      expect(mockChain.single).toHaveBeenCalled();
      expect(result).toEqual(mockBooking);
    });

    it('throws an error when the booking is not found', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Row not found' },
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      await expect(getBookingById('non-existent')).rejects.toThrow('Row not found');
    });

    it('queries with the correct select statement including nested relations', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({ data: { id: 'booking-1' }, error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      await getBookingById('booking-1');

      const selectArg = mockChain.select.mock.calls[0][0];
      expect(selectArg).toContain('session:sessions');
      expect(selectArg).toContain('product:products');
      expect(selectArg).toContain('court:courts');
    });
  });
});
