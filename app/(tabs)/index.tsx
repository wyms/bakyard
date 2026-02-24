import React, { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { startOfDay, endOfDay, addDays, format, parseISO } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/stores/authStore';
import type { Session, Product, ProductType } from '@/lib/types/database';
import NextSessionCard from '@/components/home/NextSessionCard';
import Skeleton from '@/components/ui/Skeleton';
import Badge from '@/components/ui/Badge';
import { formatPrice } from '@/lib/utils/pricing';

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
// Horizontal session card
// ---------------------------------------------------------------------------
const SESSION_CARD_BADGE: Record<ProductType, 'open-play' | 'clinic' | 'private' | 'default'> = {
  open_play: 'open-play',
  clinic: 'clinic',
  court_rental: 'private',
  coaching: 'clinic',
  tournament: 'default',
  community_day: 'default',
  food_addon: 'default',
};

const SESSION_TYPE_LABELS: Record<ProductType, string> = {
  open_play: 'Open Play',
  clinic: 'Clinic',
  court_rental: 'Private',
  coaching: 'Training',
  tournament: 'Tournament',
  community_day: 'Community',
  food_addon: 'Add-On',
};

interface SessionCardProps {
  session: SessionWithProduct;
  product: Product | null;
  onPress: () => void;
}

function SessionCard({ session, product, onPress }: SessionCardProps) {
  const start = parseISO(session.starts_at);
  const timeStr = format(start, 'h:mm a');
  const dayStr = format(start, 'EEE d');
  const productType = product?.type ?? 'open_play';
  const isUrgent = session.spots_remaining > 0 && session.spots_remaining < 3;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
        width: 220,
      })}
      className="bg-surface rounded-2xl p-4 border border-stroke"
    >
      {/* Day + time */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-display text-xl text-offwhite">{dayStr.toUpperCase()}</Text>
        <Text className="text-xs text-mid">{timeStr}</Text>
      </View>

      {/* Badge row */}
      <View className="flex-row items-center gap-2 mb-2">
        <Badge
          label={SESSION_TYPE_LABELS[productType]}
          variant={SESSION_CARD_BADGE[productType]}
          size="sm"
        />
        {isUrgent && <Text className="text-xs">🔥</Text>}
      </View>

      {/* Session name */}
      <Text className="text-sm font-semibold text-offwhite mb-2" numberOfLines={2}>
        {product?.title ?? 'Session'}
      </Text>

      {/* Spots + price */}
      <View className="flex-row items-center justify-between mt-auto">
        <Text className="text-xs text-mid">{session.spots_remaining} spots left</Text>
        <Text className="text-sm font-bold text-sand">
          {formatPrice(session.price_cents)}
        </Text>
      </View>
    </Pressable>
  );
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

        {/* This week — horizontal scroll */}
        <View className="mb-3">
          <Text className="font-display text-2xl text-offwhite mb-3 px-5">THIS WEEK</Text>
          {weekLoading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              <Skeleton width={220} height={110} borderRadius={16} />
              <Skeleton width={220} height={110} borderRadius={16} />
              <Skeleton width={220} height={110} borderRadius={16} />
            </ScrollView>
          ) : weekSessions.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {weekSessions.map((s) => (
                <SessionCard
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
              ))}
            </ScrollView>
          ) : (
            <View className="mx-5 bg-surface rounded-2xl p-5 items-center border border-stroke">
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
