import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  RefreshControl,
  type SectionListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { parseISO, format, isAfter } from 'date-fns';

import { getMyBookings } from '@/lib/api/bookings';
import { formatPrice } from '@/lib/utils/pricing';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import CountdownBadge from '@/components/session/CountdownBadge';
import type { Booking, Session } from '@/lib/types/database';

interface BookingWithSession extends Booking {
  session: Session;
}

interface SessionSection {
  title: string;
  data: BookingWithSession[];
}

function formatSessionDate(startsAt: string, endsAt: string): string {
  const start = parseISO(startsAt);
  const end = parseISO(endsAt);
  const dayPart = format(start, 'EEE, MMM d');
  const startTime = format(start, 'h:mm');
  const endTime = format(end, 'h:mm a');
  return `${dayPart} \u2022 ${startTime} \u2013 ${endTime}`;
}

function getSessionStatusLabel(session: Session): string {
  if (session.status === 'completed') return 'Completed';
  if (session.status === 'in_progress') return 'In Progress';
  if (session.status === 'cancelled') return 'Cancelled';
  if (session.spots_remaining > 0) return 'Open';
  return 'Full';
}

function getSessionStatusVariant(
  session: Session,
): 'success' | 'info' | 'accent' | 'default' | 'warning' | 'done' {
  if (session.status === 'completed') return 'done';
  if (session.status === 'in_progress') return 'info';
  if (session.status === 'cancelled') return 'accent';
  if (session.spots_remaining > 0) return 'success';
  return 'warning';
}

export default function SessionsScreen() {
  const router = useRouter();

  const {
    data: bookings,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['bookings', 'my'],
    queryFn: getMyBookings,
  });

  const sections = useMemo<SessionSection[]>(() => {
    if (!bookings) return [];

    const now = new Date();

    // Filter to bookings that have a session attached, exclude cancelled bookings
    const withSession = bookings.filter(
      (b): b is BookingWithSession =>
        b.session != null && b.status !== 'cancelled',
    );

    const upcoming: BookingWithSession[] = [];
    const past: BookingWithSession[] = [];

    withSession.forEach((booking) => {
      const endsAt = parseISO(booking.session.ends_at);
      if (
        isAfter(endsAt, now) &&
        booking.session.status !== 'completed' &&
        booking.session.status !== 'cancelled'
      ) {
        upcoming.push(booking);
      } else {
        past.push(booking);
      }
    });

    // Sort upcoming by start time ascending (soonest first)
    upcoming.sort((a, b) =>
      a.session.starts_at.localeCompare(b.session.starts_at),
    );

    // Sort past by start time descending (most recent first)
    past.sort((a, b) =>
      b.session.starts_at.localeCompare(a.session.starts_at),
    );

    const result: SessionSection[] = [];
    if (upcoming.length > 0) {
      result.push({ title: 'Upcoming', data: upcoming });
    }
    if (past.length > 0) {
      result.push({ title: 'Past', data: past });
    }
    return result;
  }, [bookings]);

  const handleSessionPress = useCallback(
    (sessionId: string) => {
      router.push({
        pathname: '/session/[id]',
        params: { id: sessionId },
      });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item, section }: SectionListRenderItemInfo<BookingWithSession, SessionSection>) => {
      const isUpcoming = section.title === 'Upcoming';
      return (
        <SessionCard
          booking={item}
          isUpcoming={isUpcoming}
          onPress={() => handleSessionPress(item.session_id)}
        />
      );
    },
    [handleSessionPress],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SessionSection }) => (
      <View className="px-5 pt-4 pb-2 bg-bg">
        <Text className="text-lg font-bold text-offwhite">
          {section.title}
        </Text>
      </View>
    ),
    [],
  );

  const keyExtractor = useCallback(
    (item: BookingWithSession) => item.id,
    [],
  );

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <View className="px-6 pt-4 pb-2">
          <Text className="text-3xl font-bold text-offwhite">My Sessions</Text>
        </View>
        <View className="px-5 pt-4">
          <Skeleton width="100%" height={120} borderRadius={16} className="mb-3" />
          <Skeleton width="100%" height={120} borderRadius={16} className="mb-3" />
          <Skeleton width="100%" height={120} borderRadius={16} />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <View className="px-6 pt-4 pb-2">
          <Text className="text-3xl font-bold text-offwhite">My Sessions</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#D95F2B" />
          <Text className="text-base text-offwhite/50 text-center mt-3">
            Unable to load your sessions.{'\n'}Pull down to try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (sections.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <View className="px-6 pt-4 pb-2">
          <Text className="text-3xl font-bold text-offwhite">My Sessions</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-stroke items-center justify-center mb-5">
            <Ionicons name="calendar-outline" size={36} color="#E8C97A" />
          </View>
          <Text className="text-lg font-semibold text-offwhite mb-2">
            No sessions yet
          </Text>
          <Text className="text-sm text-offwhite/40 font-medium text-center leading-5">
            Browse the feed to discover and book{'\n'}your first beach volleyball session!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="px-6 pt-4 pb-2">
        <Text className="text-3xl font-bold text-offwhite">My Sessions</Text>
      </View>

      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#E8C97A"
          />
        }
      />
    </SafeAreaView>
  );
}

