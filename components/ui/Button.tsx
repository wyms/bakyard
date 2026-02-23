import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

const variantClasses: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-accent shadow-subtle',
    text: 'text-[#0D0F14]',
  },
  secondary: {
    container: 'bg-surface shadow-subtle',
    text: 'text-offwhite',
  },
  outline: {
    container: 'bg-transparent border-2 border-accent',
    text: 'text-accent',
  },
  ghost: {
    container: 'bg-transparent',
    text: 'text-primary',
  },
};

const sizeClasses: Record<ButtonSize, { container: string; text: string }> = {
  sm: {
    container: 'px-4 py-2 rounded-button',
    text: 'text-sm',
  },
  md: {
    container: 'px-6 py-3 rounded-button',
    text: 'text-base',
  },
  lg: {
    container: 'px-8 py-4 rounded-button',
    text: 'text-lg',
  },
};

let triggerHaptic: (() => void) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Haptics = require('expo-haptics');
  triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
} catch {
  triggerHaptic = null;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  className = '',
  ...rest
}: ButtonProps) {
  const handlePress = useCallback(() => {
    if (loading || disabled) return;
    triggerHaptic?.();
    onPress();
  }, [loading, disabled, onPress]);

  const variantStyle = variantClasses[variant];
  const sizeStyle = sizeClasses[size];

  const containerClassName = [
    'flex-row items-center justify-center',
    sizeStyle.container,
    variantStyle.container,
    (disabled || loading) && 'opacity-50',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const textClassName = [
    'font-semibold text-center',
    sizeStyle.text,
    variantStyle.text,
  ]
    .join(' ');

  const spinnerColor =
    variant === 'outline' || variant === 'ghost'
      ? '#E8C97A'
      : variant === 'secondary'
        ? '#F0EDE6'
        : '#0D0F14';

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      className={containerClassName}
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text className={`${textClassName}${icon ? ' ml-2' : ''}`}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
