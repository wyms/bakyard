import { useState, useEffect, useCallback, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Configure default notification handling behavior.
 * Show alerts and play sounds even when the app is in the foreground.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Hook for managing push notifications, registration, unread badge counts,
 * and real-time notification updates.
 *
 * Usage:
 * ```tsx
 * const { unreadCount, registerForPush, markAllAsRead } = useNotifications();
 * ```
 */
export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const notificationListenerRef = useRef<Notifications.EventSubscription | null>(null);
  const responseListenerRef = useRef<Notifications.EventSubscription | null>(null);

  // ---------- Fetch initial unread count ----------

  const fetchUnreadCount = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)
      .eq('user_id', user.id);

    if (!error && count !== null) {
      setUnreadCount(count);
      await Notifications.setBadgeCountAsync(count);
    }
  }, []);

  // ---------- Register for push notifications ----------

  const registerForPush = useCallback(async (): Promise<string | null> => {
    // Check and request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('useNotifications: Push notification permission not granted');
      return null;
    }

    // Android requires a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF8C00',
      });
    }

    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.error(
        'useNotifications: Missing projectId. Ensure eas.projectId is set in app.json extra.'
      );
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    setExpoPushToken(token);

    // Save push token to the user's profile in Supabase
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from('users')
        .update({ push_token: token })
        .eq('id', user.id);

      if (error) {
        console.error('useNotifications: Failed to save push token:', error.message);
      }
    }

    return token;
  }, []);

  // ---------- Mark all notifications as read ----------

  const markAllAsRead = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      setUnreadCount(0);
      await Notifications.setBadgeCountAsync(0);
    }
  }, []);

  // ---------- Set up realtime subscription and notification listeners ----------

  useEffect(() => {
    let isMounted = true;

    async function setup() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !isMounted) return;

      // Fetch initial unread count
      await fetchUnreadCount();

      // Subscribe to realtime changes on the notifications table for this user
      const channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes' as never,
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            if (isMounted) {
              setUnreadCount((prev) => {
                const newCount = prev + 1;
                Notifications.setBadgeCountAsync(newCount);
                return newCount;
              });
            }
          }
        )
        .on(
          'postgres_changes' as never,
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            // On any update (e.g. marking as read), re-fetch the accurate count
            if (isMounted) {
              fetchUnreadCount();
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

      // Listen for notifications received while app is foregrounded
      notificationListenerRef.current =
        Notifications.addNotificationReceivedListener((_notification) => {
          // Refresh the unread count when a push notification arrives
          if (isMounted) {
            fetchUnreadCount();
          }
        });

      // Listen for notification taps (user interacted with a notification)
      responseListenerRef.current =
        Notifications.addNotificationResponseReceivedListener((_response) => {
          // The app can handle deep linking here based on notification data.
          // For now, just refresh the count.
          if (isMounted) {
            fetchUnreadCount();
          }
        });
    }

    setup();

    return () => {
      isMounted = false;

      // Clean up realtime subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      // Clean up notification listeners
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
        notificationListenerRef.current = null;
      }

      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
        responseListenerRef.current = null;
      }
    };
  }, [fetchUnreadCount]);

  return {
    /** Number of unread notifications for the current user. */
    unreadCount,
    /** The Expo push token, if registration has completed. */
    expoPushToken,
    /** Register for push notifications, save token to Supabase. Returns the token or null. */
    registerForPush,
    /** Mark all of the current user's notifications as read and reset the badge. */
    markAllAsRead,
  };
}
