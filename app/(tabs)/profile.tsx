import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { getMyMembership, getMembershipTiers } from '@/lib/api/memberships';
import type { User, Membership } from '@/lib/types/database';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';

export default function ProfileScreen() {
  const { user: authUser, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [bookingCount, setBookingCount] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!authUser?.id) return;

    try {
      const [profileResult, membershipResult, bookingsResult, sessionsResult] =
        await Promise.all([
          supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle(),
          getMyMembership(),
          supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', authUser.id)
            .eq('status', 'confirmed')
            .gte(
              'reserved_at',
              new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                1,
              ).toISOString(),
            ),
          supabase
            .from('bookings')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', authUser.id)
            .eq('status', 'confirmed'),
        ]);

      if (profileResult.data) {
        setProfile(profileResult.data as User);
      }
      setMembership(membershipResult);
      setBookingCount(bookingsResult.count ?? 0);
      setTotalSessions(sessionsResult.count ?? 0);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load profile.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      Alert.alert('Error', message);
    }
  };

  const displayName =
    profile?.full_name ??
    authUser?.user_metadata?.full_name ??
    authUser?.email ??
    'User';

  const email = authUser?.email ?? '';

  const tiers = getMembershipTiers();
  const tierConfig = membership
    ? tiers.find((t) => t.tier === membership.tier)
    : undefined;

  const skillLevelLabel = profile?.skill_level
    ? profile.skill_level.charAt(0).toUpperCase() + profile.skill_level.slice(1)
    : null;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-offwhite" edges={['top']}>
        <View className="px-6 pt-4 pb-2">
          <Text className="text-3xl font-bold text-charcoal">Profile</Text>
        </View>
        <View className="px-6 pt-6 items-center gap-4">
          <Skeleton width={96} height={96} borderRadius={48} />
          <Skeleton width={180} height={24} borderRadius={8} />
          <Skeleton width={220} height={16} borderRadius={8} />
          <Skeleton width="100%" height={100} borderRadius={16} />
          <Skeleton width="100%" height={200} borderRadius={16} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top']}>
      <View className="px-6 pt-4 pb-2">
        <Text className="text-3xl font-bold text-charcoal">Profile</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Section */}
        <View className="items-center mt-4 mb-6">
          <View className="relative">
            <Avatar
              uri={profile?.avatar_url}
              name={displayName}
              size="lg"
            />
            <Pressable
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary items-center justify-center border-2 border-white"
              onPress={() => {
                Alert.alert('Edit Photo', 'Photo upload coming soon.');
              }}
            >
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </Pressable>
          </View>

          <Text className="text-xl font-bold text-charcoal mt-3">
            {displayName}
          </Text>
          {email ? (
            <Text className="text-sm text-charcoal/50 mt-0.5">{email}</Text>
          ) : null}

          {/* Badges */}
          <View className="flex-row items-center gap-2 mt-3">
            {skillLevelLabel && (
              <Badge label={skillLevelLabel} variant="info" size="sm" />
            )}
            {tierConfig && (
              <Badge label={tierConfig.name} variant="default" size="sm" />
            )}
          </View>
        </View>

        {/* Stats */}
        <Card className="mb-4">
          <View className="flex-row">
            <View className="flex-1 items-center py-2">
              <Text className="text-2xl font-bold text-primary">
                {totalSessions}
              </Text>
              <Text className="text-xs text-charcoal/50 mt-0.5">
                Total Sessions
              </Text>
            </View>
            <View className="w-px bg-stroke" />
            <View className="flex-1 items-center py-2">
              <Text className="text-2xl font-bold text-primary">
                {bookingCount}
              </Text>
              <Text className="text-xs text-charcoal/50 mt-0.5">
                This Month
              </Text>
            </View>
            <View className="w-px bg-stroke" />
            <View className="flex-1 items-center py-2">
              <Text className="text-2xl font-bold text-primary">
                {membership ? `${membership.discount_percent}%` : '--'}
              </Text>
              <Text className="text-xs text-charcoal/50 mt-0.5">
                Discount
              </Text>
            </View>
          </View>
        </Card>

        {/* Settings Sections */}
        <View className="mt-2">
          <Text className="text-base font-semibold text-charcoal mb-3">
            Settings
          </Text>

          <Card className="mb-4 p-0">
            <SettingsRow
              icon="card-outline"
              label="Payment Methods"
              onPress={() => {
                Alert.alert(
                  'Payment Methods',
                  'Payment method management coming soon.',
                );
              }}
              showBorder
            />
            <SettingsRow
              icon="notifications-outline"
              label="Notifications"
              onPress={() => router.push('/notifications')}
              showBorder
            />
            <SettingsRow
              icon="help-circle-outline"
              label="Help & Support"
              onPress={() => {
                Alert.alert('Help & Support', 'Support options coming soon.');
              }}
            />
          </Card>
        </View>

        {/* Sign Out */}
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          variant="outline"
          className="mt-2 border-[#FF6B6B] border-2"
          icon={<Ionicons name="log-out-outline" size={18} color="#FF6B6B" />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  showBorder?: boolean;
}

function SettingsRow({ icon, label, onPress, showBorder = false }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center px-4 py-3.5 ${showBorder ? 'border-b border-stroke' : ''}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? '#F6F1EA' : 'transparent',
      })}
    >
      <Ionicons name={icon} size={20} color="#3F6F6A" />
      <Text className="flex-1 text-base text-charcoal ml-3">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#999" />
    </Pressable>
  );
}
