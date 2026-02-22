import React from 'react';
import { View, Text } from 'react-native';
import type { MembershipTierConfig } from '@/lib/utils/constants';
import { formatPrice } from '@/lib/utils/pricing';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import BenefitsList from '@/components/membership/BenefitsList';

interface TierCardProps {
  tier: MembershipTierConfig;
  isActive: boolean;
  isRecommended?: boolean;
  onSubscribe: (tier: MembershipTierConfig) => void;
  loading?: boolean;
}

export default function TierCard({
  tier,
  isActive,
  isRecommended = false,
  onSubscribe,
  loading = false,
}: TierCardProps) {
  const priceDisplay = formatPrice(tier.price_cents);

  return (
    <Card
      className={[
        'mb-4',
        isActive && 'border-2 border-primary',
        isRecommended && !isActive && 'border-2 border-accent',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Header Row */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-bold text-text">{tier.name}</Text>
          {isActive && <Badge label="Current" variant="info" size="sm" />}
        </View>
        {isRecommended && !isActive && (
          <Badge label="Best Value" variant="default" size="sm" />
        )}
      </View>

      {/* Price */}
      <View className="flex-row items-baseline mb-1">
        <Text className="text-3xl font-bold text-text">{priceDisplay}</Text>
        <Text className="text-sm text-muted ml-1">/month</Text>
      </View>

      {/* Discount Highlight */}
      <View className="bg-primary/10 rounded-lg px-3 py-1.5 self-start mb-4">
        <Text className="text-sm font-semibold text-primary">
          {tier.discount_percent}% off all bookings
        </Text>
      </View>

      {/* Benefits */}
      <BenefitsList benefits={tier.benefits} />

      {/* CTA Button */}
      <View className="mt-5">
        {isActive ? (
          <Button
            title="Current Plan"
            onPress={() => {}}
            variant="outline"
            disabled
          />
        ) : (
          <Button
            title="Subscribe"
            onPress={() => onSubscribe(tier)}
            variant={isRecommended ? 'primary' : 'secondary'}
            loading={loading}
          />
        )}
      </View>
    </Card>
  );
}
