import React from 'react';
import { Pressable, Text, type ViewStyle } from 'react-native';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
}

export default function Chip({
  label,
  selected = false,
  onPress,
  icon,
}: ChipProps) {
  const containerClassName = [
    'flex-row items-center rounded-full px-4 py-2',
    selected ? 'bg-[#1A5E63]' : 'bg-gray-100',
  ].join(' ');

  const textClassName = [
    'text-sm font-medium',
    selected ? 'text-white' : 'text-[#2D2D2D]',
  ].join(' ');

  return (
    <Pressable
      onPress={onPress}
      className={containerClassName}
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {icon && <>{icon}</>}
      <Text className={`${textClassName}${icon ? ' ml-1.5' : ''}`}>{label}</Text>
    </Pressable>
  );
}
