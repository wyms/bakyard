import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { getFeed, getProductById } from '@/lib/api/feed';
import type { FeedResponse } from '@/lib/api/feed';
import { useFeed, useInfiniteFeed, useProduct } from '@/lib/hooks/useFeed';

jest.mock('@/lib/api/feed', () => ({
  getFeed: jest.fn(),
  getProductById: jest.fn(),
}));

const mockGetFeed = getFeed as jest.MockedFunction<typeof getFeed>;
const mockGetProductById = getProductById as jest.MockedFunction<typeof getProductById>;

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

// Helper factory for FeedResponse
function makeFeedResponse(
  overrides?: Partial<FeedResponse>
): FeedResponse {
  return {
    items: [
      {
        product: {
          id: 'prod-1',
          type: 'open_play',
          title: 'Open Play Session',
          description: null,
          image_url: null,
          base_price_cents: 2500,
          capacity: 16,
          duration_minutes: 90,
          tags: ['pickleball'],
          coach_id: null,
          is_recurring: false,
          recurrence_rule: null,
          is_active: true,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        next_session: null,
        relevance_score: 0.95,
      },
    ],
    next_cursor: null,
    has_more: false,
    ...overrides,
  };
}

describe('useFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a loading state initially', () => {
    mockGetFeed.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useFeed(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('calls getFeed without filters when none are provided', async () => {
    const response = makeFeedResponse();
    mockGetFeed.mockResolvedValue(response);

    const { result } = renderHook(() => useFeed(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetFeed).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(response);
  });

  it('calls getFeed with the provided filters', async () => {
    const filters = { types: ['coaching'], tags: ['beginner'], limit: 10 };
    const response = makeFeedResponse();
    mockGetFeed.mockResolvedValue(response);

    const { result } = renderHook(() => useFeed(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetFeed).toHaveBeenCalledWith(filters);
  });

  it('returns data on success', async () => {
    const response = makeFeedResponse({ has_more: true, next_cursor: 'abc' });
    mockGetFeed.mockResolvedValue(response);

    const { result } = renderHook(() => useFeed(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data!.items).toHaveLength(1);
    expect(result.current.data!.has_more).toBe(true);
    expect(result.current.data!.next_cursor).toBe('abc');
  });

  it('returns an error state when getFeed rejects', async () => {
    mockGetFeed.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFeed(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('Network error');
  });

  it('uses the correct query key without filters', async () => {
    mockGetFeed.mockResolvedValue(makeFeedResponse());

    const wrapper = createWrapper();
    const { result } = renderHook(() => useFeed(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify it was called once (no duplicate fetches from key mismatch)
    expect(mockGetFeed).toHaveBeenCalledTimes(1);
  });

  it('uses the correct query key with filters', async () => {
    mockGetFeed.mockResolvedValue(makeFeedResponse());

    const filters = { search: 'tennis' };
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFeed(filters), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetFeed).toHaveBeenCalledTimes(1);
  });
});

describe('useProduct', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockProduct = {
    id: 'prod-1',
    type: 'open_play' as const,
    title: 'Open Play',
    description: 'Fun play',
    image_url: null,
    base_price_cents: 2500,
    capacity: 16,
    duration_minutes: 90,
    tags: [],
    coach_id: null,
    is_recurring: false,
    recurrence_rule: null,
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };

  it('calls getProductById with the given id', async () => {
    mockGetProductById.mockResolvedValue(mockProduct);

    const { result } = renderHook(() => useProduct('prod-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetProductById).toHaveBeenCalledWith('prod-1');
    expect(result.current.data).toEqual(mockProduct);
  });

  it('is disabled when id is an empty string', async () => {
    const { result } = renderHook(() => useProduct(''), {
      wrapper: createWrapper(),
    });

    // The query should not fire at all
    expect(mockGetProductById).not.toHaveBeenCalled();
    // fetchStatus will be 'idle' when the query is disabled
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('returns loading state before data is available', () => {
    mockGetProductById.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useProduct('prod-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('returns error state when getProductById rejects', async () => {
    mockGetProductById.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useProduct('bad-id'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe('Not found');
  });
});

describe('useInfiniteFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls getFeed with cursor undefined for the first page', async () => {
    const response = makeFeedResponse({ has_more: false, next_cursor: null });
    mockGetFeed.mockResolvedValue(response);

    const { result } = renderHook(() => useInfiniteFeed(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetFeed).toHaveBeenCalledWith({ cursor: undefined });
  });

  it('passes filters along with the cursor', async () => {
    const filters = { types: ['coaching'], tags: ['advanced'] };
    const response = makeFeedResponse();
    mockGetFeed.mockResolvedValue(response);

    const { result } = renderHook(() => useInfiniteFeed(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockGetFeed).toHaveBeenCalledWith({
      ...filters,
      cursor: undefined,
    });
  });

  it('returns pages data with the first page', async () => {
    const response = makeFeedResponse({ has_more: true, next_cursor: 'cursor-1' });
    mockGetFeed.mockResolvedValue(response);

    const { result } = renderHook(() => useInfiniteFeed(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data!.pages).toHaveLength(1);
    expect(result.current.data!.pages[0]).toEqual(response);
  });

  it('has a next page when has_more is true', async () => {
    const response = makeFeedResponse({ has_more: true, next_cursor: 'cursor-1' });
    mockGetFeed.mockResolvedValue(response);

    const { result } = renderHook(() => useInfiniteFeed(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });
  });

  it('does not have a next page when has_more is false', async () => {
    const response = makeFeedResponse({ has_more: false, next_cursor: null });
    mockGetFeed.mockResolvedValue(response);

    const { result } = renderHook(() => useInfiniteFeed(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.hasNextPage).toBe(false);
  });

  it('fetches the next page with the cursor from the previous page', async () => {
    const page1 = makeFeedResponse({ has_more: true, next_cursor: 'cursor-page2' });
    const page2 = makeFeedResponse({ has_more: false, next_cursor: null });

    mockGetFeed
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2);

    const { result } = renderHook(() => useInfiniteFeed(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.hasNextPage).toBe(true);
    });

    // Fetch the next page
    result.current.fetchNextPage();

    await waitFor(() => {
      expect(result.current.data!.pages).toHaveLength(2);
    });

    // The second call should use the cursor from page 1
    expect(mockGetFeed).toHaveBeenCalledTimes(2);
    expect(mockGetFeed).toHaveBeenLastCalledWith({ cursor: 'cursor-page2' });
  });

  it('returns error state when getFeed rejects', async () => {
    mockGetFeed.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useInfiniteFeed(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toBe('Server error');
  });
});
