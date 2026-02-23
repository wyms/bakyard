import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Alert, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/lib/utils/pricing';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

interface PlanConfig {
  id: string;
  name: string;
  monthlyPrice: number;
  description: string;
  features: string[];
  featured?: boolean;
  ghost?: boolean;
}

const PRD_PLANS: PlanConfig[] = [
  {
    id: 'drop_in',
    name: 'Drop-In',
    monthlyPrice: 2000,
    description: 'Pay as you go, no commitment',
    features: [
      'Book any open play session',
      'No membership required',
      'Standard booking window',
    ],
    ghost: true,
  },
  {
    id: 'monthly',
    name: 'Monthly Unlimited',
    monthlyPrice: 14900,
    description: 'Unlimited sessions, best value',
    features: [
      'Unlimited open play sessions',
      '24-hour early booking window',
      '1 free guest pass per month',
      'Member badge on profile',
    ],
    featured: true,
  },
  {
    id: 'elite',
    name: 'Elite Training',
    monthlyPrice: 29900,
    description: 'Everything + private training',
    features: [
      'Everything in Monthly',
      'Unlimited guest passes',
      '48-hour early booking window',
      'Priority customer support',
      'Invite-only events access',
    ],
    ghost: true,
  },
];

const ANNUAL_MULTIPLIER = 9.6; // 12 months × 0.8 (20% savings)

interface PlanCardProps {
  plan: PlanConfig;
  isAnnual: boolean;
  onPress: (plan: PlanConfig) => void;
}

function PlanCard({ plan, isAnnual, onPress }: PlanCardProps) {
  const price = isAnnual
    ? Math.round((plan.monthlyPrice * ANNUAL_MULTIPLIER) / 12)
    : plan.monthlyPrice;

  return (
    <Pressable
      onPress={() => onPress(plan)}
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
      className={[
        'rounded-2xl p-5 mb-4 border',
        plan.featured
          ? 'bg-[#1A1C24] border-sand'
          : 'bg-surface border-stroke',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-display text-2xl text-offwhite">{plan.name.toUpperCase()}</Text>
        {plan.featured && <Badge label="Most Popular" variant="default" size="sm" />}
      </View>

      {/* Price */}
      <View className="flex-row items-baseline mb-1">
        <Text className="text-3xl font-bold text-sand">{formatPrice(price)}</Text>
        <Text className="text-sm text-mid ml-1">/mo</Text>
        {plan.ghost && plan.id === 'drop_in' && (
          <Text className="text-xs text-mid ml-2">per session</Text>
        )}
      </View>
      {isAnnual && (
        <Text className="text-xs text-success mb-2">
          Save 20% · {formatPrice(plan.monthlyPrice * ANNUAL_MULTIPLIER)}/yr
        </Text>
      )}

      <Text className="text-xs text-mid mb-4">{plan.description}</Text>

      {/* Features */}
      {plan.features.map((f) => (
        <View key={f} className="flex-row items-center mb-2">
          <Ionicons name="checkmark-circle" size={16} color="#4CAF72" />
          <Text className="text-sm text-offwhite ml-2">{f}</Text>
        </View>
      ))}

      {/* CTA */}
      <View className="mt-4">
        <Button
          title={plan.featured ? 'GET STARTED' : 'Choose Plan'}
          variant={plan.featured ? 'primary' : 'outline'}
          onPress={() => onPress(plan)}
        />
      </View>
    </Pressable>
  );
}

export default function MembershipScreen() {
  const [isAnnual, setIsAnnual] = useState(false);

  const handlePlanPress = useCallback((plan: PlanConfig) => {
    Alert.alert(plan.name, `Starting ${plan.name} subscription. Coming soon!`);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-2">
        <Text className="font-display text-4xl text-offwhite">PLANS</Text>
        <Text className="text-sm text-mid mt-1">
          Join the Bakyard community and save on every session.
        </Text>
      </View>

      {/* Monthly / Annual toggle */}
      <View className="flex-row items-center mx-5 mt-3 mb-4 bg-surface rounded-xl p-1 border border-stroke">
        <Pressable
          onPress={() => setIsAnnual(false)}
          className={[
            'flex-1 items-center py-2 rounded-lg',
            !isAnnual ? 'bg-accent' : '',
          ].join(' ')}
        >
          <Text className={`text-sm font-semibold ${!isAnnual ? 'text-[#0D0F14]' : 'text-mid'}`}>
            Monthly
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setIsAnnual(true)}
          className={[
            'flex-1 items-center py-2 rounded-lg',
            isAnnual ? 'bg-accent' : '',
          ].join(' ')}
        >
          <Text className={`text-sm font-semibold ${isAnnual ? 'text-[#0D0F14]' : 'text-mid'}`}>
            Annual{' '}
            <Text className={isAnnual ? 'text-[#0D0F14]' : 'text-success'}>Save 20%</Text>
          </Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
      >
        {PRD_PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isAnnual={isAnnual}
            onPress={handlePlanPress}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
