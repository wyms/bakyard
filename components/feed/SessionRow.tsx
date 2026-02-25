import React from 'react';
import { View, Text, Pressable, type ViewStyle } from 'react-native';
import { format, parseISO } from 'date-fns';
import { formatPrice } from '@/lib/utils/pricing';
import type { Session, Product, ProductType } from '@/lib/types/database';

interface SessionRowProps {
  session: Session;
  product?: Product | null;
  onPress: () => void;
}

const TYPE_LABELS: Record<ProductType, string> = {
  open_play: 'Open Play',
  clinic: 'Clinic',
  court_rental: 'Private',
  coaching: 'Training',
  tournament: 'Tournament',
  community_day: 'Community',
  food_addon: 'Add-On',
};

const TYPE_COLORS: Record<ProductType, string> = {
  open_play: '#D95F2B',
  clinic: '#7BC4E2',
  court_rental: '#E8C97A',
  coaching: '#7BC4E2',
  tournament: '#E8C97A',
  community_day: '#4CAF72',
  food_addon: '#8A8FA0',
};

export default function SessionRow({ session, product, onPress }: SessionRowProps) {
  const start = parseISO(session.starts_at);
  const timeStr = format(start, 'h:mm');
  const ampm = format(start, 'a');
  const sessionName = product?.title ?? 'Session';
  const isUrgent = session.spots_remaining > 0 && session.spots_remaining < 3;
  const productType = product?.type ?? 'open_play';
  const typeLabel = TYPE_LABELS[productType];
  const typeColor = TYPE_COLORS[productType];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#181C26',
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: pressed ? 'rgba(232,201,122,0.15)' : 'rgba(255,255,255,0.04)',
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
        gap: 14,
      })}
    >
      {/* Time column */}
      <View style={{ alignItems: 'center', minWidth: 44 }}>
        <Text
          style={{
            fontFamily: 'BebasNeue_400Regular',
            fontSize: 16,
            letterSpacing: 1,
            color: '#E8C97A',
            lineHeight: 17,
          }}
        >
          {timeStr}
        </Text>
        <Text
          style={{
            fontFamily: 'BarlowCondensed_600SemiBold',
            fontSize: 9,
            letterSpacing: 1.9,
            textTransform: 'uppercase',
            color: '#5A5F72',
          }}
        >
          {ampm}
        </Text>
      </View>

      {/* Vertical divider */}
      <View style={{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

      {/* Session info */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: 'BarlowCondensed_700Bold',
            fontSize: 9,
            letterSpacing: 2.8,
            textTransform: 'uppercase',
            color: typeColor,
            marginBottom: 2,
          }}
        >
          {typeLabel}
        </Text>
        <Text
          style={{
            fontFamily: 'BarlowCondensed_700Bold',
            fontSize: 15,
            letterSpacing: 0.5,
            color: '#F0EDE6',
            marginBottom: 3,
          }}
          numberOfLines={1}
        >
          {sessionName}
        </Text>
        <Text style={{ fontSize: 11, color: '#5A5F72' }}>
          {session.spots_remaining} spots left{isUrgent ? ' 🔥' : ''}
        </Text>
      </View>

      {/* Price */}
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            fontFamily: 'BebasNeue_400Regular',
            fontSize: 18,
            letterSpacing: 1,
            color: '#F0EDE6',
          }}
        >
          {formatPrice(session.price_cents)}
        </Text>
        <Text style={{ fontSize: 9, color: '#5A5F72', textAlign: 'right' }}>/ person</Text>
      </View>
    </Pressable>
  );
}