// ---- Session card sub-component ----

interface SessionCardProps {
  booking: BookingWithSession;
  isUpcoming: boolean;
  onPress: () => void;
}

function SessionCard({ booking, isUpcoming, onPress }: SessionCardProps) {
  const session = booking.session;
  const productName = session.product?.title ?? 'Session';
  const courtName = session.court?.name;
  const dateTime = formatSessionDate(session.starts_at, session.ends_at);
  const participantCount = session.spots_total - session.spots_remaining;
  const totalSpots = session.spots_total;

  const sessionStatusLabel = getSessionStatusLabel(session);
  const sessionStatusVariant = getSessionStatusVariant(session);

  return (
    <Card
      onPress={onPress}
      className="mx-5 mb-3"
    >
      {/* Top row: product name + status badge */}
      <View className="flex-row items-start justify-between mb-2">
        <Text
          className="text-base font-bold text-offwhite flex-1 mr-2"
          numberOfLines={1}
        >
          {productName}
        </Text>
        <Badge
          label={sessionStatusLabel}
          variant={sessionStatusVariant}
          size="sm"
        />
      </View>

      {/* Date/time */}
      <View className="flex-row items-center mb-2">
        <Ionicons name="calendar-outline" size={14} color="#8A8FA0" />
        <Text className="text-sm text-offwhite/60 ml-1.5">{dateTime}</Text>
      </View>

      {/* Court name */}
      {courtName && (
        <View className="flex-row items-center mb-2">
          <Ionicons name="location-outline" size={14} color="#8A8FA0" />
          <Text className="text-sm text-offwhite/60 ml-1.5">{courtName}</Text>
        </View>
      )}

      {/* Bottom row: participants + countdown (upcoming) or price */}
      <View className="flex-row items-center justify-between mt-1">
        <View className="flex-row items-center">
          <Ionicons name="people-outline" size={14} color="#8A8FA0" />
          <Text className="text-xs text-offwhite/50 ml-1">
            {participantCount}/{totalSpots} joined
          </Text>
        </View>

        {isUpcoming ? (
          <CountdownBadge
            startsAt={session.starts_at}
            endsAt={session.ends_at}
            status={session.status}
          />
        ) : (
          <Text className="text-sm font-semibold text-offwhite/60">
            {formatPrice(session.price_cents)}
          </Text>
        )}
      </View>

      {/* Booking status if reserved (not yet paid) */}
      {booking.status === 'reserved' && isUpcoming && (
        <View className="flex-row items-center mt-2 bg-accent/10 rounded-lg px-3 py-1.5">
          <Ionicons name="alert-circle" size={14} color="#D6B07A" />
          <Text className="text-xs font-medium text-accent ml-1.5">
            Payment pending - confirm to secure your spot
          </Text>
        </View>
      )}
    </Card>
  );
}
