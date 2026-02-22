import React, { useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/lib/utils/pricing';
import BottomSheet from '@/components/ui/BottomSheet';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';

export interface SplitParticipant {
  id: string;
  name: string;
  avatar_url?: string | null;
  is_current_user: boolean;
  paid: boolean;
}

interface SplitPaymentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  participants: SplitParticipant[];
  priceCents: number;
  discountCents: number;
  onPay: (method: 'apple_pay' | 'card' | 'venmo') => void;
}

type SplitMode = 'split' | 'solo';

export default function SplitPaymentSheet({
  isOpen,
  onClose,
  sessionId,
  participants,
  priceCents,
  discountCents,
  onPay,
}: SplitPaymentSheetProps) {
  const [mode, setMode] = useState<SplitMode>('split');

  const participantCount = participants.length;
  const perPersonCents =
    mode === 'split'
      ? Math.ceil((priceCents - discountCents) / participantCount)
      : priceCents - discountCents;

  const perPersonBeforeDiscount =
    mode === 'split'
      ? Math.ceil(priceCents / participantCount)
      : priceCents;

  const perPersonDiscount =
    mode === 'split'
      ? Math.ceil(discountCents / participantCount)
      : discountCents;

  const handlePay = useCallback(
    (method: 'apple_pay' | 'card' | 'venmo') => {
      onPay(method);
    },
    [onPay],
  );

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={['72%']}
      title="Pay for Room 2"
    >
      <View className="flex-1">
        {/* Split / Solo Toggle */}
        <View className="flex-row bg-stroke/50 rounded-full p-1 mb-5">
          <Pressable
            onPress={() => setMode('split')}
            className={[
              'flex-1 py-2.5 rounded-full items-center',
              mode === 'split' ? 'bg-primary' : 'bg-transparent',
            ].join(' ')}
          >
            <Text
              className={[
                'text-sm font-semibold',
                mode === 'split' ? 'text-white' : 'text-charcoal/60',
              ].join(' ')}
            >
              Split It
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('solo')}
            className={[
              'flex-1 py-2.5 rounded-full items-center',
              mode === 'solo' ? 'bg-white shadow-sm shadow-black/10' : 'bg-transparent',
            ].join(' ')}
          >
            <Text
              className={[
                'text-sm font-semibold',
                mode === 'solo' ? 'text-charcoal' : 'text-charcoal/60',
              ].join(' ')}
            >
              I Got It
            </Text>
          </Pressable>
        </View>

        {/* Price Breakdown */}
        <View className="mb-4">
          {mode === 'split' ? (
            <Text className="text-base text-charcoal/70">
              {participantCount} friends x {formatPrice(perPersonBeforeDiscount)}
            </Text>
          ) : (
            <Text className="text-base text-charcoal/70">
              Full amount: {formatPrice(priceCents)}
            </Text>
          )}

          {discountCents > 0 && (
            <Text className="text-sm text-primary mt-1">
              Member hookup: -{formatPrice(perPersonDiscount)}
            </Text>
          )}
        </View>

        {/* Total Highlight Box */}
        <View className="bg-bg rounded-xl px-4 py-3 mb-5 border border-stroke">
          <Text className="text-sm text-charcoal/60">
            {mode === 'split' ? "You're in for:" : 'Total:'}
          </Text>
          <Text className="text-2xl font-bold text-charcoal">
            {formatPrice(perPersonCents)}
          </Text>
        </View>

        {/* Participant Avatars */}
        {mode === 'split' && (
          <View className="flex-row justify-center gap-5 mb-6">
            {participants.map((participant) => (
              <View key={participant.id} className="items-center">
                <View className="relative">
                  <Avatar
                    uri={participant.avatar_url}
                    name={participant.name}
                    size="md"
                  />
                  {participant.paid && (
                    <View className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary items-center justify-center border-2 border-white">
                      <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text className="text-xs font-semibold text-charcoal mt-1.5">
                  {participant.is_current_user
                    ? 'YOU'
                    : participant.name.split(' ')[0].toUpperCase()}
                </Text>
                <Text className="text-[10px] text-charcoal/50">
                  {participant.paid ? 'Paid' : 'Pending'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Payment Method Buttons */}
        <View className="gap-3 mt-auto">
          <Button
            title="Pay"
            onPress={() => handlePay('apple_pay')}
            variant="primary"
            className="bg-black"
            icon={<Ionicons name="logo-apple" size={20} color="#FFFFFF" />}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button
                title="Card"
                onPress={() => handlePay('card')}
                variant="outline"
                icon={
                  <Ionicons name="card-outline" size={18} color="#D6B07A" />
                }
              />
            </View>
            <View className="flex-1">
              <Button
                title="Venmo"
                onPress={() => handlePay('venmo')}
                variant="outline"
                icon={
                  <Ionicons name="logo-venmo" size={18} color="#D6B07A" />
                }
              />
            </View>
          </View>
        </View>
      </View>
    </BottomSheet>
  );
}
