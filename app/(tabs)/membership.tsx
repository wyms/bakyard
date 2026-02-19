import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyMembership, getMembershipTiers } from '@/lib/api/memberships';
import { createSubscription } from '@/lib/api/payments';
import type { Membership } from '@/lib/types/database';
import type { MembershipTierConfig } from '@/lib/utils/constants';
import Skeleton from '@/components/ui/Skeleton';
import ActiveMembershipCard from '@/components/membership/ActiveMembershipCard';
import TierCard from '@/components/membership/TierCard';

export default function MembershipScreen() {
  const [membership, setMembership] = useState<Membership | null>(null);
  const [tiers] = useState<MembershipTierConfig[]>(getMembershipTiers());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribingTier, setSubscribingTier] = useState<string | null>(null);

  const fetchMembership = useCallback(async () => {
    try {
      const data = await getMyMembership();
      setMembership(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load membership.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMembership();
  }, [fetchMembership]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMembership();
  }, [fetchMembership]);

  const handleSubscribe = useCallback(
    async (tier: MembershipTierConfig) => {
      try {
        setSubscribingTier(tier.tier);
        const response = await createSubscription(tier.tier);
        Alert.alert(
          'Subscription Started',
          `Your ${tier.name} membership is being set up. Subscription ID: ${response.subscription_id}`,
        );
        await fetchMembership();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to create subscription.';
        Alert.alert('Error', message);
      } finally {
        setSubscribingTier(null);
      }
    },
    [fetchMembership],
  );

  const handleCancelled = useCallback(() => {
    fetchMembership();
  }, [fetchMembership]);

  const activeTierConfig = membership
    ? tiers.find((t) => t.tier === membership.tier)
    : undefined;

  const upgradeTiers = membership
    ? tiers.filter((t) => t.tier !== membership.tier)
    : tiers;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-offwhite" edges={['top']}>
        <View className="px-6 pt-4 pb-2">
          <Text className="text-3xl font-bold text-charcoal">Membership</Text>
        </View>
        <View className="px-6 pt-4 gap-4">
          <Skeleton width="100%" height={200} borderRadius={16} />
          <Skeleton width="100%" height={280} borderRadius={16} />
          <Skeleton width="100%" height={280} borderRadius={16} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-offwhite" edges={['top']}>
      <View className="px-6 pt-4 pb-2">
        <Text className="text-3xl font-bold text-charcoal">Membership</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1A5E63"
          />
        }
      >
        {/* Active Membership Card */}
        {membership && activeTierConfig && (
          <View className="mt-4">
            <ActiveMembershipCard
              membership={membership}
              tierConfig={activeTierConfig}
              onCancelled={handleCancelled}
            />
          </View>
        )}

        {/* Section Header */}
        <View className="mt-4 mb-3">
          <Text className="text-xl font-bold text-charcoal">
            {membership ? 'Upgrade Your Plan' : 'Choose Your Plan'}
          </Text>
          <Text className="text-sm text-charcoal/50 mt-1">
            {membership
              ? 'Unlock more benefits with a higher tier'
              : 'Join the Bakyard community and save on every booking'}
          </Text>
        </View>

        {/* Tier Cards */}
        {upgradeTiers.map((tier) => (
          <TierCard
            key={tier.tier}
            tier={tier}
            isActive={membership?.tier === tier.tier}
            isRecommended={tier.tier === 'sand_regular'}
            onSubscribe={handleSubscribe}
            loading={subscribingTier === tier.tier}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
