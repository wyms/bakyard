import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { Session, Product } from '@/lib/types/database';

interface NextSessionCardProps {
  session?: Session | null;
  product?: Product | null;
}

function PulsingDot() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 600 }),
        withTiming(1, { duration: 600 }),
      ),
      -1,
      false,
    );
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF72' }, animStyle]}
    />
  );
}

export default function NextSessionCard({ session, product }: NextSessionCardProps) {
  const router = useRouter();

  if (!session) {
    return (
      <Pressable
        onPress={() => router.push('/(tabs)/book' as never)}
        className="bg-surface rounded-2xl p-4 border border-stroke mb-4"
      >
        <Text className="text-base font-semibold text-offwhite mb-1">No upcoming sessions</Text>
        <Text className="text-sm text-mid">Book Your First Session →</Text>
      </Pressable>
    );
  }

  const start = parseISO(session.starts_at);
  const dateStr = format(start, 'EEE, MMM d');
  const timeStr = format(start, 'h:mm a');
  const sessionName = product?.title ?? 'Session';

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/session/[id]',
          params: { id: session.id },
        })
      }
      className="bg-surface rounded-2xl p-4 border border-stroke mb-4"
    >
      <View className="flex-row items-center mb-2">
        <PulsingDot />
        <Text className="text-xs font-semibold text-success ml-2 uppercase tracking-wide">
          Next Session
        </Text>
      </View>
      <Text className="text-lg font-bold text-offwhite" numberOfLines={1}>
        {sessionName}
      </Text>
      <Text className="text-sm text-mid mt-0.5">
        {dateStr} · {timeStr}
      </Text>
    </Pressable>
  );
}
