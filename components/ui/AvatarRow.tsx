import React from 'react';
import { View, Text } from 'react-native';
import Avatar from './Avatar';

interface AvatarRowUser {
  id: string;
  name: string;
  avatar_url?: string | null;
  paid?: boolean;
}

interface AvatarRowProps {
  users: AvatarRowUser[];
  max?: number;
  size?: number;
  className?: string;
}

export default function AvatarRow({
  users,
  max = 5,
  size = 36,
  className = '',
}: AvatarRowProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <View className={`flex-row items-center ${className}`}>
      {visible.map((user, index) => (
        <View
          key={user.id}
          style={{
            marginLeft: index === 0 ? 0 : -(size * 0.25),
            zIndex: visible.length - index,
          }}
        >
          <View className="rounded-full border-2 border-surface">
            <Avatar
              name={user.name}
              uri={user.avatar_url}
            />
          </View>
          {user.paid && (
            <View
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary items-center justify-center border border-surface"
            >
              <Text className="text-white text-[8px] font-bold">$</Text>
            </View>
          )}
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={{
            marginLeft: -(size * 0.25),
            width: size,
            height: size,
            zIndex: 0,
          }}
          className="rounded-full bg-bg items-center justify-center"
        >
          <Text className="text-muted text-xs font-semibold">
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}
