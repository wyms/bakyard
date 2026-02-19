import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/hooks/useAuth';
import type { Notification, NotificationType } from '@/lib/types/database';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';

const NOTIFICATION_ICONS: Record<
  NotificationType,
  { name: keyof typeof Ionicons.glyphMap; color: string }
> = {
  booking_confirm: { name: 'checkmark-circle', color: '#4CAF50' },
  payment_reminder: { name: 'card', color: '#FF9800' },
  session_update: { name: 'calendar', color: '#1A5E63' },
  membership: { name: 'star', color: '#D4A574' },
  promo: { name: 'megaphone', color: '#FF6B6B' },
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw new Error(error.message);
      setNotifications((data as Notification[]) ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load notifications.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = useCallback(
    async (notification: Notification) => {
      if (notification.is_read) return;

      try {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notification.id);

        if (error) throw new Error(error.message);

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n,
          ),
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to mark notification as read.';
        Alert.alert('Error', message);
      }
    },
    [],
  );

  const renderNotification = useCallback(
    ({ item }: { item: Notification }) => {
      const iconConfig = NOTIFICATION_ICONS[item.type] ?? {
        name: 'notifications' as keyof typeof Ionicons.glyphMap,
        color: '#999',
      };
      const timeAgo = formatDistanceToNow(parseISO(item.created_at), {
        addSuffix: true,
      });

      return (
        <Pressable
          onPress={() => handleMarkAsRead(item)}
          className="mb-3"
        >
          <Card
            className={[
              'flex-row items-start gap-3',
              !item.is_read && 'border-l-4 border-l-[#1A5E63]',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {/* Icon */}
            <View
              className="w-10 h-10 rounded-full items-center justify-center mt-0.5"
              style={{ backgroundColor: `${iconConfig.color}15` }}
            >
              <Ionicons
                name={iconConfig.name}
                size={20}
                color={iconConfig.color}
              />
            </View>

            {/* Content */}
            <View className="flex-1">
              <View className="flex-row items-start justify-between">
                <Text
                  className={`text-base flex-1 mr-2 ${
                    item.is_read
                      ? 'font-medium text-charcoal'
                      : 'font-bold text-charcoal'
                  }`}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {!item.is_read && (
                  <View className="w-2.5 h-2.5 rounded-full bg-[#1A5E63] mt-1.5" />
                )}
              </View>
              <Text
                className="text-sm text-charcoal/60 mt-0.5 leading-5"
                numberOfLines={2}
              >
                {item.body}
              </Text>
              <Text className="text-xs text-charcoal/40 mt-1.5">{timeAgo}</Text>
            </View>
          </Card>
        </Pressable>
      );
    },
    [handleMarkAsRead],
  );

  const renderEmpty = useCallback(() => {
    if (loading) return null;

    return (
      <View className="flex-1 items-center justify-center pt-24 px-8">
        <View className="w-16 h-16 rounded-full bg-[#1A5E63]/10 items-center justify-center mb-4">
          <Ionicons name="notifications-off-outline" size={28} color="#1A5E63" />
        </View>
        <Text className="text-lg font-semibold text-charcoal text-center">
          No notifications yet
        </Text>
        <Text className="text-sm text-charcoal/50 text-center mt-1">
          We will let you know when something important happens
        </Text>
      </View>
    );
  }, [loading]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-offwhite" edges={['bottom']}>
        <View className="px-6 pt-4 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={88} borderRadius={16} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['bottom']}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1A5E63"
          />
        }
      />
    </SafeAreaView>
  );
}
