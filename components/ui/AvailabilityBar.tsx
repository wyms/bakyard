import React from 'react';
import { View, Text } from 'react-native';

interface AvailabilityBarProps {
  spotsRemaining: number;
  spotsTotal: number;
}

export default function AvailabilityBar({ spotsRemaining, spotsTotal }: AvailabilityBarProps) {
  if (spotsTotal === 0) return null;

  const fillPct = Math.max(0, Math.min(100, ((spotsTotal - spotsRemaining) / spotsTotal) * 100));
  const isEmpty = spotsRemaining === 0;
  const isUrgent = !isEmpty && spotsRemaining / spotsTotal >= 0.8;
  const isModerate = !isEmpty && !isUrgent && fillPct > 0.5;

  const fillColor = isEmpty
    ? '#D95F2B'
    : isUrgent
      ? '#D95F2B'
      : isModerate
        ? '#E8C97A'
        : '#4CAF72';

  return (
    <View>
      <View className="h-2 bg-surface rounded-full overflow-hidden">
        <View
          style={{
            width: `${fillPct}%`,
            height: '100%',
            backgroundColor: fillColor,
            borderRadius: 99,
          }}
        />
      </View>
      <View className="flex-row items-center justify-between mt-1">
        <Text className="text-xs text-mid">
          {isEmpty ? 'Full' : `${spotsRemaining} spot${spotsRemaining !== 1 ? 's' : ''} left`}
          {isUrgent && !isEmpty ? ' 🔥' : ''}
        </Text>
        <Text className="text-xs text-mid">{spotsTotal} total</Text>
      </View>
    </View>
  );
}
