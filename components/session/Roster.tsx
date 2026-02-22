import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import Avatar from '@/components/ui/Avatar';
import type { Booking } from '@/lib/types/database';

interface RosterBooking extends Booking {
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface RosterProps {
  bookings: RosterBooking[];
  currentUserId: string;
}

function getDisplayName(
  booking: RosterBooking,
  isCurrentUser: boolean,
): string {
  if (isCurrentUser) return 'YOU';
  const fullName = booking.profile?.full_name;
  if (!fullName) return 'Guest';
  // Show first name only for privacy/space
  return fullName.split(' ')[0].toUpperCase();
}

function getPaymentLabel(
  status: Booking['status'],
): { label: string; color: string } {
  switch (status) {
    case 'confirmed':
      return { label: 'Paid', color: '#3F6F6A' };
    case 'reserved':
      return { label: 'Pending', color: '#D6B07A' };
    case 'cancelled':
      return { label: 'Cancelled', color: '#9E9E9E' };
    case 'no_show':
      return { label: 'No Show', color: '#FF6B6B' };
    default:
      return { label: 'Pending', color: '#D6B07A' };
  }
}

function getBorderColor(status: Booking['status']): string {
  switch (status) {
    case 'confirmed':
      return '#3F6F6A'; // Teal for confirmed
    case 'reserved':
      return '#FF6B6B'; // Coral for pending
    case 'cancelled':
      return '#9E9E9E';
    default:
      return 'rgba(17,24,39,0.08)';
  }
}

export default function Roster({ bookings, currentUserId }: RosterProps) {
  // Filter out cancelled bookings and sort current user first
  const activeBookings = bookings
    .filter((b) => b.status !== 'cancelled')
    .sort((a, b) => {
      if (a.user_id === currentUserId) return -1;
      if (b.user_id === currentUserId) return 1;
      return 0;
    });

  if (activeBookings.length === 0) {
    return (
      <View className="items-center py-4">
        <Text className="text-sm text-charcoal/40">
          No participants yet
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="px-1 gap-5"
    >
      {activeBookings.map((booking) => {
        const isCurrentUser = booking.user_id === currentUserId;
        const displayName = getDisplayName(booking, isCurrentUser);
        const payment = getPaymentLabel(booking.status);
        const borderColor = getBorderColor(booking.status);
        const avatarName = booking.profile?.full_name ?? 'Guest';
        const avatarUri = booking.profile?.avatar_url ?? null;

        return (
          <View key={booking.id} className="items-center" style={{ width: 68 }}>
            <View
              className="rounded-full p-0.5"
              style={{ borderWidth: 2.5, borderColor }}
            >
              <Avatar
                uri={avatarUri}
                name={avatarName}
                size="md"
              />
            </View>
            <Text
              className="text-xs font-bold text-charcoal mt-1.5"
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              className="text-[10px] font-medium mt-0.5"
              style={{ color: payment.color }}
            >
              {payment.label}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}
