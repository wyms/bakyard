import React, { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { startOfDay, endOfDay, addDays } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/stores/authStore';
import type { Session, Product } from '@/lib/types/database';
import NextSessionCard from '@/components/home/NextSessionCard';
import SessionRow from '@/components/feed/SessionRow';
import Skeleton from '@/components/ui/Skeleton';

// ---------------------------------------------------------------------------
// Greeting helper
// ---------------------------------------------------------------------------
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
interface SessionWithProduct extends Session {
  product: Product | null;
}

async function fetchNextSession(userId: string): Promise<SessionWithProduct | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('bookings')
    .select(`session:sessions (*, product:products (*))`)
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .gte('session.starts_at', now)
    .order('session.starts_at', { ascending: true })
    .limit(1);

  if (error) return null;
  const row = data?.[0];
  const session = row?.session as SessionWithProduct | undefined;
  return session ?? null;
}

async function fetchWeekSessions(): Promise<SessionWithProduct[]> {
  const from = startOfDay(new Date()).toISOString();
  const to = endOfDay(addDays(new Date(), 6)).toISOString();

  const { data, error } = await supabase
    .from('sessions')
    .select(`*, product:products (*)`)
    .gte('starts_at', from)
    .lte('starts_at', to)
    .in('status', ['open', 'full'])
    .order('starts_at', { ascending: true })
    .limit(10);

  if (error) return [];
  return (data ?? []) as SessionWithProduct[];
}

// ---------------------------------------------------------------------------
// Quick action tile
// ---------------------------------------------------------------------------
interface TileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  accent?: boolean;
}

function QuickTile({ icon, label, onPress, accent = false }: TileProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 bg-surface rounded-2xl p-4 items-center border border-stroke"
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Ionicons name={icon} size={24} color={accent ? '#D95F2B' : '#E8C97A'} />
      <Text className="text-xs font-semibold text-offwhite mt-2 text-center">{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function HomeScreen() {
  const router = useRouter();
  const { session: authSession } = useAuthStore();
  const userId = authSession?.user?.id;

  const displayName = useMemo(() => {
    const name =
      authSession?.user?.user_metadata?.full_name ??
      authSession?.user?.email ??
      '';
    return name.split(' ')[0] || 'there';
  }, [authSession]);

  const greeting = useMemo(() => getGreeting(), []);

  const { data: nextSession, isLoading: nextLoading } = useQuery({
    queryKey: ['next-session', userId],
    queryFn: () => fetchNextSession(userId!),
    enabled: !!userId,
  });

  const { data: weekSessions = [], isLoading: weekLoading } = useQuery({
    queryKey: ['week-sessions'],
    queryFn: fetchWeekSessions,
  });

  const handleBookNow = useCallback(() => router.push('/(tabs)/book' as never), [router]);
  const handleOpenPlay = useCallback(
    () => router.push({ pathname: '/(tabs)/book', params: { filter: 'open_play' } } as never),
    [router],
  );
  const handleTraining = useCallback(
    () => router.push({ pathname: '/(tabs)/book', params: { filter: 'clinic' } } as never),
    [router],
  );
  const handleMyPlan = useCallback(() => router.push('/(tabs)/membership' as never), [router]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-5 pt-5 pb-4">
          <Text className="text-mid text-sm mb-0.5">{greeting},</Text>
          <Text className="font-display text-4xl text-offwhite leading-none">{displayName.toUpperCase()}</Text>
        </View>

        {/* Next session card */}
        <View className="px-5">
          {nextLoading ? (
            <Skeleton width="100%" height={80} borderRadius={16} className="mb-4" />
          ) : (
            <NextSessionCard
              session={nextSession}
              product={(nextSession as SessionWithProduct | null | undefined)?.product}
            />
          )}
        </View>

        {/* Quick action tiles — 2x2 grid */}
        <View className="px-5 mb-5">
          <View className="flex-row gap-3 mb-3">
            <QuickTile icon="add-circle-outline" label="Book Now" onPress={handleBookNow} />
            <QuickTile icon="people-outline" label="Open Play" onPress={handleOpenPlay} accent />
          </View>
          <View className="flex-row gap-3">
            <QuickTile icon="barbell-outline" label="Training" onPress={handleTraining} />
            <QuickTile icon="star-outline" label="My Plan" onPress={handleMyPlan} />
          </View>
        </View>

        {/* This week */}
        <View className="px-5 mb-3">
          <Text className="font-display text-2xl text-offwhite mb-3">THIS WEEK</Text>
          {weekLoading ? (
            <>
              <Skeleton width="100%" height={72} borderRadius={16} className="mb-2.5" />
              <Skeleton width="100%" height={72} borderRadius={16} className="mb-2.5" />
            </>
          ) : weekSessions.length > 0 ? (
            weekSessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                product={s.product}
                onPress={() =>
                  router.push({
                    pathname: '/product/[id]',
                    params: { id: s.product_id },
                  })
                }
              />
            ))
          ) : (
            <View className="bg-surface rounded-2xl p-5 items-center border border-stroke">
              <Text className="text-mid text-sm text-center">No sessions scheduled this week.</Text>
            </View>
          )}
        </View>

        {/* Community news teaser */}
        <View className="mx-5 bg-surface rounded-2xl p-4 border border-stroke">
          <View className="flex-row items-center mb-2">
            <Ionicons name="megaphone-outline" size={16} color="#E8C97A" />
            <Text className="text-xs font-semibold text-sand ml-2 uppercase tracking-wide">
              Community
            </Text>
          </View>
          <Text className="text-sm font-bold text-offwhite mb-1">
            Spring Tournament Registration Open
          </Text>
          <Text className="text-xs text-mid">
            Sign up for the Bakyard Spring Classic — limited spots available.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
