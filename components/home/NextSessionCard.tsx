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
        style={{ backgroundColor: 'rgba(232,201,122,0.07)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(232,201,122,0.18)' }}
      >
        <Text className="text-sm font-semibold text-offwhite mb-0.5">No upcoming sessions</Text>
        <Text className="text-xs text-mid">Book Your First Session →</Text>
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
      style={{ backgroundColor: 'rgba(232,201,122,0.1)', borderRadius: 12, padding: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(232,201,122,0.2)', flexDirection: 'row', alignItems: 'center', gap: 12 }}
    >
      <PulsingDot />
      <View style={{ flex: 1 }}>
        <Text
          style={{ fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 10, letterSpacing: 2.8, textTransform: 'uppercase', color: '#4CAF72', marginBottom: 2 }}
        >
          Next Session
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: '#F0EDE6' }} numberOfLines={1}>
          {sessionName}
        </Text>
        <Text style={{ fontSize: 11, color: '#8A8FA0' }}>
          {dateStr} · {timeStr}
        </Text>
      </View>
      <Text style={{ color: '#E8C97A', fontSize: 16 }}>›</Text>
    </Pressable>
  );
}
