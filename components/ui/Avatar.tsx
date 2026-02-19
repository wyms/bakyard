import React from 'react';
import { View, Text, Image } from 'react-native';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: AvatarSize;
}

const sizeMap: Record<AvatarSize, { dimension: number; text: string }> = {
  sm: { dimension: 32, text: 'text-xs' },
  md: { dimension: 48, text: 'text-base' },
  lg: { dimension: 80, text: 'text-2xl' },
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = ['#D4A574', '#1A5E63', '#FF6B6B', '#4CAF50', '#FF9800', '#9C27B0'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function Avatar({ uri, name, size = 'md' }: AvatarProps) {
  const { dimension, text } = sizeMap[size];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: dimension, height: dimension, borderRadius: dimension / 2 }}
        className="bg-gray-200"
      />
    );
  }

  const bgColor = getColorFromName(name);

  return (
    <View
      style={{
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
        backgroundColor: bgColor,
      }}
      className="items-center justify-center"
    >
      <Text className={`${text} font-bold text-white`}>{getInitials(name)}</Text>
    </View>
  );
}
