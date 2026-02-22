import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';

import { useSession } from '@/lib/hooks/useSession';
import { useAuthStore } from '@/lib/stores/authStore';
import { formatPrice } from '@/lib/utils/pricing';

import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import BottomSheet from '@/components/ui/BottomSheet';
import CountdownBadge from '@/components/session/CountdownBadge';
import Roster from '@/components/session/Roster';
import WeatherBadge from '@/components/session/WeatherBadge';
import ChatThread from '@/components/session/ChatThread';
import InviteLink from '@/components/session/InviteLink';

function formatTimeRange(startsAt: string, endsAt: string): string {
  const start = parseISO(startsAt);
  const end = parseISO(endsAt);
  return `${format(start, 'h:mm')} \u2013 ${format(end, 'h:mm a')}`;
}

function formatCourtTime(startsAt: string, endsAt: string): string {
  const start = parseISO(startsAt);
  const end = parseISO(endsAt);
  return `${format(start, 'h:mm')} \u2013 ${format(end, 'h:mm')}`;
}

export default function SessionHubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? '';

  const {
    data: session,
    isLoading,
    isError,
    error,
    refetch,
  } = useSession(id ?? '');

  const [chatOpen, setChatOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlePay = useCallback(() => {
    if (!session) return;
    router.push({
      pathname: '/booking/payment',
      params: { sessionId: session.id },
    });
  }, [session, router]);

  const handleAddTime = useCallback(() => {
    Alert.alert(
      'Add Time',
      'Extend your session by 30 minutes or more.',
      [{ text: 'OK' }],
    );
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-6"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-6">
            <Skeleton width={160} height={28} borderRadius={8} className="mb-3" />
            <Skeleton width={120} height={20} borderRadius={6} className="mb-4" />
            <Skeleton width={140} height={32} borderRadius={16} />
          </View>
          <Card className="mb-4">
            <Skeleton width={120} height={18} borderRadius={6} className="mb-3" />
            <View className="flex-row gap-4">
              <Skeleton width={64} height={80} borderRadius={32} />
              <Skeleton width={64} height={80} borderRadius={32} />
              <Skeleton width={64} height={80} borderRadius={32} />
            </View>
          </Card>
          <Skeleton width="100%" height={48} borderRadius={12} className="mb-4" />
          <Skeleton width="100%" height={120} borderRadius={16} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Error state
  if (isError || !session) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
          <Text className="text-lg font-semibold text-charcoal mt-4 mb-2">
            Unable to load session
          </Text>
          <Text className="text-sm text-charcoal/50 text-center mb-6">
            {error?.message ?? 'Something went wrong. Please try again.'}
          </Text>
          <Button title="Retry" onPress={() => refetch()} variant="primary" />
        </View>
      </SafeAreaView>
    );
  }

  const productName = session.product?.title ?? 'Session';
  const timeRange = formatTimeRange(session.starts_at, session.ends_at);
  const bookings = session.bookings ?? [];
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
  const participantCount = activeBookings.length;

  // Calculate per-person price
  const pricePerPerson =
    participantCount > 0
      ? Math.round(session.price_cents / participantCount)
      : session.price_cents;

  // Check if current user has an active booking
  const currentUserBooking = activeBookings.find(
    (b) => b.user_id === currentUserId,
  );
  const isPaid = currentUserBooking?.status === 'confirmed';

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-28"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#3F6F6A"
          />
        }
      >
        {/* Header: Product name + time range */}
        <View className="items-center pt-4 pb-2 px-5">
          <Text className="text-2xl font-bold text-charcoal">
            {productName}
          </Text>
          <Text className="text-base text-charcoal/50 mt-1">{timeRange}</Text>
        </View>

        {/* Countdown badge */}
        <View className="items-center py-3">
          <CountdownBadge
            startsAt={session.starts_at}
            endsAt={session.ends_at}
            status={session.status}
          />
        </View>

        {/* Who's coming */}
        <Card className="mx-5 mb-4">
          <Text className="text-base font-bold text-charcoal mb-3">
            Who's coming
          </Text>
          <Roster bookings={bookings} currentUserId={currentUserId} />
        </Card>

        {/* Price per person */}
        <View className="items-center mb-4">
          <Text className="text-xl font-bold text-charcoal">
            {formatPrice(pricePerPerson).replace('.00', '')} Each
          </Text>
        </View>

        {/* Court list */}
        <View className="px-5 mb-4">
          {session.court ? (
            <CourtRow
              name={session.court.name}
              timeLabel={formatCourtTime(session.starts_at, session.ends_at)}
              status={session.status}
              spotsRemaining={session.spots_remaining}
            />
          ) : (
            <Text className="text-sm text-charcoal/40 text-center">
              Court assignment pending
            </Text>
          )}
        </View>

        {/* Weather */}
        {session.weather_snapshot && (
          <View className="items-center mb-4 px-5">
            <WeatherBadge weatherSnapshot={session.weather_snapshot} />
          </View>
        )}

        {/* Chat preview button */}
        <Pressable
          onPress={() => setChatOpen(true)}
          className="mx-5 mb-4 flex-row items-center justify-between bg-surface rounded-2xl px-4 py-3.5 border border-stroke"
        >
          <View className="flex-row items-center">
            <Ionicons name="chatbubbles-outline" size={20} color="#3F6F6A" />
            <Text className="text-sm font-semibold text-charcoal ml-2">
              Session Chat
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#9E9E9E" />
        </Pressable>
      </ScrollView>

      {/* Bottom action bar */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-surface border-t border-stroke px-5 pt-3 pb-2"
        style={{ paddingBottom: 12 }}
      >
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <InviteLink
              sessionId={session.id}
              spotsRemaining={session.spots_remaining}
            />
          </View>
          <View className="flex-1">
            <Button
              title={isPaid ? 'Paid' : 'Pay'}
              onPress={handlePay}
              variant={isPaid ? 'ghost' : 'secondary'}
              size="md"
              disabled={isPaid || !currentUserBooking}
              icon={
                <Ionicons
                  name={isPaid ? 'checkmark-circle' : 'card-outline'}
                  size={18}
                  color={isPaid ? '#3F6F6A' : '#FFFFFF'}
                />
              }
            />
          </View>
          <View className="flex-1">
            <Button
              title="Add Time"
              onPress={handleAddTime}
              variant="outline"
              size="md"
              icon={
                <Ionicons name="time-outline" size={18} color="#D6B07A" />
              }
            />
          </View>
        </View>
      </View>

      {/* Chat bottom sheet */}
      <BottomSheet
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        title="Session Chat"
        snapPoints={['70%', '90%']}
      >
        <ChatThread sessionId={session.id} currentUserId={currentUserId} />
      </BottomSheet>
    </SafeAreaView>
  );
}

// ---- Court row sub-component ----

interface CourtRowProps {
  name: string;
  timeLabel: string;
  status: string;
  spotsRemaining: number;
}

function CourtRow({ name, timeLabel, status, spotsRemaining }: CourtRowProps) {
  const isOpen = status === 'open' && spotsRemaining > 0;
  const badgeVariant = isOpen ? 'success' : 'info';
  const badgeLabel = isOpen ? 'Open' : status === 'full' ? 'Full' : '';

  return (
    <View className="flex-row items-center justify-between bg-surface rounded-2xl px-4 py-3.5 mb-2.5 border border-stroke">
      <View className="flex-1 mr-3">
        <Text className="text-base font-semibold text-charcoal">{name}</Text>
        <Text className="text-sm text-charcoal/50 mt-0.5">{timeLabel}</Text>
      </View>
      {badgeLabel ? (
        <Badge label={badgeLabel} variant={badgeVariant} size="sm" />
      ) : null}
    </View>
  );
}
