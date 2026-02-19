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
    ? 'border-red-500'
    : isFocused
      ? 'border-[#1A5E63]'
      : 'border-gray-200';

  const containerClassName = [
    'flex-row items-center rounded-xl border px-4 py-3 bg-white',
    borderClassName,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View className="w-full">
      {label && (
        <Text className="text-sm font-medium text-[#2D2D2D] mb-1.5">{label}</Text>
      )}
      <View className={containerClassName}>
        {icon && <View className="mr-2">{icon}</View>}
        <TextInput
          ref={ref}
          className="flex-1 text-base text-[#2D2D2D]"
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...rest}
        />
      </View>
      {error && (
        <Text className="text-xs text-red-500 mt-1">{error}</Text>
      )}
    </View>
  );
});

export default Input;
