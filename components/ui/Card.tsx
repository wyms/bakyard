import React from 'react';
import { View, Pressable, type ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
  shadow?: boolean;
}

export default function Card({
  children,
  onPress,
  className = '',
  shadow = true,
}: CardProps) {
  const baseClassName = [
    'bg-surface rounded-[20px] p-4',
    shadow && 'shadow-card',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={baseClassName}
        style={({ pressed }: { pressed: boolean }): ViewStyle => ({
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        {children}
      </Pressable>
    );
  }

  return <View className={baseClassName}>{children}</View>;
}
