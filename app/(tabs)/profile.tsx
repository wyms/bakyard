import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/lib/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { getMyMembership, getMembershipTiers } from '@/lib/api/memberships';
import type { User, Membership } from '@/lib/types/database';
import Skeleton from '@/components/ui/Skeleton';

interface RecentBooking {
  id: string;
  session: {
    id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    product?: { title: string } | null;
  };
}

export default function ProfileScreen() {
  const { user: authUser, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [bookingCount, setBookingCount] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!authUser?.id) return;

    try {
      const [profileResult, membershipResult, bookingsResult, sessionsResult, recentResult] =
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
          supabase
            .from('bookings')
            .select('id, session:sessions(id, starts_at, ends_at, status, product:products(title))')
            .eq('user_id', authUser.id)
            .eq('status', 'confirmed')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

      if (profileResult.data) {
        setProfile(profileResult.data as User);
      }
      setMembership(membershipResult);
      setBookingCount(bookingsResult.count ?? 0);
      setTotalSessions(sessionsResult.count ?? 0);
      if (recentResult.data) {
        setRecentBookings(recentResult.data as unknown as RecentBooking[]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load profile.';
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
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      Alert.alert('Error', message);
    }
  };

  const displayName =
    profile?.full_name ??
    authUser?.user_metadata?.full_name ??
    authUser?.email ??
    'User';

  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const tiers = getMembershipTiers();
  const tierConfig = membership
    ? tiers.find((t) => t.tier === membership.tier)
    : undefined;

  const hoursOnSand = totalSessions > 0 ? `${Math.round(totalSessions * 1.5)}h` : '--';

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <View style={{ padding: 22, paddingTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <Skeleton width={64} height={64} borderRadius={32} />
            <View style={{ gap: 6 }}>
              <Skeleton width={140} height={22} borderRadius={6} />
              <Skeleton width={100} height={14} borderRadius={6} />
            </View>
          </View>
          <Skeleton width="100%" height={80} borderRadius={12} className="mb-4" />
          <Skeleton width="100%" height={120} borderRadius={12} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero section */}
        <View
          style={{
            backgroundColor: '#1A1208',
            paddingHorizontal: 22,
            paddingTop: 16,
            paddingBottom: 24,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
          }}
        >
          {/* Avatar */}
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#E8C97A',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: 'rgba(232,201,122,0.3)',
              flexShrink: 0,
            }}
          >
            <Text
              style={{
                fontFamily: 'BebasNeue_400Regular',
                fontSize: 24,
                color: '#0D0F14',
                letterSpacing: 0.8,
              }}
            >
              {initials || '?'}
            </Text>
          </View>

          {/* Name + tag */}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: 'BebasNeue_400Regular',
                fontSize: 24,
                letterSpacing: 1,
                color: '#F0EDE6',
                lineHeight: 24,
                marginBottom: 4,
              }}
              numberOfLines={1}
            >
              {displayName.toUpperCase()}
            </Text>
            <Text
              style={{
                fontFamily: 'BarlowCondensed_600SemiBold',
                fontSize: 10,
                letterSpacing: 2.8,
                textTransform: 'uppercase',
                color: '#E8C97A',
              }}
            >
              Bakyard Member · Plano, TX
            </Text>
          </View>
        </View>

        {/* Stats grid — 3-col */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: 'rgba(255,255,255,0.05)',
            gap: 1,
          }}
        >
          {[
            { value: String(totalSessions), label: 'Sessions' },
            { value: String(bookingCount), label: 'This Month' },
            { value: hoursOnSand, label: 'On Sand' },
          ].map((stat) => (
            <View key={stat.label} style={{ flex: 1, backgroundColor: '#131720', paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: 'BebasNeue_400Regular',
                  fontSize: 26,
                  color: '#E8C97A',
                  lineHeight: 26,
                }}
              >
                {stat.value}
              </Text>
              <Text
                style={{
                  fontFamily: 'BarlowCondensed_600SemiBold',
                  fontSize: 9,
                  letterSpacing: 2.4,
                  textTransform: 'uppercase',
                  color: '#5A5F72',
                  marginTop: 2,
                }}
              >
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Plan card */}
        <Pressable
          onPress={() => router.push('/(tabs)/membership' as never)}
          style={({ pressed }) => ({
            marginHorizontal: 22,
            marginTop: 16,
            borderRadius: 14,
            padding: 16,
            backgroundColor: pressed ? '#1A2212' : '#1A1F0A',
            borderWidth: 1,
            borderColor: pressed ? 'rgba(232,201,122,0.35)' : 'rgba(232,201,122,0.2)',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          })}
        >
          <Text style={{ fontSize: 24 }}>⚡</Text>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: 'BarlowCondensed_700Bold',
                fontSize: 14,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: '#E8C97A',
                marginBottom: 2,
              }}
            >
              {tierConfig?.name ?? 'No Active Plan'}
            </Text>
            <Text style={{ fontSize: 11, color: '#5A5F72' }}>
              {membership?.expires_at
                ? `Renews ${format(parseISO(membership.expires_at), 'MMM d')} · Open play + 2 clinics`
                : 'Tap to explore membership plans'}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'BarlowCondensed_700Bold',
              fontSize: 10,
              letterSpacing: 2.4,
              textTransform: 'uppercase',
              color: '#E8C97A',
            }}
          >
            Manage
          </Text>
        </Pressable>

        {/* Recent sessions */}
        <View style={{ marginTop: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingBottom: 4 }}>
            <Text
              style={{
                fontFamily: 'BebasNeue_400Regular',
                fontSize: 18,
                letterSpacing: 1.6,
                color: '#F0EDE6',
              }}
            >
              RECENT SESSIONS
            </Text>
            <Text
              style={{
                fontFamily: 'BarlowCondensed_600SemiBold',
                fontSize: 10,
                letterSpacing: 2,
                textTransform: 'uppercase',
                color: '#E8C97A',
              }}
            >
              View all
            </Text>
          </View>

          {recentBookings.length > 0 ? (
            recentBookings.map((booking) => {
              const sessionName = booking.session?.product?.title ?? 'Session';
              const startsAt = booking.session?.starts_at;
              const isCompleted = booking.session?.status === 'completed';
              return (
                <View
                  key={booking.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    paddingHorizontal: 22,
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF72', flexShrink: 0 }} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{ fontFamily: 'BarlowCondensed_700Bold', fontSize: 14, color: '#F0EDE6', letterSpacing: 0.6, marginBottom: 2 }}
                      numberOfLines={1}
                    >
                      {sessionName}
                    </Text>
                    {startsAt && (
                      <Text style={{ fontSize: 11, color: '#5A5F72' }}>
                        {format(parseISO(startsAt), 'MMM d · h:mm a')}
                      </Text>
                    )}
                  </View>
                  {isCompleted && (
                    <View style={{ backgroundColor: 'rgba(76,175,114,0.15)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: 'BarlowCondensed_700Bold', fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', color: '#4CAF72' }}>Done</Text>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={{ paddingHorizontal: 22, paddingVertical: 16 }}>
              <Text style={{ color: '#5A5F72', fontSize: 13 }}>No recent sessions yet.</Text>
            </View>
          )}
        </View>

        {/* Refer a friend */}
        <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 4 }}>
          <Pressable
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#1A1C24' : '#181C26',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.04)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            })}
            onPress={() => Alert.alert('Refer a Friend', 'Referral program coming soon!')}
          >
            <View>
              <Text style={{ fontFamily: 'BarlowCondensed_700Bold', fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase', color: '#F0EDE6', marginBottom: 2 }}>
                Refer a Friend
              </Text>
              <Text style={{ fontSize: 11, color: '#5A5F72' }}>Earn a free open play session</Text>
            </View>
            <Text style={{ color: '#E8C97A', fontSize: 16 }}>→</Text>
          </Pressable>
        </View>

        {/* Contact info */}
        <View style={{ paddingHorizontal: 22, paddingTop: 4 }}>
          <View
            style={{
              backgroundColor: '#181C26',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.04)',
              overflow: 'hidden',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' }}>
              <Ionicons name="mail-outline" size={16} color="#E8C97A" />
              <Text style={{ fontSize: 13, color: '#F0EDE6', marginLeft: 10, flex: 1 }}>contact@BeachBakyard.com</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
              <Ionicons name="logo-instagram" size={16} color="#E8C97A" />
              <Text style={{ fontSize: 13, color: '#F0EDE6', marginLeft: 10 }}>@beach.bakyard</Text>
            </View>
          </View>
        </View>

        {/* Settings */}
        <View style={{ paddingHorizontal: 22, paddingTop: 16 }}>
          <View
            style={{
              backgroundColor: '#181C26',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.04)',
              overflow: 'hidden',
            }}
          >
            <SettingsRow
              icon="card-outline"
              label="Payment Methods"
              onPress={() => Alert.alert('Payment Methods', 'Payment method management coming soon.')}
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
              onPress={() => Alert.alert('Help & Support', 'Support options coming soon.')}
            />
          </View>
        </View>

        {/* Sign out */}
        <View style={{ paddingHorizontal: 22, paddingTop: 16 }}>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => ({
              backgroundColor: 'transparent',
              borderRadius: 12,
              padding: 14,
              borderWidth: 1.5,
              borderColor: pressed ? '#c0451d' : '#D95F2B',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            })}
          >
            <Ionicons name="log-out-outline" size={18} color="#D95F2B" />
            <Text style={{ fontFamily: 'BarlowCondensed_700Bold', fontSize: 14, letterSpacing: 1.6, textTransform: 'uppercase', color: '#D95F2B' }}>
              Sign Out
            </Text>
          </Pressable>
        </View>
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
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: showBorder ? 1 : 0,
        borderBottomColor: 'rgba(255,255,255,0.04)',
        backgroundColor: pressed ? '#1A1C24' : 'transparent',
      })}
    >
      <Ionicons name={icon} size={18} color="#E8C97A" />
      <Text style={{ flex: 1, fontSize: 14, color: '#F0EDE6', marginLeft: 12 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#5A5F72" />
    </Pressable>
  );
}
