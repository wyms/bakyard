import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { differenceInMinutes, differenceInHours, parseISO } from 'date-fns';
import type { SessionStatus } from '@/lib/types/database';

interface CountdownBadgeProps {
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
}

function getCountdownState(
  startsAt: string,
  endsAt: string,
  status: SessionStatus,
): {
  label: string;
  bgColor: string;
  textColor: string;
  iconName: keyof typeof Ionicons.glyphMap;
} {
  const now = new Date();
  const start = parseISO(startsAt);
  const end = parseISO(endsAt);

  if (status === 'completed' || now > end) {
    return {
      label: 'Completed',
      bgColor: '#9E9E9E',
      textColor: '#FFFFFF',
      iconName: 'checkmark-circle',
    };
  }

  if (status === 'cancelled') {
    return {
      label: 'Cancelled',
      bgColor: '#FF6B6B',
      textColor: '#FFFFFF',
      iconName: 'close-circle',
    };
  }

  if (status === 'in_progress' || (now >= start && now <= end)) {
    return {
      label: 'In Progress',
      bgColor: '#1A5E63',
      textColor: '#FFFFFF',
      iconName: 'play-circle',
    };
  }

  // Upcoming
  const minutesDiff = differenceInMinutes(start, now);
  const hoursDiff = differenceInHours(start, now);

  let label: string;
  if (minutesDiff < 1) {
    label = 'Starting now';
  } else if (minutesDiff < 60) {
    label = `Starts in ${minutesDiff} min`;
  } else if (hoursDiff < 24) {
    const hrs = hoursDiff;
    label = hrs === 1 ? 'Starts in 1 hr' : `Starts in ${hrs} hrs`;
  } else {
    const days = Math.floor(hoursDiff / 24);
    label = days === 1 ? 'Starts in 1 day' : `Starts in ${days} days`;
  }

  return {
    label,
    bgColor: '#4CAF50',
    textColor: '#FFFFFF',
    iconName: 'time-outline',
  };
}

export default function CountdownBadge({
  startsAt,
  endsAt,
  status,
}: CountdownBadgeProps) {
  const [state, setState] = useState(() =>
    getCountdownState(startsAt, endsAt, status),
  );

  useEffect(() => {
    // Recalculate immediately on prop change
    setState(getCountdownState(startsAt, endsAt, status));

    // Only set up interval for non-terminal states
    if (status === 'completed' || status === 'cancelled') {
      return;
    }

    const interval = setInterval(() => {
      setState(getCountdownState(startsAt, endsAt, status));
    }, 60_000);

    return () => clearInterval(interval);
  }, [startsAt, endsAt, status]);

  return (
    <View
      className="flex-row items-center self-center rounded-full px-4 py-2"
      style={{ backgroundColor: state.bgColor }}
    >
      <Ionicons name={state.iconName} size={16} color={state.textColor} />
      <Text
        className="text-sm font-semibold ml-1.5"
        style={{ color: state.textColor }}
      >
        {state.label}
      </Text>
    </View>
  );
}
