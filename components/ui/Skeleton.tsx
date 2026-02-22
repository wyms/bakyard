import React, { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SkeletonProps {
  width: number | string;
  height: number | string;
  borderRadius?: number;
  className?: string;
}

export default function Skeleton({
  width,
  height,
  borderRadius = 8,
  className = '',
}: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle((): ViewStyle => ({
    opacity: opacity.value,
  }));

  return (
    <View className={className}>
      <Animated.View
        style={[
          {
            width: width as number,
            height: height as number,
            borderRadius,
            backgroundColor: 'rgba(17,24,39,0.08)',
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}
