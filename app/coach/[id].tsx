import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  type ViewStyle,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { getCoachProfile, getCoachSessions } from '@/lib/api/coaches';
import { formatPrice } from '@/lib/utils/pricing';
import type { Session } from '@/lib/types/database';

import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';

// ---- Star rating component ----

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <View className="flex-row items-center">
      {Array.from({ length: fullStars }).map((_, i) => (
        <Ionicons key={`full-${i}`} name="star" size={18} color="#D4A574" />
      ))}
      {hasHalf && <Ionicons name="star-half" size={18} color="#D4A574" />}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <Ionicons key={`empty-${i}`} name="star-outline" size={18} color="#D4A574" />
      ))}
    </View>
  );
}

// ---- Session card component ----

interface SessionCardProps {
  session: Session;
  onPress: () => void;
}

function SessionCard({ session, onPress }: SessionCardProps) {
  const start = parseISO(session.starts_at);
  const end = parseISO(session.ends_at);
  const dateLabel = format(start, 'EEE, MMM d');
  const timeLabel = `${format(start, 'h:mm')} \u2013 ${format(end, 'h:mm a')}`;
  const spotsOpen = session.spots_remaining > 0;

  return (
    <Card onPress={onPress} className="mb-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-[#2D2D2D]">
            {session.product?.title ?? 'Session'}
          </Text>
          <View className="flex-row items-center mt-1.5">
            <Ionicons name="calendar-outline" size={14} color="#7A7A7A" />
            <Text className="text-sm text-[#2D2D2D]/60 ml-1">{dateLabel}</Text>
          </View>
          <View className="flex-row items-center mt-1">
            <Ionicons name="time-outline" size={14} color="#7A7A7A" />
            <Text className="text-sm text-[#2D2D2D]/60 ml-1">{timeLabel}</Text>
          </View>
          {session.court && (
            <View className="flex-row items-center mt-1">
              <Ionicons name="location-outline" size={14} color="#7A7A7A" />
              <Text className="text-sm text-[#2D2D2D]/60 ml-1">
                {session.court.name}
              </Text>
            </View>
          )}
        </View>
        <View className="items-end">
          <Text className="text-base font-bold text-[#2D2D2D]">
            {formatPrice(session.price_cents)}
          </Text>
          <Badge
            label={
              spotsOpen
                ? `${session.spots_remaining} spot${session.spots_remaining === 1 ? '' : 's'}`
                : 'Full'
            }
            variant={spotsOpen ? 'success' : 'warning'}
            size="sm"
          />
        </View>
      </View>
    </Card>
  );
}

// ---- Main screen ----

