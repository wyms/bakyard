import React, { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, type ViewStyle } from 'react-native';
import { format, isSameDay, addDays, parseISO, isToday, isTomorrow } from 'date-fns';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { formatPrice } from '@/lib/utils/pricing';
import type { Session } from '@/lib/types/database';

interface TimeSlotPickerProps {
  sessions: Session[];
  selectedSession: Session | null;
  onSelect: (session: Session) => void;
  memberDiscountPercent?: number;
}

interface DayGroup {
  date: Date;
  label: string;
  sublabel: string;
  sessions: Session[];
}

function getDayLabel(date: Date): { label: string; sublabel: string } {
  if (isToday(date)) {
    return { label: 'Today', sublabel: format(date, 'M/d') };
  }
  if (isTomorrow(date)) {
    return { label: 'Tomorrow', sublabel: format(date, 'M/d') };
  }
  return { label: format(date, 'EEE'), sublabel: format(date, 'M/d') };
}

function formatTimeRange(startsAt: string, endsAt: string): string {
  const start = parseISO(startsAt);
  const end = parseISO(endsAt);
  return `${format(start, 'h:mm')} \u2013 ${format(end, 'h:mm')}`;
}

export default function TimeSlotPicker({
  sessions,
  selectedSession,
  onSelect,
  memberDiscountPercent,
}: TimeSlotPickerProps) {
  // Group sessions by day
  const dayGroups = useMemo(() => {
    const groups: DayGroup[] = [];
    const today = new Date();

    // Generate the next 7 days
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      const daySessions = sessions.filter((s) =>
        isSameDay(parseISO(s.starts_at), date)
      );
      const { label, sublabel } = getDayLabel(date);
      groups.push({ date, label, sublabel, sessions: daySessions });
    }

    return groups;
  }, [sessions]);

  // Determine which day is currently selected
  const selectedDay = useMemo(() => {
    if (selectedSession) {
      return parseISO(selectedSession.starts_at);
    }
    // Default to first day that has sessions
    const firstWithSessions = dayGroups.find((g) => g.sessions.length > 0);
    return firstWithSessions?.date ?? new Date();
  }, [selectedSession, dayGroups]);

  const [activeDayIndex, setActiveDayIndex] = React.useState<number>(() => {
    const idx = dayGroups.findIndex((g) => isSameDay(g.date, selectedDay));
    return idx >= 0 ? idx : 0;
  });

  const activeGroup = dayGroups[activeDayIndex];
  const activeSessions = activeGroup?.sessions ?? [];

  const handleDayPress = useCallback(
    (index: number) => {
      setActiveDayIndex(index);
    },
    []
  );

  const handleSlotPress = useCallback(
    (session: Session) => {
      if (session.status === 'full') return;
      onSelect(session);
    },
    [onSelect]
  );

  return (
    <View>
      {/* Section: Pick a day */}
      <Text className="text-base font-semibold text-text mb-3">
        Pick a day
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
        className="mb-5"
      >
        {dayGroups.map((group, index) => {
          const isActive = index === activeDayIndex;
          const hasSessions = group.sessions.length > 0;

          return (
            <Pressable
              key={group.date.toISOString()}
              onPress={() => handleDayPress(index)}
              className={[
                'items-center justify-center rounded-2xl px-4 py-2.5 mr-2',
                isActive ? 'bg-primary' : 'bg-surface',
                !hasSessions && !isActive ? 'opacity-40' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                opacity: pressed ? 0.8 : hasSessions || isActive ? 1 : 0.4,
              })}
            >
              <Text
                className={[
                  'text-xs font-medium',
                  isActive ? 'text-white' : 'text-text',
                ].join(' ')}
              >
                {group.label}
              </Text>
              <Text
                className={[
                  'text-xs mt-0.5',
                  isActive ? 'text-white/80' : 'text-text/50',
                ].join(' ')}
              >
                {group.sublabel}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Section: Pick a time */}
      <Text className="text-base font-semibold text-text mb-3">
        Pick a time
      </Text>

      {activeSessions.length === 0 ? (
        <View className="bg-surface rounded-2xl p-6 items-center">
          <Text className="text-sm text-text/40">
            No sessions available this day
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-2.5">
          {activeSessions.map((session, index) => {
            const isSelected = selectedSession?.id === session.id;
            const isFull = session.status === 'full';
            const timeRange = formatTimeRange(session.starts_at, session.ends_at);
            const price = formatPrice(session.price_cents);

            return (
              <Animated.View
                key={session.id}
                entering={FadeInDown.delay(index * 50).duration(300)}
              >
                <Pressable
                  onPress={() => handleSlotPress(session)}
                  disabled={isFull}
                  className={[
                    'rounded-2xl px-4 py-3 min-w-[140px]',
                    isSelected
                      ? 'bg-primary'
                      : isFull
                        ? 'bg-gray-100'
                        : 'bg-surface',
                    isSelected
                      ? ''
                      : 'border border-stroke',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                    opacity: pressed ? 0.85 : isFull ? 0.5 : 1,
                  })}
                >
                  <Text
                    className={[
                      'text-sm font-semibold',
                      isSelected ? 'text-white' : isFull ? 'text-gray-400' : 'text-text',
                    ].join(' ')}
                  >
                    {timeRange}
                  </Text>
                  <Text
                    className={[
                      'text-xs mt-1',
                      isSelected ? 'text-white/80' : isFull ? 'text-gray-300' : 'text-text/60',
                    ].join(' ')}
                  >
                    {isFull ? 'Full' : `${price} Each`}
                  </Text>
                  {memberDiscountPercent && memberDiscountPercent > 0 && !isFull && (
                    <Text
                      className={[
                        'text-[10px] mt-1 font-medium',
                        isSelected ? 'text-primary' : 'text-primary',
                      ].join(' ')}
                    >
                      Members save {memberDiscountPercent}%
                    </Text>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}
    </View>
  );
}
