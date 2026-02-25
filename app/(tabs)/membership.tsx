import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
      'Single open play session',
      'No commitment',
      'All skill levels welcome',
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
      '2 clinics per month',
      'Priority booking window',
      '10% off private lessons',
      'Cancel anytime',
    ],
    featured: true,
  },
  {
    id: 'elite',
    name: 'Elite Training',
    monthlyPrice: 29900,
    description: 'Everything + private training',
    features: [
      'All Monthly Unlimited benefits',
      '4 private lessons per month',
      'Personalised training plan',
      'Video analysis',
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
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: plan.featured ? 'rgba(232,201,122,0.35)' : 'rgba(255,255,255,0.07)',
        backgroundColor: plan.featured ? '#141A0A' : '#181C26',
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      {/* Featured top accent bar */}
      {plan.featured && (
        <View style={{ height: 2, flexDirection: 'row' }}>
          <View style={{ flex: 1, backgroundColor: '#D95F2B' }} />
          <View style={{ flex: 1, backgroundColor: '#E8C97A' }} />
        </View>
      )}

      <View style={{ padding: 18, position: 'relative' }}>
        {/* Most Popular badge */}
        {plan.featured && (
          <View style={{ position: 'absolute', top: 14, right: 14 }}>
            <Badge label="Most Popular" variant="default" size="sm" />
          </View>
        )}

        {/* Plan name */}
        <Text
          style={{
            fontFamily: 'BarlowCondensed_700Bold',
            fontSize: 12,
            letterSpacing: 2.8,
            textTransform: 'uppercase',
            color: plan.featured ? '#E8C97A' : '#8A8FA0',
            marginBottom: 4,
          }}
        >
          {plan.name.toUpperCase()}
        </Text>

        {/* Price */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: plan.ghost && plan.id === 'drop_in' ? 2 : 14 }}>
          <Text
            style={{
              fontFamily: 'BebasNeue_400Regular',
              fontSize: 36,
              letterSpacing: 0.6,
              color: '#F0EDE6',
              lineHeight: 38,
            }}
          >
            {formatPrice(price)}
          </Text>
          <Text style={{ fontSize: 12, color: '#5A5F72', fontWeight: '300' }}>/mo</Text>
        </View>
        {plan.ghost && plan.id === 'drop_in' && (
          <Text style={{ fontSize: 11, color: '#5A5F72', marginBottom: 12 }}>per session</Text>
        )}

        {/* Annual savings */}
        {isAnnual && (
          <Text style={{ fontSize: 11, color: '#4CAF72', marginBottom: 8 }}>
            {`Save 20% · ${formatPrice(plan.monthlyPrice * ANNUAL_MULTIPLIER)}/yr`}
          </Text>
        )}

        {/* Description */}
        <Text style={{ fontSize: 13, color: '#5A5F72', marginBottom: 14, fontWeight: '300' }}>
          {plan.description}
        </Text>

        {/* Features */}
        {plan.features.map((f) => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 7 }}>
            <Text style={{ color: '#4CAF72', fontSize: 12, marginRight: 8 }}>✓</Text>
            <Text style={{ fontSize: 12, color: plan.featured ? 'rgba(240,237,230,0.65)' : '#8A8FA0', fontWeight: '300', flex: 1 }}>
              {f}
            </Text>
          </View>
        ))}

        {/* CTA */}
        <View style={{ marginTop: 14 }}>
          <Button
            title={plan.featured ? 'GET STARTED' : 'Choose Plan'}
            variant={plan.featured ? 'primary' : 'outline'}
            onPress={() => onPress(plan)}
          />
        </View>
      </View>
    </Pressable>
  );
}

export default function MembershipScreen() {
  const router = useRouter();
  const [isAnnual, setIsAnnual] = useState(false);

  const handlePlanPress = useCallback((plan: PlanConfig) => {
    router.push({
      pathname: '/(tabs)/book',
      params: { plan: plan.id },
    } as never);
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 22,
          paddingTop: 16,
          paddingBottom: 18,
          backgroundColor: '#131720',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
        }}
      >
        <Text
          style={{
            fontFamily: 'BebasNeue_400Regular',
            fontSize: 28,
            letterSpacing: 1,
            color: '#F0EDE6',
            lineHeight: 28,
          }}
        >
          PLANS
        </Text>
        <Text
          style={{
            fontFamily: 'BebasNeue_400Regular',
            fontSize: 28,
            letterSpacing: 1,
            color: '#F0EDE6',
            lineHeight: 28,
            marginBottom: 6,
          }}
        >
          & PRICING
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '300', color: '#5A5F72', lineHeight: 20 }}>
          Join the Bakyard community and save on every session.
        </Text>
      </View>

      {/* Monthly / Annual toggle */}
      <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 4 }}>
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3 }}>
          <Pressable
            onPress={() => setIsAnnual(false)}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              borderRadius: 8,
              backgroundColor: !isAnnual ? '#1E2330' : 'transparent',
            }}
          >
            <Text
              style={{
                fontFamily: 'BarlowCondensed_700Bold',
                fontSize: 11,
                letterSpacing: 1.9,
                textTransform: 'uppercase',
                color: !isAnnual ? '#F0EDE6' : '#5A5F72',
              }}
            >
              Monthly
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setIsAnnual(true)}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: 'center',
              borderRadius: 8,
              backgroundColor: isAnnual ? '#1E2330' : 'transparent',
            }}
          >
            <Text
              style={{
                fontFamily: 'BarlowCondensed_700Bold',
                fontSize: 11,
                letterSpacing: 1.9,
                textTransform: 'uppercase',
                color: isAnnual ? '#F0EDE6' : '#5A5F72',
              }}
            >
              Annual
            </Text>
            <Text style={{ fontSize: 9, color: '#4CAF72', marginTop: 2 }}>Save 20%</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 80 }}
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
