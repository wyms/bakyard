import React, { useCallback } from 'react';
import { View, Text, Pressable, type ViewStyle } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { Court } from '@/lib/types/database';

interface CourtPickerProps {
  courts: Court[];
  selectedCourtId: string | null;
  onSelect: (courtId: string) => void;
}

const COURT_SUBTITLES: Record<string, string> = {
  'Court 1': 'Fireside',
  'Court 2': 'Center Lounge',
  'Court 3': 'Private Breeze',
};

function getCourtSubtitle(courtName: string): string {
  return COURT_SUBTITLES[courtName] ?? courtName;
}

function getCourtIcon(courtName: string): keyof typeof Ionicons.glyphMap {
  const lower = courtName.toLowerCase();
  if (lower.includes('1') || lower.includes('fire')) return 'flame-outline';
  if (lower.includes('2') || lower.includes('center')) return 'people-outline';
  if (lower.includes('3') || lower.includes('breeze')) return 'leaf-outline';
  return 'tennisball-outline';
}

export default function CourtPicker({
  courts,
  selectedCourtId,
  onSelect,
}: CourtPickerProps) {
  const handlePress = useCallback(
    (court: Court) => {
      if (!court.is_available) return;
      onSelect(court.id);
    },
    [onSelect]
  );

  const sortedCourts = [...courts].sort((a, b) => {
    const orderA = a.sort_order ?? 999;
    const orderB = b.sort_order ?? 999;
    return orderA - orderB;
  });

  return (
    <View>
      <Text className="text-base font-semibold text-[#2D2D2D] mb-3">
        Pick a court
      </Text>

      <View className="bg-[#E8E5E0]/30 rounded-2xl p-3">
        {/* Court map visual header */}
        <View className="flex-row items-center justify-center mb-3 py-2">
          <View className="flex-row items-center gap-3">
            {sortedCourts.map((court) => {
              const isSelected = court.id === selectedCourtId;
              return (
                <View
                  key={court.id}
                  className={[
                    'w-8 h-12 rounded-lg border-2',
                    isSelected ? 'border-[#1A5E63] bg-[#1A5E63]/10' : 'border-[#E8E5E0] bg-white/50',
                    !court.is_available ? 'opacity-30' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              );
            })}
          </View>
        </View>

        {/* Court cards */}
        <View className="flex-row gap-2">
          {sortedCourts.map((court, index) => {
            const isSelected = court.id === selectedCourtId;
            const isUnavailable = !court.is_available;
            const subtitle = getCourtSubtitle(court.name);
            const iconName = getCourtIcon(court.name);

            return (
              <Animated.View
                key={court.id}
                entering={FadeInRight.delay(index * 80).duration(300)}
                className="flex-1"
              >
                <Pressable
                  onPress={() => handlePress(court)}
                  disabled={isUnavailable}
                  className={[
                    'rounded-xl p-3 items-center',
                    isSelected
                      ? 'bg-white border-2 border-[#1A5E63]'
                      : isUnavailable
                        ? 'bg-gray-100 border border-gray-200'
                        : 'bg-white border border-[#E8E5E0]',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                    opacity: pressed ? 0.85 : isUnavailable ? 0.4 : 1,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <Ionicons
                    name={iconName}
                    size={18}
                    color={
                      isSelected
                        ? '#1A5E63'
                        : isUnavailable
                          ? '#CCCCCC'
                          : '#2D2D2D'
                    }
                  />
                  <Text
                    className={[
                      'text-xs font-bold mt-1.5',
                      isSelected ? 'text-[#1A5E63]' : isUnavailable ? 'text-gray-300' : 'text-[#2D2D2D]',
                    ].join(' ')}
                    numberOfLines={1}
                  >
                    {court.name}
                  </Text>
                  <Text
                    className={[
                      'text-[10px] mt-0.5',
                      isSelected ? 'text-[#1A5E63]/70' : isUnavailable ? 'text-gray-300' : 'text-[#2D2D2D]/50',
                    ].join(' ')}
                    numberOfLines={1}
                  >
                    {subtitle}
                  </Text>
                  {isUnavailable && (
                    <View className="mt-1.5 bg-gray-200 rounded-full px-2 py-0.5">
                      <Text className="text-[9px] text-gray-400 font-medium">
                        Unavailable
                      </Text>
                    </View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
