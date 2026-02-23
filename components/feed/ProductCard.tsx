import React from 'react';
import { View, Text, Image, Pressable, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Badge from '@/components/ui/Badge';
import { formatPrice } from '@/lib/utils/pricing';
import { formatRelativeTime } from '@/lib/utils/dates';
import type { Product, Session, ProductType } from '@/lib/types/database';

interface ProductCardProps {
  product: Product;
  nextSession?: Session | null;
}

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  court_rental: 'Court Rental',
  open_play: 'Open Play',
  coaching: 'Coaching',
  clinic: 'Clinic',
  tournament: 'Tournament',
  community_day: 'Community Day',
  food_addon: 'Add-On',
};

const PRODUCT_TYPE_VARIANTS: Record<ProductType, 'default' | 'success' | 'warning' | 'info' | 'accent'> = {
  court_rental: 'default',
  open_play: 'info',
  coaching: 'accent',
  clinic: 'warning',
  tournament: 'accent',
  community_day: 'success',
  food_addon: 'default',
};

function formatProductPrice(product: Product): string | null {
  if (product.base_price_cents == null) return null;
  const price = formatPrice(product.base_price_cents);
  switch (product.type) {
    case 'court_rental':
      return `${price}/hr`;
    case 'coaching':
      return `${price}/session`;
    default:
      return `${price}/person`;
  }
}

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=600&h=400&fit=crop';

export default function ProductCard({ product, nextSession }: ProductCardProps) {
  const router = useRouter();
  const priceDisplay = formatProductPrice(product);
  const imageUri = product.image_url || PLACEHOLDER_IMAGE;
  const typeLabel = PRODUCT_TYPE_LABELS[product.type];
  const typeVariant = PRODUCT_TYPE_VARIANTS[product.type];

  const spotsRemaining = nextSession?.spots_remaining ?? null;
  const spotsTotal = nextSession?.spots_total ?? null;
  const nextTime = nextSession?.starts_at
    ? formatRelativeTime(nextSession.starts_at)
    : null;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/product/[id]',
          params: { id: product.id },
        })
      }
      className="bg-surface rounded-2xl mb-4 shadow-sm shadow-black/10 overflow-hidden"
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        transform: [{ scale: pressed ? 0.98 : 1 }],
        opacity: pressed ? 0.95 : 1,
      })}
    >
      {/* Hero Image */}
      <View className="relative">
        <Image
          source={{ uri: imageUri }}
          className="w-full rounded-t-2xl"
          style={{ height: 180 }}
          resizeMode="cover"
        />
        {/* Type Badge overlaid on image */}
        <View className="absolute top-3 left-3">
          <Badge label={typeLabel} variant={typeVariant} size="sm" />
        </View>
        {/* Price badge overlaid on image */}
        {priceDisplay && (
          <View className="absolute bottom-3 right-3 bg-surface/90 rounded-full px-3 py-1">
            <Text className="text-sm font-bold text-sand">
              {priceDisplay}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View className="px-4 py-3.5">
        <Text className="text-lg font-bold text-offwhite" numberOfLines={2}>
          {product.title}
        </Text>

        {product.description && (
          <Text
            className="text-sm text-offwhite/60 mt-1"
            numberOfLines={2}
          >
            {product.description}
          </Text>
        )}

        {/* Meta Row */}
        <View className="flex-row items-center mt-2.5 flex-wrap">
          {nextTime && nextTime !== 'past' && (
            <View className="flex-row items-center mr-4">
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text className="text-xs text-offwhite/50 ml-1">
                {nextTime}
              </Text>
            </View>
          )}

          {spotsRemaining != null && spotsTotal != null && (
            <View className="flex-row items-center mr-4">
              <Ionicons name="people-outline" size={14} color="#6B7280" />
              <Text
                className={`text-xs ml-1 ${
                  spotsRemaining <= 2
                    ? 'text-ember font-semibold'
                    : 'text-offwhite/50'
                }`}
              >
                {spotsRemaining === 0
                  ? 'Full'
                  : `${spotsRemaining}/${spotsTotal} spots`}
              </Text>
            </View>
          )}

          {product.duration_minutes && (
            <View className="flex-row items-center">
              <Ionicons name="hourglass-outline" size={14} color="#6B7280" />
              <Text className="text-xs text-offwhite/50 ml-1">
                {product.duration_minutes}min
              </Text>
            </View>
          )}
        </View>

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <View className="flex-row flex-wrap mt-2.5 gap-1.5">
            {product.tags.slice(0, 3).map((tag) => (
              <View
                key={tag}
                className="bg-sand/10 rounded-full px-2.5 py-0.5"
              >
                <Text className="text-xs text-sand-dark font-medium">
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}
