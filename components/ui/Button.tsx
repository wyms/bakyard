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
    container: 'bg-[#D4A574] shadow-sm shadow-[#D4A574]/30',
    text: 'text-white',
  },
  secondary: {
    container: 'bg-[#1A5E63] shadow-sm shadow-[#1A5E63]/30',
    text: 'text-white',
  },
  outline: {
    container: 'bg-transparent border-2 border-[#D4A574]',
    text: 'text-[#D4A574]',
  },
  ghost: {
    container: 'bg-transparent',
    text: 'text-[#1A5E63]',
  },
};

const sizeClasses: Record<ButtonSize, { container: string; text: string }> = {
  sm: {
    container: 'px-4 py-2 rounded-lg',
    text: 'text-sm',
  },
  md: {
    container: 'px-6 py-3 rounded-xl',
    text: 'text-base',
  },
  lg: {
    container: 'px-8 py-4 rounded-xl',
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

  const spinnerColor = variant === 'outline' || variant === 'ghost' ? '#D4A574' : '#FFFFFF';

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      className={containerClassName}
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
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
