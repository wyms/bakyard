import React from 'react';
import { View, Text } from 'react-native';

type BadgeVariant = 'default' | 'success' | 'warning' | 'info' | 'accent';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantClasses: Record<BadgeVariant, { container: string; text: string }> = {
  default: {
    container: 'bg-[#D4A574]/20',
    text: 'text-[#D4A574]',
  },
  success: {
    container: 'bg-[#4CAF50]/20',
    text: 'text-[#4CAF50]',
  },
  warning: {
    container: 'bg-[#FF9800]/20',
    text: 'text-[#FF9800]',
  },
  info: {
    container: 'bg-[#1A5E63]/20',
    text: 'text-[#1A5E63]',
  },
  accent: {
    container: 'bg-[#FF6B6B]/20',
    text: 'text-[#FF6B6B]',
  },
};

const sizeClasses: Record<BadgeSize, { container: string; text: string }> = {
  sm: {
    container: 'px-2 py-0.5',
    text: 'text-xs',
  },
  md: {
    container: 'px-3 py-1',
    text: 'text-sm',
  },
};

export default function Badge({
  label,
  variant = 'default',
  size = 'md',
}: BadgeProps) {
  const variantStyle = variantClasses[variant];
  const sizeStyle = sizeClasses[size];

  const containerClassName = [
    'rounded-full self-start',
    sizeStyle.container,
    variantStyle.container,
  ].join(' ');

  const textClassName = [
    'font-semibold',
    sizeStyle.text,
    variantStyle.text,
  ].join(' ');

  return (
    <View className={containerClassName}>
      <Text className={textClassName}>{label}</Text>
    </View>
  );
}
