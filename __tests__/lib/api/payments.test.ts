import { supabase } from '@/lib/supabase';
import { createCheckout, createSubscription } from '@/lib/api/payments';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('payments API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------
  // createCheckout
  // ---------------------------------------------------------------
  describe('createCheckout', () => {
    it('invokes the create-checkout edge function and returns checkout data', async () => {
      const mockCheckout = {
        payment_intent_id: 'pi_abc123',
        client_secret: 'pi_abc123_secret_xyz',
        amount_cents: 2500,
        discount_cents: 0,
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockCheckout,
        error: null,
      });

      const result = await createCheckout('session-1');

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('create-checkout', {
        body: { session_id: 'session-1', membership_id: null },
      });
      expect(result).toEqual(mockCheckout);
    });

    it('passes membership_id when provided', async () => {
      const mockCheckout = {
        payment_intent_id: 'pi_abc123',
        client_secret: 'pi_abc123_secret_xyz',
        amount_cents: 2000,
        discount_cents: 500,
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockCheckout,
        error: null,
      });

      const result = await createCheckout('session-1', 'membership-1');

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('create-checkout', {
        body: { session_id: 'session-1', membership_id: 'membership-1' },
      });
      expect(result).toEqual(mockCheckout);
    });

    it('sends membership_id as null when undefined', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: {
          payment_intent_id: 'pi_abc',
          client_secret: 'secret',
          amount_cents: 1000,
          discount_cents: 0,
        },
        error: null,
      });

      await createCheckout('session-1', undefined);

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('create-checkout', {
        body: { session_id: 'session-1', membership_id: null },
      });
    });

    it('throws an error when the edge function fails', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Payment creation failed' },
      });

      await expect(createCheckout('session-1')).rejects.toThrow('Payment creation failed');
    });
  });

  // ---------------------------------------------------------------
  // createSubscription
  // ---------------------------------------------------------------
  describe('createSubscription', () => {
    it('invokes the create-subscription edge function with the tier', async () => {
      const mockSubscription = {
        subscription_id: 'sub_abc123',
        client_secret: 'seti_abc123_secret_xyz',
        tier: 'sand_regular',
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockSubscription,
        error: null,
      });

      const result = await createSubscription('sand_regular');

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('create-subscription', {
        body: { tier: 'sand_regular' },
      });
      expect(result).toEqual(mockSubscription);
    });

    it('works with all valid tier names', async () => {
      const tiers = ['local_player', 'sand_regular', 'founders'];

      for (const tier of tiers) {
        (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
          data: { subscription_id: `sub_${tier}`, client_secret: 'secret', tier },
          error: null,
        });

        const result = await createSubscription(tier);

        expect(result.tier).toBe(tier);
      }
    });

    it('throws an error when the edge function fails', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Subscription creation failed' },
      });

      await expect(createSubscription('founders')).rejects.toThrow('Subscription creation failed');
    });

    it('invokes the correct function name', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { subscription_id: 'sub_1', client_secret: 's', tier: 'local_player' },
        error: null,
      });

      await createSubscription('local_player');

      expect(mockSupabase.functions.invoke).toHaveBeenCalledTimes(1);
      const calledFunctionName = (mockSupabase.functions.invoke as jest.Mock).mock.calls[0][0];
      expect(calledFunctionName).toBe('create-subscription');
    });
  });
});
