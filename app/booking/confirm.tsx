import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';

import { getProductById, getSessionsForProduct } from '@/lib/api/feed';
import { getMyMembership } from '@/lib/api/memberships';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { formatPrice, calculateDiscount } from '@/lib/utils/pricing';
import type { Session } from '@/lib/types/database';

import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import CapacityIndicator from '@/components/booking/CapacityIndicator';
import PriceSummary from '@/components/booking/PriceSummary';

export default function ConfirmBookingScreen() {
  const { productId, sessionId } = useLocalSearchParams<{
    productId: string;
    sessionId: string;
  }>();
  const router = useRouter();
  const { guests, setGuests, extras } = useBookingStore();

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProductById(productId),
    enabled: !!productId,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', productId],
    queryFn: () => getSessionsForProduct(productId),
    enabled: !!productId,
  });

  const { data: membership } = useQuery({
    queryKey: ['membership'],
    queryFn: getMyMembership,
  });

  const session = useMemo(() => {
    if (!sessions || !sessionId) return null;
    return sessions.find((s) => s.id === sessionId) ?? null;
  }, [sessions, sessionId]);

  const hasMembership = !!membership && membership.status === 'active';
  const discountPercent = membership?.discount_percent ?? 0;

  const discountCentsPerPerson = useMemo(() => {
    if (!session || !hasMembership) return 0;
    const fullPrice = session.price_cents;
    const discountedPrice = calculateDiscount(fullPrice, discountPercent);
    return fullPrice - discountedPrice;
  }, [session, hasMembership, discountPercent]);

  const handleGuestIncrement = useCallback(() => {
    if (!session) return;
    const maxGuests = session.spots_remaining - 1; // minus the booker
    if (guests < maxGuests) {
      setGuests(guests + 1);
    } else {
      Alert.alert(
        'No more spots',
        `Only ${session.spots_remaining} total spots remaining.`
      );
    }
  }, [guests, session, setGuests]);

  const handleGuestDecrement = useCallback(() => {
    if (guests > 0) {
      setGuests(guests - 1);
    }
  }, [guests, setGuests]);

  const handleInviteFriends = useCallback(() => {
    // Future: implement share/invite flow
    Alert.alert(
      'Invite Friends',
      'Share a link so your friends can join this session.',
      [{ text: 'OK' }]
    );
  }, []);

  const handleAddExtras = useCallback(() => {
    if (!product || !session) return;
    router.push({
      pathname: '/booking/extras',
      params: { productId: product.id, sessionId: session.id },
    });
  }, [product, session, router]);

  const handleProceedToPayment = useCallback(() => {
    if (!product || !session) return;
    router.push({
      pathname: '/booking/payment',
      params: { productId: product.id, sessionId: session.id },
    });
  }, [product, session, router]);

  const isLoading = productLoading || sessionsLoading;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAFAF8]" edges={['bottom']}>
        <ScrollView className="flex-1 px-5 pt-4">
          <Skeleton width="70%" height={28} className="mb-3" />
          <Skeleton width="100%" height={80} className="mb-4" />
          <Skeleton width="100%" height={60} className="mb-4" />
          <Skeleton width="100%" height={120} className="mb-4" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!session || !product) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAFAF8]" edges={['bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
          <Text className="text-lg font-semibold text-[#2D2D2D] mt-4 text-center">
            Session not found
          </Text>
          <Button
            title="Go Back"
            variant="outline"
            size="sm"
            onPress={() => router.back()}
            className="mt-6"
          />
        </View>
      </SafeAreaView>
    );
  }

  const startDate = parseISO(session.starts_at);
  const endDate = parseISO(session.ends_at);

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF8]" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Session summary card */}
        <Animated.View
          entering={FadeInDown.delay(50).duration(300)}
          className="mx-5 mt-4"
        >
          <View className="bg-white rounded-2xl p-5 border border-[#E8E5E0]">
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="text-xl font-bold text-[#2D2D2D]">
                  {product.title}
                </Text>
                <View className="mt-1">
                  <Badge
                    label={product.type.replace('_', ' ')}
                    variant="info"
                    size="sm"
                  />
                </View>
              </View>
              <View className="bg-[#1A5E63]/10 rounded-xl px-3 py-2 items-center">
                <Text className="text-lg font-bold text-[#1A5E63]">
                  {formatPrice(session.price_cents)}
                </Text>
                <Text className="text-[10px] text-[#1A5E63]/70 font-medium">
                  per person
                </Text>
              </View>
            </View>

            {/* Time details */}
            <View className="mt-4 pt-4 border-t border-[#E8E5E0]">
              <View className="flex-row items-center mb-2">
                <Ionicons name="calendar-outline" size={18} color="#1A5E63" />
                <Text className="text-sm font-medium text-[#2D2D2D] ml-2">
                  {format(startDate, 'EEEE, MMMM d, yyyy')}
                </Text>
              </View>
              <View className="flex-row items-center mb-2">
                <Ionicons name="time-outline" size={18} color="#1A5E63" />
                <Text className="text-sm text-[#2D2D2D]/80 ml-2">
                  {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                </Text>
              </View>
              {session.court && (
                <View className="flex-row items-center">
                  <Ionicons name="location-outline" size={18} color="#1A5E63" />
                  <Text className="text-sm text-[#2D2D2D]/80 ml-2">
                    {session.court.name}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Capacity indicator */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(300)}
          className="mx-5 mt-4"
        >
          <View className="bg-white rounded-2xl p-4 border border-[#E8E5E0]">
            <CapacityIndicator
              total={session.spots_total}
              remaining={session.spots_remaining}
              size="md"
            />
          </View>
        </Animated.View>

        {/* Guest count selector */}
        <Animated.View
          entering={FadeInDown.delay(250).duration(300)}
          className="mx-5 mt-4"
        >
          <View className="bg-white rounded-2xl p-4 border border-[#E8E5E0]">
            <Text className="text-base font-semibold text-[#2D2D2D] mb-3">
              How many people?
            </Text>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm text-[#2D2D2D]/70">
                  You + {guests} {guests === 1 ? 'guest' : 'guests'}
                </Text>
                <Text className="text-xs text-[#2D2D2D]/40 mt-0.5">
                  {session.spots_remaining} spots available
                </Text>
              </View>
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={handleGuestDecrement}
                  disabled={guests === 0}
                  className={[
                    'w-10 h-10 rounded-full items-center justify-center',
                    guests === 0
                      ? 'bg-gray-100'
                      : 'bg-[#1A5E63]/10',
                  ].join(' ')}
                  style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                    opacity: pressed ? 0.7 : guests === 0 ? 0.4 : 1,
                  })}
                >
                  <Ionicons
                    name="remove"
                    size={20}
                    color={guests === 0 ? '#CCC' : '#1A5E63'}
                  />
                </Pressable>
                <Text className="text-xl font-bold text-[#2D2D2D] min-w-[24px] text-center">
                  {1 + guests}
                </Text>
                <Pressable
                  onPress={handleGuestIncrement}
                  className="w-10 h-10 rounded-full items-center justify-center bg-[#1A5E63]/10"
                  style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Ionicons name="add" size={20} color="#1A5E63" />
                </Pressable>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Price summary */}
        <Animated.View
          entering={FadeInDown.delay(350).duration(300)}
          className="mx-5 mt-4"
        >
          <PriceSummary
            priceCents={session.price_cents}
            discountCents={discountCentsPerPerson}
            membershipActive={hasMembership}
            guests={guests}
            extras={extras.map((e) => ({
              name: e.name,
              priceCents: e.price_cents,
              quantity: e.quantity,
            }))}
          />
        </Animated.View>

        {/* Action links */}
        <Animated.View
          entering={FadeInDown.delay(450).duration(300)}
          className="mx-5 mt-4"
        >
          <View className="flex-row gap-3">
            <Pressable
              onPress={handleInviteFriends}
              className="flex-1 bg-white rounded-2xl p-4 border border-[#E8E5E0] flex-row items-center justify-center"
              style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name="person-add-outline" size={18} color="#1A5E63" />
              <Text className="text-sm font-medium text-[#1A5E63] ml-2">
                Invite Friends
              </Text>
            </Pressable>
            <Pressable
              onPress={handleAddExtras}
              className="flex-1 bg-white rounded-2xl p-4 border border-[#E8E5E0] flex-row items-center justify-center"
              style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name="fast-food-outline" size={18} color="#D4A574" />
              <Text className="text-sm font-medium text-[#D4A574] ml-2">
                Add Extras
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Membership upsell */}
        {!hasMembership && (
          <Animated.View
            entering={FadeInDown.delay(550).duration(300)}
            className="mx-5 mt-4"
          >
            <Pressable
              onPress={() => router.push('/(tabs)/membership')}
              className="bg-[#D4A574]/10 rounded-2xl p-4 border border-[#D4A574]/30 flex-row items-center"
              style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="star" size={24} color="#D4A574" />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-[#2D2D2D]">
                  Save up to 30% with a membership
                </Text>
                <Text className="text-xs text-[#2D2D2D]/50 mt-0.5">
                  Members get discounts on every booking
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D4A574" />
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <Animated.View
        entering={FadeInUp.delay(600).duration(400)}
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E8E5E0] px-5 py-4"
        style={{ paddingBottom: 34 }}
      >
        <Button
          title="Pay"
          variant="secondary"
          size="lg"
          onPress={handleProceedToPayment}
          icon={<Ionicons name="card-outline" size={20} color="#FFFFFF" />}
          className="w-full"
        />
      </Animated.View>
    </SafeAreaView>
  );
}
