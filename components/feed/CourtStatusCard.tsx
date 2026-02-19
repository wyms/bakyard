import React from 'react';
import { View, Text, Pressable, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import Badge from '@/components/ui/Badge';
import type { Session, Court } from '@/lib/types/database';

interface CourtStatusCardProps {
  session: Session;
  court: Court;
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  const start = parseISO(startsAt);
  const end = parseISO(endsAt);
  return `${format(start, 'h:mm')} \u2013 ${format(end, 'h:mm')}`;
}

export default function CourtStatusCard({ session, court }: CourtStatusCardProps) {
  const router = useRouter();
  const isOpen = session.status === 'open' && session.spots_remaining > 0;
  const statusLabel = isOpen ? 'Open' : 'Full';
  const statusVariant = isOpen ? 'success' : 'accent';

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/session/[id]',
          params: { id: session.id },
        })
      }
      className="flex-row items-center justify-between bg-white rounded-2xl px-4 py-3.5 mb-2.5 shadow-sm shadow-black/8"
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        transform: [{ scale: pressed ? 0.98 : 1 }],
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View className="flex-1 mr-3">
        <Text className="text-base font-semibold text-charcoal">
          {court.name}
        </Text>
        <Text className="text-sm text-charcoal/50 mt-0.5">
          {formatTimeRange(session.starts_at, session.ends_at)}
        </Text>
      </View>
      <Badge label={statusLabel} variant={statusVariant} size="sm" />
    </Pressable>
  );
}
