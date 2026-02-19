import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { getFeed, getProductById, type FeedFilters, type FeedResponse } from '@/lib/api/feed';

/**
 * Hook for fetching the personalized feed with filters.
 * Uses a standard useQuery for simple cases.
 */
export function useFeed(filters?: FeedFilters) {
  return useQuery<FeedResponse>({
    queryKey: ['feed', filters ?? {}],
    queryFn: () => getFeed(filters),
  });
}

/**
 * Infinite query variant for paginated feed loading.
 * Automatically fetches the next page using the cursor.
 */
export function useInfiniteFeed(filters?: Omit<FeedFilters, 'cursor'>) {
  return useInfiniteQuery<FeedResponse>({
    queryKey: ['feed', 'infinite', filters ?? {}],
    queryFn: ({ pageParam }) =>
      getFeed({ ...filters, cursor: pageParam as string | undefined }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
  });
}

/**
 * Hook for fetching a single product by ID.
 */
export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => getProductById(id),
    enabled: !!id,
  });
}
