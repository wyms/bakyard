import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { getProductById, getSessionsForProduct } from '@/lib/api/feed';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { getMyMembership } from '@/lib/api/memberships';
import { formatPrice } from '@/lib/utils/pricing';
import type { Session, Court } from '@/lib/types/database';

import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import TimeSlotPicker from '@/components/booking/TimeSlotPicker';
import CourtPicker from '@/components/booking/CourtPicker';

export default function SelectTimeScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const { setSession, selectedSessionId } = useBookingStore();

  const {
    data: product,
    isLoading: productLoading,
  } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProductById(productId),
    enabled: !!productId,
  });

  const {
    data: sessions,
    isLoading: sessionsLoading,
  } = useQuery({
    queryKey: ['sessions', productId],
    queryFn: () => getSessionsForProduct(productId),
    enabled: !!productId,
  });

  const { data: membership } = useQuery({
    queryKey: ['membership'],
    queryFn: getMyMembership,
  });

  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);

  // Extract unique courts from sessions
  const courts = useMemo(() => {
    if (!sessions) return [];

    const courtMap = new Map<string, Court>();
    sessions.forEach((s) => {
      if (s.court) {
        courtMap.set(s.court.id, s.court);
      }
    });
    return Array.from(courtMap.values()).sort(
      (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
    );
  }, [sessions]);

  // Filter sessions by selected court
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    if (!selectedCourtId) return sessions;
    return sessions.filter((s) => s.court_id === selectedCourtId);
  }, [sessions, selectedCourtId]);

  const handleSessionSelect = useCallback(
    (session: Session) => {
      setSelectedSession(session);
      setSession(session.id);
      // Auto-select the court if the session has one
      if (session.court_id) {
        setSelectedCourtId(session.court_id);
      }
    },
    [setSession]
  );

  const handleCourtSelect = useCallback(
    (courtId: string) => {
      setSelectedCourtId(courtId);
      // Clear selected session if it's not on this court
      if (selectedSession && selectedSession.court_id !== courtId) {
        setSelectedSession(null);
        setSession(null);
      }
    },
    [selectedSession, setSession]
  );

  const handleContinue = useCallback(() => {
    if (!selectedSession || !product) return;
    router.push({
      pathname: '/booking/confirm',
      params: {
        productId: product.id,
        sessionId: selectedSession.id,
      },
    });
  }, [selectedSession, product, router]);

  const isLoading = productLoading || sessionsLoading;
  const memberDiscount = membership?.discount_percent ?? 0;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
        <ScrollView className="flex-1 px-5 pt-4">
          <Skeleton width="60%" height={28} className="mb-2" />
          <Skeleton width="40%" height={20} className="mb-6" />
          <Skeleton width="100%" height={60} className="mb-4" />
          <Skeleton width="100%" height={60} className="mb-4" />
          <Skeleton width="100%" height={120} className="mb-4" />
          <Skeleton width="100%" height={100} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Product header */}
        {product && (
          <Animated.View
            entering={FadeInDown.delay(50).duration(300)}
            className="px-5 pt-4 pb-2"
          >
            <Text className="text-xl font-bold text-text">
              Book {product.title}
            </Text>
            {product.base_price_cents != null && (
              <Text className="text-sm text-text/60 mt-1">
                Starting at {formatPrice(product.base_price_cents)}
              </Text>
            )}
          </Animated.View>
        )}

        {/* Time slot picker */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(300)}
          className="px-5 mt-4"
        >
          <TimeSlotPicker
            sessions={filteredSessions}
            selectedSession={selectedSession}
            onSelect={handleSessionSelect}
            memberDiscountPercent={memberDiscount > 0 ? memberDiscount : undefined}
          />
        </Animated.View>

        {/* Court picker */}
        {courts.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(250).duration(300)}
            className="px-5 mt-6"
          >
            <CourtPicker
              courts={courts}
              selectedCourtId={selectedCourtId}
              onSelect={handleCourtSelect}
            />
          </Animated.View>
        )}

        {/* Selection summary */}
        {selectedSession && (
          <Animated.View
            entering={FadeInDown.delay(100).duration(300)}
            className="px-5 mt-6"
          >
            <View className="bg-surface rounded-2xl p-4 border border-stroke">
              <Text className="text-sm font-semibold text-text mb-2">
                Your Selection
              </Text>
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={16} color="#3F6F6A" />
                <Text className="text-sm text-text/80 ml-2">
                  {new Date(selectedSession.starts_at).toLocaleDateString(
                    'en-US',
                    { weekday: 'short', month: 'short', day: 'numeric' }
                  )}
                </Text>
              </View>
              <View className="flex-row items-center mt-1.5">
                <Ionicons name="cash-outline" size={16} color="#3F6F6A" />
                <Text className="text-sm text-text/80 ml-2">
                  {formatPrice(selectedSession.price_cents)} per person
                </Text>
              </View>
              {selectedSession.court && (
                <View className="flex-row items-center mt-1.5">
                  <Ionicons name="location-outline" size={16} color="#3F6F6A" />
                  <Text className="text-sm text-text/80 ml-2">
                    {selectedSession.court.name}
                  </Text>
                </View>
              )}
              <View className="flex-row items-center mt-1.5">
                <Ionicons name="people-outline" size={16} color="#3F6F6A" />
                <Text className="text-sm text-text/80 ml-2">
                  {selectedSession.spots_remaining} of{' '}
                  {selectedSession.spots_total} spots remaining
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Bottom actions row (matching d2.PNG) */}
        {selectedSession && (
          <Animated.View
            entering={FadeInDown.delay(200).duration(300)}
            className="px-5 mt-5"
          >
            <View className="flex-row gap-2">
              <Button
                title="Invite"
                variant="outline"
                size="sm"
                onPress={() => {}}
                icon={<Ionicons name="person-add-outline" size={16} color="#D6B07A" />}
                className="flex-1"
              />
              <Button
                title="Pay"
                variant="outline"
                size="sm"
                onPress={handleContinue}
                icon={<Ionicons name="card-outline" size={16} color="#D6B07A" />}
                className="flex-1"
              />
              <Button
                title="Add Time"
                variant="outline"
                size="sm"
                onPress={() => {}}
                icon={<Ionicons name="add-circle-outline" size={16} color="#D6B07A" />}
                className="flex-1"
              />
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(400)}
        className="absolute bottom-0 left-0 right-0 bg-surface border-t border-stroke px-5 py-4"
        style={{ paddingBottom: 34 }}
      >
        <Button
          title={selectedSession ? 'Continue' : 'Select a time slot'}
          variant="secondary"
          size="lg"
          onPress={handleContinue}
          disabled={!selectedSession}
          className="w-full"
        />
        {selectedSession && (
          <Text className="text-center text-xs text-text/40 mt-2">
            Keep going
          </Text>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}
