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
      <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
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
      <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
          <Text className="text-lg font-semibold text-text mt-4 text-center">
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
    <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Session summary card */}
        <Animated.View
          entering={FadeInDown.delay(50).duration(300)}
          style={{ marginHorizontal: 20, marginTop: 16 }}
        >
          <View style={{ backgroundColor: '#131720', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 22, letterSpacing: 1, color: '#F0EDE6', lineHeight: 22, marginBottom: 6 }}>
                  {product.title}
                </Text>
                <Badge label={product.type.replace('_', ' ')} variant="info" size="sm" />
              </View>
              <View style={{ backgroundColor: 'rgba(232,201,122,0.1)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 22, color: '#E8C97A', lineHeight: 22 }}>
                  {formatPrice(session.price_cents)}
                </Text>
                <Text style={{ fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase', color: '#8A8FA0', marginTop: 2 }}>
                  per person
                </Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 14 }} />

            {/* Time details */}
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name="calendar-outline" size={15} color="#E8C97A" />
                <Text style={{ fontSize: 13, color: '#F0EDE6', marginLeft: 8 }}>
                  {format(startDate, 'EEEE, MMMM d, yyyy')}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: session.court ? 10 : 0 }}>
                <Ionicons name="time-outline" size={15} color="#E8C97A" />
                <Text style={{ fontSize: 13, color: '#8A8FA0', marginLeft: 8 }}>
                  {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                </Text>
              </View>
              {session.court && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="location-outline" size={15} color="#8A8FA0" />
                  <Text style={{ fontSize: 13, color: '#8A8FA0', marginLeft: 8 }}>{session.court.name}</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Capacity indicator */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(300)}
          style={{ marginHorizontal: 20, marginTop: 12 }}
        >
          <View style={{ backgroundColor: '#131720', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
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
          style={{ marginHorizontal: 20, marginTop: 12 }}
        >
          <View style={{ backgroundColor: '#131720', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
            <Text style={{ fontFamily: 'BarlowCondensed_700Bold', fontSize: 10, letterSpacing: 2.4, textTransform: 'uppercase', color: '#8A8FA0', marginBottom: 12 }}>
              Attendees
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 22, letterSpacing: 0.8, color: '#F0EDE6', lineHeight: 22 }}>
                  You + {guests} {guests === 1 ? 'guest' : 'guests'}
                </Text>
                <Text style={{ fontSize: 11, color: '#5A5F72', marginTop: 4 }}>
                  {session.spots_remaining} spots available
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable
                  onPress={handleGuestDecrement}
                  disabled={guests === 0}
                  style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: guests === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(232,201,122,0.12)',
                    opacity: pressed ? 0.7 : guests === 0 ? 0.4 : 1,
                  })}
                >
                  <Ionicons name="remove" size={18} color={guests === 0 ? '#5A5F72' : '#E8C97A'} />
                </Pressable>
                <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 26, color: '#F0EDE6', minWidth: 24, textAlign: 'center' }}>
                  {1 + guests}
                </Text>
                <Pressable
                  onPress={handleGuestIncrement}
                  style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#E8C97A',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Ionicons name="add" size={18} color="#0D0F14" />
                </Pressable>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Price summary */}
        <Animated.View
          entering={FadeInDown.delay(350).duration(300)}
          style={{ marginHorizontal: 20, marginTop: 12 }}
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
          style={{ marginHorizontal: 20, marginTop: 12, flexDirection: 'row', gap: 10 }}
        >
          <Pressable
            onPress={handleInviteFriends}
            style={({ pressed }: { pressed: boolean }): ViewStyle => ({
              flex: 1,
              backgroundColor: '#131720',
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="person-add-outline" size={16} color="#E8C97A" />
            <Text style={{ fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#E8C97A' }}>
              Invite Friends
            </Text>
          </Pressable>
          <Pressable
            onPress={handleAddExtras}
            style={({ pressed }: { pressed: boolean }): ViewStyle => ({
              flex: 1,
              backgroundColor: '#131720',
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.06)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="fast-food-outline" size={16} color="#E8C97A" />
            <Text style={{ fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', color: '#E8C97A' }}>
              Add Extras
            </Text>
          </Pressable>
        </Animated.View>

        {/* Membership upsell */}
        {!hasMembership && (
          <Animated.View
            entering={FadeInDown.delay(550).duration(300)}
            style={{ marginHorizontal: 20, marginTop: 12 }}
          >
            <Pressable
              onPress={() => router.push('/(tabs)/membership')}
              style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                backgroundColor: 'rgba(232,201,122,0.06)',
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: 'rgba(232,201,122,0.2)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 20 }}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'BarlowCondensed_700Bold', fontSize: 13, letterSpacing: 0.6, color: '#E8C97A', marginBottom: 2 }}>
                  Save up to 30% with a membership
                </Text>
                <Text style={{ fontSize: 11, color: '#5A5F72' }}>
                  Members get discounts on every booking
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#E8C97A" />
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <Animated.View
        entering={FadeInUp.delay(600).duration(400)}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#131720', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 34 }}
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
