import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { supabase } from '@/lib/supabase';
import { getProductById } from '@/lib/api/feed';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { formatPrice } from '@/lib/utils/pricing';
import type { Product } from '@/lib/types/database';

import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';

interface ExtraItem {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  icon: keyof typeof Ionicons.glyphMap;
}

// Fetch food/drink add-on products from the database
async function getExtrasProducts(): Promise<ExtraItem[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('type', 'food_addon')
    .eq('is_active', true)
    .order('title', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((p: Product) => ({
    id: p.id,
    name: p.title,
    description: p.description ?? '',
    price_cents: p.base_price_cents ?? 0,
    icon: getExtraIcon(p.title),
  }));
}

function getExtraIcon(name: string): keyof typeof Ionicons.glyphMap {
  const lower = name.toLowerCase();
  if (lower.includes('water') || lower.includes('drink')) return 'water-outline';
  if (lower.includes('beer') || lower.includes('alcohol')) return 'beer-outline';
  if (lower.includes('coffee')) return 'cafe-outline';
  if (lower.includes('snack') || lower.includes('chip')) return 'nutrition-outline';
  if (lower.includes('towel')) return 'shirt-outline';
  if (lower.includes('sunscreen') || lower.includes('sun')) return 'sunny-outline';
  return 'fast-food-outline';
}

interface ExtraCardProps {
  item: ExtraItem;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  index: number;
}

function ExtraCard({
  item,
  quantity,
  onIncrement,
  onDecrement,
  index,
}: ExtraCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80).duration(300)}
    >
      <View className="bg-surface rounded-2xl p-4 border border-stroke flex-row items-center">
        {/* Icon */}
        <View className="w-12 h-12 rounded-xl bg-accent/10 items-center justify-center">
          <Ionicons name={item.icon} size={22} color="#D6B07A" />
        </View>

        {/* Info */}
        <View className="flex-1 ml-3">
          <Text className="text-sm font-semibold text-text">
            {item.name}
          </Text>
          {item.description ? (
            <Text
              className="text-xs text-text/50 mt-0.5"
              numberOfLines={1}
            >
              {item.description}
            </Text>
          ) : null}
          <Text className="text-sm font-bold text-primary mt-1">
            {formatPrice(item.price_cents)}
          </Text>
        </View>

        {/* Quantity controls */}
        <View className="flex-row items-center gap-2">
          {quantity > 0 && (
            <>
              <Pressable
                onPress={onDecrement}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
                style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="remove" size={16} color="#111827" />
              </Pressable>
              <Text className="text-base font-bold text-text min-w-[20px] text-center">
                {quantity}
              </Text>
            </>
          )}
          <Pressable
            onPress={onIncrement}
            className={[
              'w-8 h-8 rounded-full items-center justify-center',
              quantity > 0 ? 'bg-primary/10' : 'bg-primary',
            ].join(' ')}
            style={({ pressed }: { pressed: boolean }): ViewStyle => ({
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons
              name="add"
              size={16}
              color={quantity > 0 ? '#3F6F6A' : '#FFFFFF'}
            />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export default function ExtrasScreen() {
  const { productId, sessionId } = useLocalSearchParams<{
    productId: string;
    sessionId: string;
  }>();
  const router = useRouter();
  const { extras, addExtra, removeExtra } = useBookingStore();

  const { data: product } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProductById(productId),
    enabled: !!productId,
  });

  const {
    data: extrasProducts,
    isLoading: extrasLoading,
  } = useQuery({
    queryKey: ['extras-products'],
    queryFn: getExtrasProducts,
  });

  // Track local quantities (initialized from store)
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {};
    extras.forEach((e) => {
      q[e.id] = e.quantity;
    });
    return q;
  });

  const handleIncrement = useCallback(
    (item: ExtraItem) => {
      const current = quantities[item.id] ?? 0;
      const newQty = current + 1;
      setQuantities((prev) => ({ ...prev, [item.id]: newQty }));
      addExtra({
        id: item.id,
        name: item.name,
        price_cents: item.price_cents,
        quantity: 1,
      });
    },
    [quantities, addExtra]
  );

  const handleDecrement = useCallback(
    (item: ExtraItem) => {
      const current = quantities[item.id] ?? 0;
      if (current <= 1) {
        setQuantities((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        removeExtra(item.id);
      } else {
        setQuantities((prev) => ({ ...prev, [item.id]: current - 1 }));
        // The store addExtra with negative quantity won't work, so we remove and re-add
        removeExtra(item.id);
        addExtra({
          id: item.id,
          name: item.name,
          price_cents: item.price_cents,
          quantity: current - 1,
        });
      }
    },
    [quantities, addExtra, removeExtra]
  );

  const runningTotal = useMemo(() => {
    return Object.entries(quantities).reduce((sum, [id, qty]) => {
      const item = extrasProducts?.find((e) => e.id === id);
      return sum + (item?.price_cents ?? 0) * qty;
    }, 0);
  }, [quantities, extrasProducts]);

  const itemCount = useMemo(() => {
    return Object.values(quantities).reduce((sum, qty) => sum + qty, 0);
  }, [quantities]);

  const handleContinue = useCallback(() => {
    router.push({
      pathname: '/booking/payment',
      params: { productId, sessionId },
    });
  }, [router, productId, sessionId]);

  const handleSkip = useCallback(() => {
    router.push({
      pathname: '/booking/payment',
      params: { productId, sessionId },
    });
  }, [router, productId, sessionId]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(50).duration(300)}
          className="px-5 pt-4"
        >
          <Text className="text-xl font-bold text-text">
            Add Extras
          </Text>
          <Text className="text-sm text-text/50 mt-1">
            Grab some food, drinks, or gear for your session
          </Text>
        </Animated.View>

        {/* Extras list */}
        <View className="px-5 mt-5 gap-3">
          {extrasLoading ? (
            <>
              <Skeleton width="100%" height={80} borderRadius={16} />
              <Skeleton width="100%" height={80} borderRadius={16} />
              <Skeleton width="100%" height={80} borderRadius={16} />
            </>
          ) : extrasProducts && extrasProducts.length > 0 ? (
            extrasProducts.map((item, index) => (
              <ExtraCard
                key={item.id}
                item={item}
                quantity={quantities[item.id] ?? 0}
                onIncrement={() => handleIncrement(item)}
                onDecrement={() => handleDecrement(item)}
                index={index}
              />
            ))
          ) : (
            <Animated.View
              entering={FadeInDown.delay(100).duration(300)}
            >
              <View className="bg-surface rounded-2xl p-6 items-center border border-stroke">
                <Ionicons name="restaurant-outline" size={36} color="#6B7280" />
                <Text className="text-sm text-text/40 mt-3 text-center">
                  No extras available right now
                </Text>
              </View>
            </Animated.View>
          )}
        </View>

        {/* Running total */}
        {itemCount > 0 && (
          <Animated.View
            entering={FadeInDown.delay(100).duration(250)}
            className="mx-5 mt-5"
          >
            <View className="bg-primary/5 rounded-2xl p-4 flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Ionicons name="cart-outline" size={20} color="#3F6F6A" />
                <Text className="text-sm font-medium text-primary ml-2">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'} added
                </Text>
              </View>
              <Text className="text-base font-bold text-primary">
                +{formatPrice(runningTotal)}
              </Text>
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
          title={
            itemCount > 0
              ? `Continue to Payment (+${formatPrice(runningTotal)})`
              : 'Continue to Payment'
          }
          variant="secondary"
          size="lg"
          onPress={handleContinue}
          className="w-full"
        />
        {itemCount === 0 && (
          <Pressable onPress={handleSkip} className="mt-2 py-2">
            <Text className="text-center text-sm text-text/40 font-medium">
              Skip extras
            </Text>
          </Pressable>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}
