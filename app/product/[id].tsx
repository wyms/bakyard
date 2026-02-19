import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { useProduct } from '@/lib/hooks/useFeed';
import { getSessionsForProduct, logInteraction } from '@/lib/api/feed';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { formatPrice } from '@/lib/utils/pricing';
import type { ProductType, Session } from '@/lib/types/database';
import Badge from '@/components/ui/Badge';
import Skeleton from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import TimeSlotPicker from '@/components/booking/TimeSlotPicker';

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  court_rental: 'Court Rental',
  open_play: 'Open Play',
  coaching: 'Coaching',
  clinic: 'Clinic',
  tournament: 'Tournament',
  community_day: 'Community Day',
  food_addon: 'Add-On',
};

const PRODUCT_TYPE_VARIANTS: Record<
  ProductType,
  'default' | 'success' | 'warning' | 'info' | 'accent'
> = {
  court_rental: 'default',
  open_play: 'info',
  coaching: 'accent',
  clinic: 'warning',
  tournament: 'accent',
  community_day: 'success',
  food_addon: 'default',
};

const PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&h=500&fit=crop';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { setSession } = useBookingStore();

  const {
    data: product,
    isLoading: productLoading,
    error: productError,
  } = useProduct(id);

  const {
    data: sessions,
    isLoading: sessionsLoading,
  } = useQuery({
    queryKey: ['sessions', id],
    queryFn: () => getSessionsForProduct(id),
    enabled: !!id,
  });

  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Log view interaction on mount
  useEffect(() => {
    if (id) {
      logInteraction(id, 'view').catch(() => {
        // Non-critical, ignore errors
      });
    }
  }, [id]);

  const handleSessionSelect = useCallback(
    (session: Session) => {
      setSelectedSession(session);
      setSession(session.id);
    },
    [setSession]
  );

  const handleBookNow = useCallback(() => {
    if (!selectedSession || !product) return;

    logInteraction(product.id, 'tap').catch(() => {});

    if (product.type === 'court_rental') {
      router.push({
        pathname: '/booking/select-time',
        params: { productId: product.id },
      });
    } else {
      router.push({
        pathname: '/booking/confirm',
        params: { productId: product.id, sessionId: selectedSession.id },
      });
    }
  }, [selectedSession, product, router]);

  const priceDisplay = useMemo(() => {
    if (!product?.base_price_cents) return null;
    const price = formatPrice(product.base_price_cents);
    switch (product.type) {
      case 'court_rental':
        return `${price}/hr`;
      case 'coaching':
        return `${price}/session`;
      default:
        return `${price}/person`;
    }
  }, [product]);

  // Loading state
  if (productLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAFAF8]" edges={['bottom']}>
        <ScrollView className="flex-1">
          <Skeleton width="100%" height={250} borderRadius={0} />
          <View className="px-5 pt-4">
            <Skeleton width="70%" height={28} className="mb-3" />
            <Skeleton width="40%" height={20} className="mb-4" />
            <Skeleton width="100%" height={60} className="mb-4" />
            <Skeleton width="100%" height={120} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Error state
  if (productError || !product) {
    return (
      <SafeAreaView className="flex-1 bg-[#FAFAF8]" edges={['bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#FF6B6B" />
          <Text className="text-lg font-semibold text-[#2D2D2D] mt-4 text-center">
            Could not load product
          </Text>
          <Text className="text-sm text-[#2D2D2D]/50 mt-2 text-center">
            {productError?.message ?? 'Product not found'}
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

  const imageUri = product.image_url || PLACEHOLDER_IMAGE;

  return (
    <SafeAreaView className="flex-1 bg-[#FAFAF8]" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        <Animated.View entering={FadeIn.duration(400)}>
          <View className="relative">
            <Image
              source={{ uri: imageUri }}
              className="w-full"
              style={{ height: 250 }}
              resizeMode="cover"
            />
            {/* Gradient overlay at bottom */}
            <View
              className="absolute bottom-0 left-0 right-0 h-20"
              style={{
                backgroundColor: 'transparent',
              }}
            />
            {/* Type badge */}
            <View className="absolute top-4 left-4">
              <Badge
                label={PRODUCT_TYPE_LABELS[product.type]}
                variant={PRODUCT_TYPE_VARIANTS[product.type]}
              />
            </View>
            {/* Price badge */}
            {priceDisplay && (
              <View className="absolute bottom-4 right-4 bg-white/90 rounded-full px-4 py-2 shadow-sm">
                <Text className="text-base font-bold text-[#2D2D2D]">
                  {priceDisplay}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Content */}
        <View className="px-5 pt-5">
          {/* Title */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <Text className="text-2xl font-bold text-[#2D2D2D]">
              {product.title}
            </Text>
          </Animated.View>

          {/* Meta info row */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(350)}
            className="flex-row items-center mt-2.5 flex-wrap gap-3"
          >
            {product.duration_minutes && (
              <View className="flex-row items-center">
                <Ionicons name="time-outline" size={16} color="#7A7A7A" />
                <Text className="text-sm text-[#2D2D2D]/60 ml-1">
                  {product.duration_minutes} min
                </Text>
              </View>
            )}
            {product.capacity && (
              <View className="flex-row items-center">
                <Ionicons name="people-outline" size={16} color="#7A7A7A" />
                <Text className="text-sm text-[#2D2D2D]/60 ml-1">
                  Up to {product.capacity} players
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Description */}
          {product.description && (
            <Animated.View entering={FadeInDown.delay(200).duration(350)}>
              <Text className="text-sm text-[#2D2D2D]/70 mt-4 leading-5">
                {product.description}
              </Text>
            </Animated.View>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(250).duration(350)}
              className="flex-row flex-wrap mt-4 gap-2"
            >
              {product.tags.map((tag) => (
                <View
                  key={tag}
                  className="bg-[#D4A574]/10 rounded-full px-3 py-1"
                >
                  <Text className="text-xs text-[#B8874E] font-medium">
                    {tag}
                  </Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Coach info - if coaching product */}
          {product.type === 'coaching' && product.coach_id && (
            <Animated.View entering={FadeInDown.delay(300).duration(350)}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/coach/[id]',
                    params: { id: product.coach_id! },
                  })
                }
                className="mt-5 bg-white rounded-2xl p-4 flex-row items-center border border-[#E8E5E0]"
                style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View className="w-12 h-12 rounded-full bg-[#1A5E63] items-center justify-center">
                  <Ionicons name="person" size={20} color="#FFFFFF" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold text-[#2D2D2D]">
                    View Coach Profile
                  </Text>
                  <Text className="text-xs text-[#2D2D2D]/50 mt-0.5">
                    Tap to see bio, certifications & ratings
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#2D2D2D" />
              </Pressable>
            </Animated.View>
          )}

          {/* Available Sessions */}
          <Animated.View
            entering={FadeInDown.delay(350).duration(350)}
            className="mt-6"
          >
            <Text className="text-lg font-bold text-[#2D2D2D] mb-4">
              Available Sessions
            </Text>

            {sessionsLoading ? (
              <View className="gap-2">
                <Skeleton width="100%" height={60} borderRadius={16} />
                <Skeleton width="100%" height={60} borderRadius={16} />
              </View>
            ) : sessions && sessions.length > 0 ? (
              <TimeSlotPicker
                sessions={sessions}
                selectedSession={selectedSession}
                onSelect={handleSessionSelect}
              />
            ) : (
              <View className="bg-white rounded-2xl p-6 items-center border border-[#E8E5E0]">
                <Ionicons name="calendar-outline" size={32} color="#E8E5E0" />
                <Text className="text-sm text-[#2D2D2D]/40 mt-2">
                  No upcoming sessions available
                </Text>
              </View>
            )}
          </Animated.View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <Animated.View
        entering={FadeInUp.delay(500).duration(400)}
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E8E5E0] px-5 py-4"
        style={{ paddingBottom: 34 }}
      >
        <Button
          title={selectedSession ? 'Book Now' : 'Select a Time to Book'}
          variant="secondary"
          size="lg"
          onPress={handleBookNow}
          disabled={!selectedSession}
          className="w-full"
        />
      </Animated.View>
    </SafeAreaView>
  );
}
