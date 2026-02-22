import React, { useState, useCallback, useMemo } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getFeed, type FeedItem, type FeedResponse } from '@/lib/api/feed';
import { useFilterStore } from '@/lib/stores/filterStore';
import type { Product, Session, Court, ProductType } from '@/lib/types/database';
import CategoryButtonList from '@/components/feed/CategoryButton';
import FilterBar from '@/components/feed/FilterBar';
import CourtStatusCard from '@/components/feed/CourtStatusCard';
import FeedList from '@/components/feed/FeedList';
import Skeleton from '@/components/ui/Skeleton';

// ---------------------------------------------------------------------------
// Local Supabase fallback: fetches products + sessions directly from tables
// when the edge function is not available (e.g. during local development).
// ---------------------------------------------------------------------------
async function getLocalFeed(filters?: { types?: string[] }): Promise<FeedResponse> {
  // Fetch active products
  let productsQuery = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (filters?.types && filters.types.length > 0) {
    productsQuery = productsQuery.in('type', filters.types);
  }

  const { data: products, error: productsError } = await productsQuery;
  if (productsError) throw new Error(productsError.message);

  // Fetch upcoming sessions with court info
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select(`
      *,
      court:courts (*),
      product:products (*)
    `)
    .gte('starts_at', new Date().toISOString())
    .in('status', ['open', 'full'])
    .order('starts_at', { ascending: true });

  if (sessionsError) throw new Error(sessionsError.message);

  // Build a map of product_id -> nearest session
  const sessionsByProduct = new Map<string, Session>();
  for (const session of (sessions ?? [])) {
    const s = session as Session;
    if (!sessionsByProduct.has(s.product_id)) {
      sessionsByProduct.set(s.product_id, s);
    }
  }

  // Build feed items
  const items: FeedItem[] = (products ?? []).map((product) => ({
    product: product as Product,
    next_session: sessionsByProduct.get(product.id) ?? null,
    relevance_score: 1,
  }));

  return {
    items,
    next_cursor: null,
    has_more: false,
  };
}

// ---------------------------------------------------------------------------
// Fetch court sessions for the "Now / Today" section
// ---------------------------------------------------------------------------
interface CourtSession {
  session: Session;
  court: Court;
}

async function getTodayCourtSessions(): Promise<CourtSession[]> {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('sessions')
    .select(`
      *,
      court:courts (*),
      product:products (*)
    `)
    .gte('starts_at', now.toISOString())
    .lte('starts_at', endOfDay.toISOString())
    .in('status', ['open', 'full', 'in_progress'])
    .order('starts_at', { ascending: true });

  if (error) throw new Error(error.message);

  const results: CourtSession[] = [];
  const seenCourts = new Set<string>();

  for (const row of data ?? []) {
    const session = row as Session;
    if (session.court_id && session.court && !seenCourts.has(session.court_id)) {
      seenCourts.add(session.court_id);
      results.push({ session, court: session.court });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main Feed Screen
// ---------------------------------------------------------------------------
export default function FeedScreen() {
  const { activeFilters } = useFilterStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Build filter types from active filters
  const filterTypes = useMemo(
    () => (activeFilters.length > 0 ? activeFilters : undefined),
    [activeFilters],
  );

  // Feed data query with edge function -> local fallback
  const {
    data: feedData,
    isLoading: feedLoading,
    refetch: refetchFeed,
  } = useQuery<FeedResponse>({
    queryKey: ['feed', filterTypes ?? 'all'],
    queryFn: async () => {
      try {
        // Try the edge function first
        const result = await getFeed({
          types: filterTypes,
          limit: 20,
        });
        return result;
      } catch {
        // Fallback to local Supabase query
        return getLocalFeed({ types: filterTypes });
      }
    },
  });

  // Today's court sessions query
  const {
    data: courtSessions,
    isLoading: courtsLoading,
    refetch: refetchCourts,
  } = useQuery<CourtSession[]>({
    queryKey: ['courtSessions', 'today'],
    queryFn: getTodayCourtSessions,
  });

  // Handle category button press: apply filter
  const handleCategoryPress = useCallback(
    (productTypes: ProductType[]) => {
      const store = useFilterStore.getState();
      store.clearFilters();
      for (const pt of productTypes) {
        store.toggleFilter(pt);
      }
    },
    [],
  );

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchFeed(), refetchCourts()]);
    setIsRefreshing(false);
  }, [refetchFeed, refetchCourts]);

  // Feed items (stable reference)
  const feedItems = feedData?.items ?? [];

  // ------ Render the header above the feed list ------
  const ListHeader = useMemo(
    () => (
      <View>
        {/* Title */}
        <View className="px-6 pt-4 pb-3 items-center">
          <Text className="text-2xl font-extrabold text-charcoal tracking-widest uppercase">
            BAKYARD
          </Text>
        </View>

        {/* Category Quick-Action Buttons */}
        <View className="px-6 pt-2 pb-4">
          <CategoryButtonList onCategoryPress={handleCategoryPress} />
        </View>

        {/* Filter Bar */}
        <FilterBar />

        {/* Now / Today Section */}
        <View className="px-6 mb-3">
          <Text className="text-base font-bold text-charcoal/70 mb-2">
            Now / Today
          </Text>
          {courtsLoading ? (
            <View>
              {[1, 2, 3].map((i) => (
                <Skeleton
                  key={i}
                  width="100%"
                  height={56}
                  borderRadius={16}
                  className="mb-2.5"
                />
              ))}
            </View>
          ) : courtSessions && courtSessions.length > 0 ? (
            courtSessions.map((cs) => (
              <CourtStatusCard
                key={cs.session.id}
                session={cs.session}
                court={cs.court}
              />
            ))
          ) : (
            <View className="bg-surface rounded-2xl px-4 py-5 mb-2.5 items-center shadow-sm shadow-black/5">
              <Text className="text-sm text-charcoal/40 font-medium">
                No courts active right now
              </Text>
            </View>
          )}
        </View>

        {/* Feed Section Header */}
        {feedItems.length > 0 && (
          <View className="px-6 mt-2 mb-3">
            <Text className="text-base font-bold text-charcoal/70">
              Explore
            </Text>
          </View>
        )}
      </View>
    ),
    [courtsLoading, courtSessions, feedItems.length, handleCategoryPress],
  );

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top']}>
      <FeedList
        items={feedItems}
        isLoading={feedLoading}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        hasNextPage={feedData?.has_more ?? false}
        ListHeaderComponent={ListHeader}
      />
    </SafeAreaView>
  );
}
