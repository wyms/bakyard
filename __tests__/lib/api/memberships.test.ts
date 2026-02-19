import { supabase } from '@/lib/supabase';
import { getMyMembership, getMembershipTiers, cancelMembership } from '@/lib/api/memberships';
import { MEMBERSHIP_TIERS } from '@/lib/utils/constants';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('memberships API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------
  // getMyMembership
  // ---------------------------------------------------------------
  describe('getMyMembership', () => {
    it('returns the active membership when one exists', async () => {
      const mockMembership = {
        id: 'mem-1',
        user_id: 'user-1',
        tier: 'sand_regular',
        status: 'active',
        discount_percent: 20,
        priority_booking_hours: 24,
        guest_passes_remaining: 1,
        current_period_start: '2026-02-01T00:00:00Z',
        current_period_end: '2026-03-01T00:00:00Z',
        created_at: '2026-01-15T00:00:00Z',
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({ data: mockMembership, error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      const result = await getMyMembership();

      expect(mockSupabase.from).toHaveBeenCalledWith('memberships');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.in).toHaveBeenCalledWith('status', ['active']);
      expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockChain.limit).toHaveBeenCalledWith(1);
      expect(mockChain.maybeSingle).toHaveBeenCalled();
      expect(result).toEqual(mockMembership);
    });

    it('returns null when the user has no active membership', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({ data: null, error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      const result = await getMyMembership();
      expect(result).toBeNull();
    });

    it('throws an error on database failure', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' },
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      await expect(getMyMembership()).rejects.toThrow('Database error');
    });
  });

  // ---------------------------------------------------------------
  // getMembershipTiers
  // ---------------------------------------------------------------
  describe('getMembershipTiers', () => {
    it('returns the static membership tier configurations', () => {
      const tiers = getMembershipTiers();
      expect(tiers).toEqual(MEMBERSHIP_TIERS);
    });

    it('returns an array of 3 tiers', () => {
      const tiers = getMembershipTiers();
      expect(tiers).toHaveLength(3);
    });

    it('returns tiers with the expected tier identifiers', () => {
      const tiers = getMembershipTiers();
      const tierIds = tiers.map((t) => t.tier);
      expect(tierIds).toEqual(['local_player', 'sand_regular', 'founders']);
    });

    it('returns a reference to the same MEMBERSHIP_TIERS constant', () => {
      const tiers = getMembershipTiers();
      expect(tiers).toBe(MEMBERSHIP_TIERS);
    });
  });

  // ---------------------------------------------------------------
  // cancelMembership
  // ---------------------------------------------------------------
  describe('cancelMembership', () => {
    it('invokes the cancel-membership edge function', async () => {
      const mockCancelled = {
        id: 'mem-1',
        tier: 'sand_regular',
        status: 'cancelled',
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockCancelled,
        error: null,
      });

      const result = await cancelMembership();

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('cancel-membership', {});
      expect(result).toEqual(mockCancelled);
    });

    it('throws an error when cancellation fails', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'No active membership to cancel' },
      });

      await expect(cancelMembership()).rejects.toThrow('No active membership to cancel');
    });

    it('invokes the correct edge function name', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { id: 'mem-1', status: 'cancelled' },
        error: null,
      });

      await cancelMembership();

      const calledFunctionName = (mockSupabase.functions.invoke as jest.Mock).mock.calls[0][0];
      expect(calledFunctionName).toBe('cancel-membership');
    });
  });
});
