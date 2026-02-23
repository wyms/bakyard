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
    selected ? 'bg-primary' : 'bg-surface',
  ].join(' ');

  const textClassName = [
    'text-sm font-medium',
    selected ? 'text-[#0D0F14]' : 'text-text',
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
