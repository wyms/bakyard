import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { formatPrice } from '@/lib/utils/pricing';

interface PriceSummaryProps {
  priceCents: number;
  discountCents?: number;
  membershipActive?: boolean;
  guests?: number;
  extras?: { name: string; priceCents: number; quantity: number }[];
}

interface LineItemProps {
  label: string;
  amount: string;
  isDiscount?: boolean;
  isBold?: boolean;
  delay?: number;
}

function LineItem({ label, amount, isDiscount, isBold, delay = 0 }: LineItemProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(250)}
      className="flex-row justify-between items-center py-1.5"
    >
      <Text
        className={[
          isBold ? 'text-base font-bold' : 'text-sm font-normal',
          isDiscount ? 'text-primary' : 'text-text',
        ].join(' ')}
      >
        {label}
      </Text>
      <Text
        className={[
          isBold ? 'text-base font-bold' : 'text-sm font-normal',
          isDiscount ? 'text-primary' : 'text-text',
        ].join(' ')}
      >
        {amount}
      </Text>
    </Animated.View>
  );
}

export default function PriceSummary({
  priceCents,
  discountCents = 0,
  membershipActive = false,
  guests = 0,
  extras = [],
}: PriceSummaryProps) {
  const totalPeople = 1 + guests;
  const baseTotalCents = priceCents * totalPeople;
  const extrasTotal = extras.reduce(
    (sum, e) => sum + e.priceCents * e.quantity,
    0
  );
  const subtotalCents = baseTotalCents + extrasTotal;
  const totalDiscountCents = membershipActive ? discountCents * totalPeople : 0;
  const finalCents = subtotalCents - totalDiscountCents;

  let itemIndex = 0;

  return (
    <View className="bg-surface rounded-2xl p-4">
      <Text className="text-base font-semibold text-text mb-2">
        Price Summary
      </Text>

      <View className="border-t border-stroke pt-2">
        {/* Base price */}
        <LineItem
          label={totalPeople > 1 ? `${totalPeople} x ${formatPrice(priceCents)}` : 'Session'}
          amount={formatPrice(baseTotalCents)}
          delay={(itemIndex++) * 60}
        />

        {/* Extras */}
        {extras.map((extra) => (
          <LineItem
            key={extra.name}
            label={`${extra.quantity} x ${extra.name}`}
            amount={formatPrice(extra.priceCents * extra.quantity)}
            delay={(itemIndex++) * 60}
          />
        ))}

        {/* Member discount */}
        {membershipActive && totalDiscountCents > 0 && (
          <LineItem
            label="Member hookup"
            amount={`-${formatPrice(totalDiscountCents)}`}
            isDiscount
            delay={(itemIndex++) * 60}
          />
        )}

        {/* Divider */}
        <View className="border-t border-stroke mt-2 pt-2">
          <LineItem
            label="Total"
            amount={formatPrice(finalCents)}
            isBold
            delay={(itemIndex++) * 60}
          />
        </View>
      </View>
    </View>
  );
}
