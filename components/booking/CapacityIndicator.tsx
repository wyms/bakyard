import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';

interface CapacityIndicatorProps {
  total: number;
  remaining: number;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CONFIG = {
  sm: {
    dimension: 44,
    barHeight: 4,
    textSize: 'text-xs' as const,
    labelSize: 'text-[9px]' as const,
    numberSize: 'text-lg' as const,
  },
  md: {
    dimension: 56,
    barHeight: 6,
    textSize: 'text-sm' as const,
    labelSize: 'text-[10px]' as const,
    numberSize: 'text-xl' as const,
  },
  lg: {
    dimension: 72,
    barHeight: 8,
    textSize: 'text-base' as const,
    labelSize: 'text-xs' as const,
    numberSize: 'text-2xl' as const,
  },
};

function getCapacityColor(percentage: number): string {
  if (percentage > 50) return '#4CAF50';
  if (percentage > 25) return '#FF9800';
  return '#FF6B6B';
}

function getCapacityLabel(remaining: number, total: number): string {
  if (remaining === 0) return 'Full';
  if (remaining === 1) return '1 spot left';
  return `${remaining} of ${total} spots left`;
}

export default function CapacityIndicator({
  total,
  remaining,
  size = 'md',
}: CapacityIndicatorProps) {
  const config = SIZE_CONFIG[size];
  const percentage = total > 0 ? (remaining / total) * 100 : 0;
  const filledPercent = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const color = getCapacityColor(percentage);
  const label = getCapacityLabel(remaining, total);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(filledPercent, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [filledPercent, progress]);

  const barAnimatedStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 100], [0, 100])}%` as unknown as number,
  }));

  return (
    <View className="flex-row items-center">
      {/* Visual indicator: circle with number */}
      <View
        className="rounded-full items-center justify-center"
        style={{
          width: config.dimension,
          height: config.dimension,
          backgroundColor: `${color}15`,
          borderWidth: 3,
          borderColor: color,
        }}
      >
        <Text
          className={`${config.numberSize} font-bold`}
          style={{ color }}
        >
          {remaining}
        </Text>
      </View>

      {/* Text and progress bar */}
      <View className="ml-3 flex-1">
        <Text className={`${config.textSize} font-semibold text-[#2D2D2D]`}>
          {label}
        </Text>
        <Text className={`${config.labelSize} text-[#2D2D2D]/50 mt-0.5`}>
          {remaining === 0 ? 'Join the waitlist' : 'Spots fill fast'}
        </Text>

        {/* Progress bar */}
        <View
          className="w-full rounded-full bg-[#E8E5E0] mt-2 overflow-hidden"
          style={{ height: config.barHeight }}
        >
          <Animated.View
            className="h-full rounded-full"
            style={[
              { backgroundColor: color },
              barAnimatedStyle,
            ]}
          />
        </View>
      </View>
    </View>
  );
}
