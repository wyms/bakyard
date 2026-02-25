import React, { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { startOfDay, endOfDay, addDays, format, parseISO } from 'date-fns';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/stores/authStore';
import type { Session, Product, ProductType } from '@/lib/types/database';
import NextSessionCard from '@/components/home/NextSessionCard';
import Skeleton from '@/components/ui/Skeleton';
import { formatPrice } from '@/lib/utils/pricing';

// ---------------------------------------------------------------------------
// Greeting helper
// ---------------------------------------------------------------------------
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
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
// Type config
// ---------------------------------------------------------------------------
const TYPE_LABEL: Record<ProductType, string> = {
  open_play: 'Open Play',
  clinic: 'Clinic',
  court_rental: 'Private',
  coaching: 'Training',
  tournament: 'Tournament',
  community_day: 'Community',
  food_addon: 'Add-On',
};

const TYPE_COLOR: Record<ProductType, string> = {
  open_play: '#D95F2B',
  clinic: '#7BC4E2',
  court_rental: '#E8C97A',
  coaching: '#7BC4E2',
  tournament: '#E8C97A',
  community_day: '#4CAF72',
  food_addon: '#8A8FA0',
};

// ---------------------------------------------------------------------------
// Horizontal session card (matches prototype .sc style)
// ---------------------------------------------------------------------------
interface SessionCardProps {
  session: SessionWithProduct;
  onPress: () => void;
}

function SessionCard({ session, onPress }: SessionCardProps) {
  const product = session.product;
  const start = parseISO(session.starts_at);
  const timeStr = format(start, 'EEE · h:mm a');
  const productType = product?.type ?? 'open_play';
  const spotsTotal = session.spots_total ?? 12;
  const spotsRemaining = session.spots_remaining ?? 0;
  const fillPct = Math.max(0, Math.min(100, ((spotsTotal - spotsRemaining) / spotsTotal) * 100));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        width: 152,
        backgroundColor: '#181C26',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      {/* Type label */}
      <Text
        style={{
          fontFamily: 'BarlowCondensed_700Bold',
          fontSize: 9,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color: TYPE_COLOR[productType],
          marginBottom: 6,
        }}
      >
        {TYPE_LABEL[productType]}
      </Text>

      {/* Session name */}
      <Text
        style={{
          fontFamily: 'BarlowCondensed_700Bold',
          fontSize: 16,
          letterSpacing: 0.6,
          color: '#F0EDE6',
          lineHeight: 19,
          marginBottom: 4,
        }}
        numberOfLines={2}
      >
        {product?.title ?? 'Session'}
      </Text>

      {/* Time */}
      <Text style={{ fontSize: 11, color: '#8A8FA0', marginBottom: 10 }}>
        {timeStr}
      </Text>

      {/* Availability bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            flex: 1,
            height: 3,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${fillPct}%`,
              backgroundColor: '#E8C97A',
              borderRadius: 2,
            }}
          />
        </View>
        <Text style={{ fontSize: 10, color: '#5A5F72' }}>
          {spotsRemaining} left
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Quick action tile
// ---------------------------------------------------------------------------
interface TileProps {
  emoji: string;
  label: string;
  sublabel: string;
  onPress: () => void;
  primary?: boolean;
}

function QuickTile({ emoji, label, sublabel, onPress, primary = false }: TileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        flex: 1,
        borderRadius: 14,
        padding: 16,
        backgroundColor: primary ? '#E8C97A' : '#181C26',
        borderWidth: 1,
        borderColor: primary ? '#E8C97A' : 'rgba(255,255,255,0.04)',
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Text style={{ fontSize: 22, marginBottom: 8 }}>{emoji}</Text>
      <Text
        style={{
          fontFamily: 'BarlowCondensed_700Bold',
          fontSize: 14,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: primary ? '#0D0F14' : '#F0EDE6',
          marginBottom: 3,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: 11, color: primary ? 'rgba(13,15,20,0.55)' : '#5A5F72' }}>
        {sublabel}
      </Text>
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
        {/* Hero band */}
        <View style={{ backgroundColor: '#1A1F0A', paddingHorizontal: 22, paddingTop: 16, paddingBottom: 24 }}>
          {/* Greeting label */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 20, height: 1, backgroundColor: '#E8C97A', marginRight: 8 }} />
            <Text
              style={{
                fontFamily: 'BarlowCondensed_600SemiBold',
                fontSize: 11,
                letterSpacing: 3.2,
                textTransform: 'uppercase',
                color: '#E8C97A',
              }}
            >
              {greeting}
            </Text>
          </View>

          {/* Name */}
          <Text
            style={{
              fontFamily: 'BebasNeue_400Regular',
              fontSize: 32,
              letterSpacing: 1.8,
              color: '#F0EDE6',
              lineHeight: 32,
              marginBottom: 14,
            }}
          >
            {displayName.toUpperCase()}
          </Text>

          {/* Next session card */}
          {nextLoading ? (
            <Skeleton width="100%" height={60} borderRadius={12} />
          ) : (
            <NextSessionCard
              session={nextSession}
              product={(nextSession as SessionWithProduct | null | undefined)?.product}
            />
          )}
        </View>

        {/* Quick action tiles — 2x2 grid */}
        <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 0 }}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <QuickTile emoji="📅" label="Book Now" sublabel="Reserve a court" onPress={handleBookNow} primary />
            <QuickTile emoji="🏐" label="Open Play" sublabel="Jump in today" onPress={handleOpenPlay} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <QuickTile emoji="🎯" label="Training" sublabel="Clinics & lessons" onPress={handleTraining} />
            <QuickTile emoji="🏆" label="My Plan" sublabel="Manage sessions" onPress={handleMyPlan} />
          </View>
        </View>

        {/* This week — horizontal scroll */}
        <View style={{ marginTop: 20, marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 12 }}>
            <Text
              style={{
                fontFamily: 'BebasNeue_400Regular',
                fontSize: 18,
                letterSpacing: 1.6,
                color: '#F0EDE6',
              }}
            >
              THIS WEEK
            </Text>
            <Pressable onPress={handleBookNow}>
              <Text
                style={{
                  fontFamily: 'BarlowCondensed_600SemiBold',
                  fontSize: 10,
                  letterSpacing: 2.4,
                  textTransform: 'uppercase',
                  color: '#E8C97A',
                }}
              >
                See all →
              </Text>
            </Pressable>
          </View>

          {weekLoading ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 22, gap: 10 }}
            >
              <Skeleton width={152} height={100} borderRadius={16} />
              <Skeleton width={152} height={100} borderRadius={16} />
              <Skeleton width={152} height={100} borderRadius={16} />
            </ScrollView>
          ) : weekSessions.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 22, gap: 10 }}
            >
              {weekSessions.map((s) => (
                <SessionCard
                  key={s.id}
                  session={s}
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
            <View style={{ marginHorizontal: 22, backgroundColor: '#181C26', borderRadius: 14, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' }}>
              <Text style={{ color: '#8A8FA0', fontSize: 13, textAlign: 'center' }}>
                No sessions scheduled this week.
              </Text>
            </View>
          )}
        </View>

        {/* THE YARD / Community news */}
        <View style={{ marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 12 }}>
            <Text
              style={{
                fontFamily: 'BebasNeue_400Regular',
                fontSize: 18,
                letterSpacing: 1.6,
                color: '#F0EDE6',
              }}
            >
              THE YARD
            </Text>
            <Text
              style={{
                fontFamily: 'BarlowCondensed_600SemiBold',
                fontSize: 10,
                letterSpacing: 2,
                color: '#E8C97A',
              }}
            >
              @beach.bakyard
            </Text>
          </View>

          <View
            style={{
              marginHorizontal: 22,
              backgroundColor: '#181C26',
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.04)',
            }}
          >
            <Text style={{ fontSize: 12, color: '#5A5F72', fontWeight: '300', lineHeight: 21 }}>
              {'📣 '}
              <Text style={{ color: '#E8C97A', fontWeight: '500' }}>New Tuesday Clinic!</Text>
              {' — Defensive Systems for 2s. Limited to 8 players. Grab your spot now.'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
