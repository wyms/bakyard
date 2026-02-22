import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import type { Membership } from '@/lib/types/database';
import type { MembershipTierConfig } from '@/lib/utils/constants';
import { cancelMembership } from '@/lib/api/memberships';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface ActiveMembershipCardProps {
  membership: Membership;
  tierConfig: MembershipTierConfig | undefined;
  onCancelled: () => void;
}

export default function ActiveMembershipCard({
  membership,
  tierConfig,
  onCancelled,
}: ActiveMembershipCardProps) {
  const [cancelling, setCancelling] = useState(false);

  const tierName = tierConfig?.name ?? 'Membership';
  const periodStart = format(parseISO(membership.current_period_start), 'MMM d, yyyy');
  const periodEnd = format(parseISO(membership.current_period_end), 'MMM d, yyyy');

  const statusVariant =
    membership.status === 'active'
      ? 'success'
      : membership.status === 'past_due'
        ? 'warning'
        : 'accent';

  const statusLabel =
    membership.status === 'active'
      ? 'Active'
      : membership.status === 'past_due'
        ? 'Past Due'
        : 'Cancelled';

  const handleCancel = () => {
    Alert.alert(
      'Cancel Membership',
      'Are you sure you want to cancel? Your benefits will continue until the end of the current billing period.',
      [
        { text: 'Keep Membership', style: 'cancel' },
        {
          text: 'Cancel Membership',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              await cancelMembership();
              onCancelled();
            } catch (err: unknown) {
              const message =
                err instanceof Error
                  ? err.message
                  : 'Failed to cancel membership.';
              Alert.alert('Error', message);
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Card className="mb-4 border border-primary/20">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-2">
          <Ionicons name="star" size={20} color="#3F6F6A" />
          <Text className="text-lg font-bold text-text">{tierName}</Text>
        </View>
        <Badge label={statusLabel} variant={statusVariant} size="sm" />
      </View>

      {/* Stats Grid */}
      <View className="flex-row gap-3 mb-4">
        <View className="flex-1 bg-bg rounded-xl p-3">
          <Text className="text-xs text-muted mb-1">Discount</Text>
          <Text className="text-xl font-bold text-primary">
            {membership.discount_percent}%
          </Text>
        </View>
        <View className="flex-1 bg-bg rounded-xl p-3">
          <Text className="text-xs text-muted mb-1">Priority</Text>
          <Text className="text-xl font-bold text-primary">
            {membership.priority_booking_hours}hr
          </Text>
        </View>
        <View className="flex-1 bg-bg rounded-xl p-3">
          <Text className="text-xs text-muted mb-1">Guest Passes</Text>
          <Text className="text-xl font-bold text-primary">
            {membership.guest_passes_remaining === -1
              ? 'Unlimited'
              : membership.guest_passes_remaining}
          </Text>
        </View>
      </View>

      {/* Billing Period */}
      <View className="bg-bg rounded-xl p-3 mb-4">
        <Text className="text-xs text-muted mb-0.5">Current Period</Text>
        <Text className="text-sm font-medium text-text">
          {periodStart} - {periodEnd}
        </Text>
      </View>

      {/* Actions */}
      <View className="gap-2">
        <Button
          title="Manage Subscription"
          onPress={() => {
            Alert.alert(
              'Manage Subscription',
              'Subscription management will open in your browser.',
            );
          }}
          variant="secondary"
        />
        <Button
          title="Cancel Membership"
          onPress={handleCancel}
          variant="ghost"
          loading={cancelling}
        />
      </View>
    </Card>
  );
}
