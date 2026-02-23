import React from 'react';
import { View, Text, Pressable, type ViewStyle } from 'react-native';
import { format, parseISO } from 'date-fns';
import Badge from '@/components/ui/Badge';
import { formatPrice } from '@/lib/utils/pricing';
import type { Session, Product, ProductType } from '@/lib/types/database';

interface SessionRowProps {
  session: Session;
  product?: Product | null;
  onPress: () => void;
}

const TYPE_BADGE_VARIANT: Record<ProductType, 'open-play' | 'clinic' | 'private' | 'default'> = {
  open_play: 'open-play',
  clinic: 'clinic',
  court_rental: 'private',
  coaching: 'clinic',
  tournament: 'default',
  community_day: 'default',
  food_addon: 'default',
};

const TYPE_LABELS: Record<ProductType, string> = {
  open_play: 'Open Play',
  clinic: 'Clinic',
  court_rental: 'Private',
  coaching: 'Training',
  tournament: 'Tournament',
  community_day: 'Community',
  food_addon: 'Add-On',
};

export default function SessionRow({ session, product, onPress }: SessionRowProps) {
  const start = parseISO(session.starts_at);
  const timeStr = format(start, 'h:mm');
  const ampm = format(start, 'a');
  const sessionName = product?.title ?? 'Session';
  const isUrgent = session.spots_remaining > 0 && session.spots_remaining < 3;
  const productType = product?.type ?? 'open_play';
  const badgeVariant = TYPE_BADGE_VARIANT[productType];
  const typeLabel = TYPE_LABELS[productType];

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-surface rounded-2xl px-4 py-3 mb-2.5 border border-stroke"
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      {/* Time */}
      <View className="mr-4 items-center" style={{ minWidth: 52 }}>
        <Text className="font-display text-2xl text-offwhite leading-none">{timeStr}</Text>
        <Text className="text-xs text-mid">{ampm}</Text>
      </View>

      {/* Details */}
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-0.5">
          <Badge label={typeLabel} variant={badgeVariant} size="sm" />
          {isUrgent && <Text className="text-xs">🔥</Text>}
        </View>
        <Text className="text-sm font-semibold text-offwhite" numberOfLines={1}>
          {sessionName}
        </Text>
        <Text className="text-xs text-mid mt-0.5">
          {session.spots_remaining}/{session.spots_total} spots
        </Text>
      </View>

      {/* Price */}
      <Text className="text-sm font-bold text-sand ml-2">
        {formatPrice(session.price_cents)}
      </Text>
    </Pressable>
  );
}
