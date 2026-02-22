import React, { useCallback } from 'react';
import { FlatList, View, Text, RefreshControl, ActivityIndicator } from 'react-native';
import ProductCard from '@/components/feed/ProductCard';
import Skeleton from '@/components/ui/Skeleton';
import type { FeedItem } from '@/lib/api/feed';

interface FeedListProps {
  items: FeedItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onEndReached?: () => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  ListHeaderComponent?: React.ReactElement;
}

function FeedSkeleton() {
  return (
    <View className="px-6">
      {[1, 2, 3].map((i) => (
        <View key={i} className="mb-4">
          <Skeleton width="100%" height={180} borderRadius={16} className="mb-3" />
          <Skeleton width="70%" height={20} borderRadius={8} className="mb-2" />
          <Skeleton width="40%" height={14} borderRadius={6} />
        </View>
      ))}
    </View>
  );
}

function FeedFooter({
  isFetchingNextPage,
  hasNextPage,
}: {
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
}) {
  if (isFetchingNextPage) {
    return (
      <View className="py-6 items-center">
        <ActivityIndicator size="small" color="#3F6F6A" />
      </View>
    );
  }
  if (!hasNextPage) {
    return (
      <View className="py-8 items-center">
        <Text className="text-sm text-charcoal/30 font-medium">
          You're all caught up
        </Text>
      </View>
    );
  }
  return null;
}

function EmptyFeed() {
  return (
    <View className="py-16 items-center px-8">
      <Text className="text-lg text-charcoal/40 font-semibold mb-2">
        No sessions found
      </Text>
      <Text className="text-sm text-charcoal/30 text-center">
        Try adjusting your filters or check back later for new sessions.
      </Text>
    </View>
  );
}

export default function FeedList({
  items,
  isLoading,
  isRefreshing,
  onRefresh,
  onEndReached,
  isFetchingNextPage = false,
  hasNextPage = false,
  ListHeaderComponent,
}: FeedListProps) {
  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <View className="px-6">
        <ProductCard
          product={item.product}
          nextSession={item.next_session}
        />
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback(
    (item: FeedItem) => item.product.id,
    [],
  );

  if (isLoading && !isRefreshing) {
    return (
      <>
        {ListHeaderComponent}
        <FeedSkeleton />
      </>
    );
  }

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={<EmptyFeed />}
      ListFooterComponent={
        items.length > 0 ? (
          <FeedFooter
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
          />
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor="#3F6F6A"
          colors={['#3F6F6A']}
        />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.3}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 24 }}
    />
  );
}
