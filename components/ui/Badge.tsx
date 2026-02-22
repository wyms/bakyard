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
    container: 'bg-accent/20',
    text: 'text-accent',
  },
  success: {
    container: 'bg-primary/20',
    text: 'text-primary',
  },
  warning: {
    container: 'bg-accent/20',
    text: 'text-accent',
  },
  info: {
    container: 'bg-primary/20',
    text: 'text-primary',
  },
  accent: {
    container: 'bg-error/20',
    text: 'text-error',
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