export default function CoachProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sessionsRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);

  const {
    data: coach,
    isLoading: coachLoading,
    isError: coachError,
    error: coachErrorObj,
    refetch: refetchCoach,
  } = useQuery({
    queryKey: ['coach', id],
    queryFn: () => getCoachProfile(id),
    enabled: !!id,
  });

  const {
    data: sessions,
    isLoading: sessionsLoading,
    refetch: refetchSessions,
  } = useQuery({
    queryKey: ['coach-sessions', id],
    queryFn: () => getCoachSessions(id),
    enabled: !!id,
  });

  const handleRetry = useCallback(() => {
    refetchCoach();
    refetchSessions();
  }, [refetchCoach, refetchSessions]);

  const handleSessionPress = useCallback(
    (session: Session) => {
      if (session.product) {
        router.push({
          pathname: '/product/[id]',
          params: { id: session.product.id },
        });
      }
    },
    [router],
  );

  const handleBookCTA = useCallback(() => {
    // If there are upcoming sessions with spots, scroll to the sessions section
    const availableSessions = sessions?.filter((s) => s.spots_remaining > 0);
    if (availableSessions && availableSessions.length > 0 && availableSessions[0].product) {
      router.push({
        pathname: '/product/[id]',
        params: { id: availableSessions[0].product.id },
      });
    } else {
      // Scroll to sessions area as a fallback
      sessionsRef.current?.measureLayout(
        scrollRef.current?.getScrollableNode?.() as any,
        (_x: number, y: number) => {
          scrollRef.current?.scrollTo({ y, animated: true });
        },
        () => {},
      );
    }
  }, [sessions, router]);

  // ---- Loading state ----
  if (coachLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAFAF8]" edges={['bottom']}>
        {/* Header skeleton */}
        <View className="flex-row items-center px-5 py-3">
          <Skeleton width={36} height={36} borderRadius={18} />
          <Skeleton width={120} height={22} borderRadius={6} className="ml-3" />
        </View>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View className="items-center mt-4">
            <Skeleton width={96} height={96} borderRadius={48} />
            <Skeleton width={160} height={24} borderRadius={6} className="mt-4" />
            <Skeleton width={100} height={18} borderRadius={6} className="mt-2" />
          </View>
          {/* Certifications */}
          <View className="flex-row justify-center mt-4 gap-2 px-5">
            <Skeleton width={80} height={28} borderRadius={14} />
            <Skeleton width={100} height={28} borderRadius={14} />
          </View>
          {/* Bio */}
          <View className="px-5 mt-6">
            <Skeleton width="100%" height={60} borderRadius={12} />
          </View>
          {/* Stats */}
          <View className="flex-row justify-around mx-5 mt-6">
            <Skeleton width={80} height={60} borderRadius={12} />
            <Skeleton width={80} height={60} borderRadius={12} />
            <Skeleton width={80} height={60} borderRadius={12} />
          </View>
          {/* Sessions */}
          <View className="px-5 mt-6">
            <Skeleton width={160} height={22} borderRadius={6} className="mb-4" />
            <Skeleton width="100%" height={100} borderRadius={16} className="mb-3" />
            <Skeleton width="100%" height={100} borderRadius={16} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- Error state ----
  if (coachError || !coach) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAFAF8]" edges={['bottom']}>
        <View className="flex-row items-center px-5 py-3">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-white items-center justify-center border border-[#E8E5E0]"
          >
            <Ionicons name="chevron-back" size={20} color="#2D2D2D" />
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
          <Text className="text-lg font-semibold text-[#2D2D2D] mt-4 text-center">
            Could not load coach profile
          </Text>
          <Text className="text-sm text-[#2D2D2D]/50 mt-2 text-center">
            {coachErrorObj?.message ?? 'Coach not found or no longer active.'}
          </Text>
          <Button
            title="Try Again"
            variant="outline"
            size="sm"
            onPress={handleRetry}
            className="mt-6"
          />
        </View>
      </SafeAreaView>
    );
  }

  // ---- Derived data ----
  const coachName = coach.user?.full_name ?? 'Coach';
  const certifications = coach.certifications ?? [];
  const upcomingSessions = sessions ?? [];
  const upcomingCount = upcomingSessions.length;
  const hasAvailableSessions = upcomingSessions.some((s) => s.spots_remaining > 0);

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF8]" edges={['bottom']}>
      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(300)}
        className="flex-row items-center px-5 py-3"
      >
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-white items-center justify-center border border-[#E8E5E0]"
          style={({ pressed }: { pressed: boolean }): ViewStyle => ({
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="chevron-back" size={20} color="#2D2D2D" />
        </Pressable>
        <Text className="text-lg font-bold text-[#2D2D2D] ml-3">
          Coach Profile
        </Text>
      </Animated.View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Coach Info Section */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(350)}
          className="items-center pt-4 pb-2 px-5"
        >
          {/* Large centered avatar */}
          <View className="shadow-md shadow-black/10">
            <Avatar
              uri={coach.user?.avatar_url}
              name={coachName}
              size="lg"
            />
          </View>

          {/* Name */}
          <Text className="text-2xl font-bold text-[#2D2D2D] mt-4">
            {coachName}
          </Text>

          {/* Rating stars */}
          {coach.rating != null && (
            <View className="flex-row items-center mt-2">
              <StarRating rating={coach.rating} />
              <Text className="text-sm text-[#2D2D2D]/60 ml-2">
                {coach.rating.toFixed(1)}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Certification badges */}
        {certifications.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(150).duration(350)}
            className="flex-row flex-wrap justify-center gap-2 px-5 mt-3"
          >
            {certifications.map((cert) => (
              <Badge key={cert} label={cert} variant="info" size="sm" />
            ))}
          </Animated.View>
        )}

        {/* Bio */}
        {coach.bio && (
          <Animated.View
            entering={FadeInDown.delay(200).duration(350)}
            className="px-5 mt-5"
          >
            <Text className="text-sm text-[#2D2D2D]/70 leading-5 text-center">
              {coach.bio}
            </Text>
          </Animated.View>
        )}

        {/* Stats Row */}
        <Animated.View
          entering={FadeInDown.delay(250).duration(350)}
          className="flex-row justify-around mx-5 mt-6 bg-white rounded-2xl py-4 px-2 border border-[#E8E5E0]"
        >
          {/* Hourly Rate */}
          <View className="items-center flex-1">
            <Ionicons name="cash-outline" size={20} color="#1A5E63" />
            <Text className="text-lg font-bold text-[#2D2D2D] mt-1">
              {coach.hourly_rate_cents
                ? formatPrice(coach.hourly_rate_cents).replace('.00', '')
                : '--'}
            </Text>
            <Text className="text-xs text-[#2D2D2D]/50">per hour</Text>
          </View>

          {/* Divider */}
          <View className="w-px bg-[#E8E5E0]" />

          {/* Upcoming Sessions */}
          <View className="items-center flex-1">
            <Ionicons name="calendar-outline" size={20} color="#1A5E63" />
            <Text className="text-lg font-bold text-[#2D2D2D] mt-1">
              {sessionsLoading ? '--' : upcomingCount}
            </Text>
            <Text className="text-xs text-[#2D2D2D]/50">upcoming</Text>
          </View>

          {/* Divider */}
          <View className="w-px bg-[#E8E5E0]" />

          {/* Rating */}
          <View className="items-center flex-1">
            <Ionicons name="star" size={20} color="#D4A574" />
            <Text className="text-lg font-bold text-[#2D2D2D] mt-1">
              {coach.rating != null ? coach.rating.toFixed(1) : '--'}
            </Text>
            <Text className="text-xs text-[#2D2D2D]/50">rating</Text>
          </View>
        </Animated.View>

        {/* Upcoming Sessions */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(350)}
          className="mt-6 px-5"
        >
          <View ref={sessionsRef}>
            <Text className="text-lg font-bold text-[#2D2D2D] mb-4">
              Upcoming Sessions
            </Text>
          </View>

          {sessionsLoading ? (
            <View>
              <Skeleton width="100%" height={100} borderRadius={16} className="mb-3" />
              <Skeleton width="100%" height={100} borderRadius={16} />
            </View>
          ) : upcomingSessions.length > 0 ? (
            upcomingSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onPress={() => handleSessionPress(session)}
              />
            ))
          ) : (
            <View className="bg-white rounded-2xl p-6 items-center border border-[#E8E5E0]">
              <Ionicons name="calendar-outline" size={32} color="#E8E5E0" />
              <Text className="text-sm text-[#2D2D2D]/40 mt-2 text-center">
                No upcoming sessions scheduled
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Bottom CTA */}
      <Animated.View
        entering={FadeInUp.delay(500).duration(400)}
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E8E5E0] px-5 py-4"
        style={{ paddingBottom: 34 }}
      >
        <Button
          title="Book a Session"
          variant="secondary"
          size="lg"
          onPress={handleBookCTA}
          disabled={!hasAvailableSessions && !sessionsLoading}
          className="w-full"
          icon={
            <Ionicons name="calendar" size={18} color="#FFFFFF" />
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}
