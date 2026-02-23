import React, { useState, forwardRef } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';

interface InputProps extends Omit<TextInputProps, 'className'> {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  error?: string;
  icon?: React.ReactNode;
  className?: string;
}

const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    placeholder,
    value,
    onChangeText,
    secureTextEntry,
    error,
    icon,
    className = '',
    ...rest
  },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);

  const borderClassName = error
    ? 'border-ember'
    : isFocused
      ? 'border-primary'
      : 'border-stroke';

  const containerClassName = [
    'flex-row items-center rounded-input border px-4 py-3 bg-surface',
    borderClassName,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View className="w-full">
      {label && (
        <Text className="text-sm font-medium text-text mb-1.5">{label}</Text>
      )}
      <View className={containerClassName}>
        {icon && <View className="mr-2">{icon}</View>}
        <TextInput
          ref={ref}
          className="flex-1 text-base text-text"
          placeholder={placeholder}
          placeholderTextColor="#8A8FA0"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />
      </View>
      {error && (
        <Text className="text-xs text-ember mt-1">{error}</Text>
      )}
    </View>
  );
});

export default Input;
