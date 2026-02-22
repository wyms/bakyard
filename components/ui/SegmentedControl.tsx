import React from 'react';
import { View, Text, Pressable, type ViewStyle } from 'react-native';

interface SegmentOption {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function SegmentedControl({
  options,
  selectedKey,
  onSelect,
  disabled = false,
  className = '',
}: SegmentedControlProps) {
  return (
    <View
      className={`flex-row bg-surface rounded-full p-1 ${className}`}
    >
      {options.map(({ key, label }) => {
        const isSelected = key === selectedKey;
        return (
          <Pressable
            key={key}
            onPress={() => !disabled && onSelect(key)}
            disabled={disabled}
            className={`flex-1 items-center justify-center py-2.5 rounded-full ${
              isSelected ? 'bg-primary' : 'bg-transparent'
            }`}
            style={({ pressed }: { pressed: boolean }): ViewStyle => ({
              opacity: pressed && !disabled ? 0.8 : 1,
            })}
          >
            <Text
              className={`text-sm font-semibold ${
                isSelected ? 'text-white' : 'text-muted'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
