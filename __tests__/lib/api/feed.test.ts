import { supabase } from '@/lib/supabase';
import { getFeed, getProductById, getSessionsForProduct, logInteraction } from '@/lib/api/feed';

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('feed API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------
  // getFeed
  // ---------------------------------------------------------------
  describe('getFeed', () => {
    it('invokes the generate-feed edge function and returns data', async () => {
      const mockResponse = {
        items: [
          {
            product: { id: 'prod-1', title: 'Open Play' },
            next_session: null,
            relevance_score: 0.95,
          },
        ],
        next_cursor: 'cursor-abc',
        has_more: true,
      };

      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockResponse,
        error: null,
      });

      const result = await getFeed({ types: ['open_play'] });

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('generate-feed', {
        body: { types: ['open_play'] },
      });
      expect(result).toEqual(mockResponse);
    });

    it('passes an empty object as body when no filters are provided', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { items: [], next_cursor: null, has_more: false },
        error: null,
      });

      await getFeed();

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('generate-feed', {
        body: {},
      });
    });

    it('passes an empty object as body when undefined filters are provided', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { items: [], next_cursor: null, has_more: false },
        error: null,
      });

      await getFeed(undefined);

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('generate-feed', {
        body: {},
      });
    });

    it('throws an error when the edge function returns an error', async () => {
      (mockSupabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Edge function failed' },
      });

      await expect(getFeed()).rejects.toThrow('Edge function failed');
    });
  });

  // ---------------------------------------------------------------
  // getProductById
  // ---------------------------------------------------------------
  describe('getProductById', () => {
    it('returns a product by ID', async () => {
      const mockProduct = {
        id: 'prod-1',
        type: 'open_play',
        title: 'Morning Open Play',
        description: 'A great session',
        base_price_cents: 2500,
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({ data: mockProduct, error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      const result = await getProductById('prod-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('products');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'prod-1');
      expect(mockChain.single).toHaveBeenCalled();
      expect(result).toEqual(mockProduct);
    });

    it('throws an error when the product is not found', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Row not found' },
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      await expect(getProductById('non-existent')).rejects.toThrow('Row not found');
    });
  });

  // ---------------------------------------------------------------
  // getSessionsForProduct
  // ---------------------------------------------------------------
  describe('getSessionsForProduct', () => {
    it('returns sessions for a product', async () => {
      const mockSessions = [
        { id: 'sess-1', product_id: 'prod-1', status: 'open', starts_at: '2026-02-18T14:00:00Z' },
        { id: 'sess-2', product_id: 'prod-1', status: 'full', starts_at: '2026-02-19T14:00:00Z' },
      ];

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValueOnce({ data: mockSessions, error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      const result = await getSessionsForProduct('prod-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
      expect(mockChain.eq).toHaveBeenCalledWith('product_id', 'prod-1');
      expect(mockChain.in).toHaveBeenCalledWith('status', ['open', 'full']);
      expect(mockChain.order).toHaveBeenCalledWith('starts_at', { ascending: true });
      expect(result).toEqual(mockSessions);
    });

    it('returns an empty array when no sessions are found', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValueOnce({ data: null, error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      const result = await getSessionsForProduct('prod-1');
      expect(result).toEqual([]);
    });

    it('throws an error on database failure', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      await expect(getSessionsForProduct('prod-1')).rejects.toThrow('Database connection failed');
    });
  });

  // ---------------------------------------------------------------
  // logInteraction
  // ---------------------------------------------------------------
  describe('logInteraction', () => {
    it('inserts a feed interaction record', async () => {
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
      });

      const mockChain = {
        insert: jest.fn().mockResolvedValueOnce({ error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      await logInteraction('prod-1', 'view');

      expect(mockSupabase.from).toHaveBeenCalledWith('feed_interactions');
      expect(mockChain.insert).toHaveBeenCalledWith({
        product_id: 'prod-1',
        interaction_type: 'view',
        user_id: 'user-123',
      });
    });

    it('uses empty string for user_id when user is not authenticated', async () => {
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: null },
      });

      const mockChain = {
        insert: jest.fn().mockResolvedValueOnce({ error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      await logInteraction('prod-1', 'tap');

      expect(mockChain.insert).toHaveBeenCalledWith({
        product_id: 'prod-1',
        interaction_type: 'tap',
        user_id: '',
      });
    });

    it('throws an error when the insert fails', async () => {
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
      });

      const mockChain = {
        insert: jest.fn().mockResolvedValueOnce({
          error: { message: 'Insert failed' },
        }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      await expect(logInteraction('prod-1', 'book')).rejects.toThrow('Insert failed');
    });

    it('calls supabase.auth.getUser to obtain the user ID', async () => {
      (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
        data: { user: { id: 'user-789' } },
      });

      const mockChain = {
        insert: jest.fn().mockResolvedValueOnce({ error: null }),
      };
      (mockSupabase.from as jest.Mock).mockReturnValueOnce(mockChain);

      await logInteraction('prod-1', 'dismiss');

      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
    });
  });
});
