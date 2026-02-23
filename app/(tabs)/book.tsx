import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, isSameDay, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { Session, Product, ProductType } from '@/lib/types/database';
import Chip from '@/components/ui/Chip';
import SessionRow from '@/components/feed/SessionRow';
import Skeleton from '@/components/ui/Skeleton';

type FilterType = 'all' | 'open_play' | 'court_rental' | 'clinic';

interface SessionWithProduct extends Session {
  product: Product | null;
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open_play', label: 'Open Play' },
  { key: 'court_rental', label: 'Private' },
  { key: 'clinic', label: 'Clinics' },
];

async function fetchSessionsForWeek(startDate: Date): Promise<SessionWithProduct[]> {
  const from = startOfDay(startDate).toISOString();
  const to = endOfDay(addDays(startDate, 5)).toISOString();

  const { data, error } = await supabase
    .from('sessions')
    .select(`*, product:products (*)`)
    .gte('starts_at', from)
    .lte('starts_at', to)
    .in('status', ['open', 'full'])
    .order('starts_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as SessionWithProduct[];
}

export default function BookScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const initialFilter = (params.filter as FilterType) ?? 'all';

  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter);

  const today = useMemo(() => startOfDay(new Date()), []);
  const days = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addDays(today, i)),
    [today],
  );

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['book-sessions', today.toISOString()],
    queryFn: () => fetchSessionsForWeek(today),
  });

  const selectedDay = days[selectedDayIndex];

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const sameDay = isSameDay(new Date(s.starts_at), selectedDay);
      if (!sameDay) return false;
      if (activeFilter === 'all') return true;
      const productType: ProductType | undefined = s.product?.type;
      if (activeFilter === 'clinic') return productType === 'clinic' || productType === 'coaching';
      return productType === activeFilter;
    });
  }, [sessions, selectedDay, activeFilter]);

  const dayHasSessions = useCallback(
    (day: Date) => sessions.some((s) => isSameDay(new Date(s.starts_at), day)),
    [sessions],
  );

  const renderSession = useCallback(
    ({ item }: ListRenderItemInfo<SessionWithProduct>) => (
      <SessionRow
        session={item}
        product={item.product}
        onPress={() =>
          router.push({
            pathname: '/product/[id]',
            params: { id: item.product_id },
          })
        }
      />
    ),
    [router],
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <Text className="font-display text-4xl text-offwhite">BOOK</Text>
      </View>

      {/* 6-day date picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
      >
        {days.map((day, i) => {
          const isActive = i === selectedDayIndex;
          const hasSessions = dayHasSessions(day);
          return (
            <Chip
              key={day.toISOString()}
              label={`${format(day, 'EEE')}\n${format(day, 'd')}`}
              selected={isActive}
              onPress={() => setSelectedDayIndex(i)}
              icon={
                hasSessions ? (
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 2.5,
                      backgroundColor: isActive ? '#0D0F14' : '#E8C97A',
                      marginBottom: 2,
                    }}
                  />
                ) : undefined
              }
            />
          );
        })}
      </ScrollView>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8 }}
      >
        {FILTERS.map((f) => (
          <View key={f.key} className="mr-2">
            <Chip
              label={f.label}
              selected={activeFilter === f.key}
              onPress={() => setActiveFilter(f.key)}
            />
          </View>
        ))}
      </ScrollView>

      {/* Session list */}
      {isLoading ? (
        <View className="px-5 pt-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width="100%" height={72} borderRadius={16} className="mb-2.5" />
          ))}
        </View>
      ) : (
        <FlatList
          data={filteredSessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-mid text-sm text-center">
                No sessions on this day.{'\n'}Check another day or filter.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
