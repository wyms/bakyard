import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';

import { getProductById, getSessionsForProduct } from '@/lib/api/feed';
import { getMyMembership } from '@/lib/api/memberships';
import { createCheckout, type CheckoutResponse } from '@/lib/api/payments';
import { useCreateBooking } from '@/lib/hooks/useBooking';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { formatPrice, calculateDiscount } from '@/lib/utils/pricing';
import type { Session } from '@/lib/types/database';

import Button from '@/components/ui/Button';
import Skeleton from '@/components/ui/Skeleton';
import PriceSummary from '@/components/booking/PriceSummary';
import { useAuthStore } from '@/lib/stores/authStore';

type PaymentMethod = 'card' | 'apple_pay' | 'simulate';
type PaymentState = 'idle' | 'processing' | 'success' | 'error';

export default function PaymentScreen() {
  const { productId, sessionId } = useLocalSearchParams<{
    productId: string;
    sessionId: string;
  }>();
  const router = useRouter();
  const { guests, extras, reset: resetBookingStore } = useBookingStore();
  const { user: authUser } = useAuthStore();
  const createBookingMutation = useCreateBooking();

  const [paymentState, setPaymentState] = useState<PaymentState>('idle');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('card');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => getProductById(productId),
    enabled: !!productId,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', productId],
    queryFn: () => getSessionsForProduct(productId),
    enabled: !!productId,
  });

  const { data: membership } = useQuery({
    queryKey: ['membership'],
    queryFn: getMyMembership,
  });

  const session = useMemo(() => {
    if (!sessions || !sessionId) return null;
    return sessions.find((s) => s.id === sessionId) ?? null;
  }, [sessions, sessionId]);

  const hasMembership = !!membership && membership.status === 'active';
  const discountPercent = membership?.discount_percent ?? 0;

  const discountCentsPerPerson = useMemo(() => {
    if (!session || !hasMembership) return 0;
    const fullPrice = session.price_cents;
    const discountedPrice = calculateDiscount(fullPrice, discountPercent);
    return fullPrice - discountedPrice;
  }, [session, hasMembership, discountPercent]);

  const PROCESSING_FEE_CENTS = 150; // $1.50 flat processing fee

  const totalCents = useMemo(() => {
    if (!session) return 0;
    const totalPeople = 1 + guests;
    const baseTotalCents = session.price_cents * totalPeople;
    const extrasTotal = extras.reduce(
      (sum, e) => sum + e.price_cents * e.quantity,
      0
    );
    const totalDiscountCents = hasMembership
      ? discountCentsPerPerson * totalPeople
      : 0;
    return baseTotalCents + extrasTotal - totalDiscountCents + PROCESSING_FEE_CENTS;
  }, [session, guests, extras, hasMembership, discountCentsPerPerson]);

  const handlePayWithStripe = useCallback(async () => {
    if (!session) return;
    setPaymentState('processing');
    setErrorMessage(null);

    try {
      // Create checkout / payment intent on the server
      const checkout: CheckoutResponse = await createCheckout(
        session.id,
        membership?.id ?? undefined
      );

      // In a production app, we would present the Stripe PaymentSheet here:
      // const { error } = await presentPaymentSheet();
      // For now, we proceed with booking creation directly.

      // Attempt to initialize Stripe PaymentSheet
      let stripeAvailable = false;
      try {
        const StripeModule = require('@stripe/stripe-react-native');
        const { initPaymentSheet, presentPaymentSheet } = StripeModule;

        await initPaymentSheet({
          paymentIntentClientSecret: checkout.client_secret,
          merchantDisplayName: 'Bakyard',
          style: 'automatic',
        });

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code === 'Canceled') {
            setPaymentState('idle');
            return;
          }
          throw new Error(presentError.message);
        }
        stripeAvailable = true;
      } catch (stripeError: unknown) {
        // If Stripe is not available (dev environment), fall through
        const errorMsg = stripeError instanceof Error ? stripeError.message : String(stripeError);
        if (
          errorMsg.includes('Cannot find module') ||
          errorMsg.includes('is not a function') ||
          errorMsg.includes('undefined')
        ) {
          // Stripe SDK not available, will use simulate flow
          stripeAvailable = false;
        } else {
          throw stripeError;
        }
      }

      if (!stripeAvailable) {
        // In development, simulate the payment
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Create the booking
      await createBookingMutation.mutateAsync({
        sessionId: session.id,
        guests,
      });

      setPaymentState('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment failed';
      setErrorMessage(msg);
      setPaymentState('error');
    }
  }, [session, membership, guests, createBookingMutation]);

  const handleSimulatePayment = useCallback(async () => {
    if (!session) return;
    setPaymentState('processing');
    setErrorMessage(null);

    try {
      // Simulate a brief processing delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create the booking
      await createBookingMutation.mutateAsync({
        sessionId: session.id,
        guests,
      });

      setPaymentState('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Booking failed';
      setErrorMessage(msg);
      setPaymentState('error');
    }
  }, [session, guests, createBookingMutation]);

  const handlePayment = useCallback(() => {
    switch (selectedMethod) {
      case 'apple_pay':
      case 'card':
        handlePayWithStripe();
        break;
      case 'simulate':
        handleSimulatePayment();
        break;
    }
  }, [selectedMethod, handlePayWithStripe, handleSimulatePayment]);

  const handleGoToSession = useCallback(() => {
    resetBookingStore();
    if (session) {
      router.replace({
        pathname: '/session/[id]',
        params: { id: session.id },
      });
    } else {
      router.replace('/(tabs)/sessions');
    }
  }, [session, router, resetBookingStore]);

  const handleRetry = useCallback(() => {
    setPaymentState('idle');
    setErrorMessage(null);
  }, []);

  const isLoading = productLoading || sessionsLoading;

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
        <ScrollView className="flex-1 px-5 pt-4">
          <Skeleton width="70%" height={28} className="mb-3" />
          <Skeleton width="100%" height={120} className="mb-4" />
          <Skeleton width="100%" height={80} className="mb-4" />
          <Skeleton width="100%" height={60} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Session not found
  if (!session || !product) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={48} color="#D95F2B" />
          <Text className="text-lg font-semibold text-text mt-4 text-center">
            Session not found
          </Text>
          <Button
            title="Go Back"
            variant="outline"
            size="sm"
            onPress={() => router.back()}
            className="mt-6"
          />
        </View>
      </SafeAreaView>
    );
  }

  // Success state
  if (paymentState === 'success') {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <Animated.View entering={ZoomIn.duration(500)}>
            <View className="w-24 h-24 rounded-full bg-success/10 items-center justify-center mb-6">
              <Ionicons name="checkmark-circle" size={64} color="#4CAF72" />
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(300).duration(400)}>
            <Text className="text-xs font-semibold text-mid text-center uppercase tracking-wider mb-2">
              You're In · Spot Secured
            </Text>
            <Text className="font-display text-4xl text-offwhite text-center">
              SEE YOU ON THE{' '}
              <Text className="text-sand">SAND.</Text>
            </Text>
            <Text className="text-base text-mid text-center mt-2">
              Your booking has been confirmed.
            </Text>
            <Text className="text-xs text-mid/60 text-center mt-1">
              A confirmation has been sent to your email.
            </Text>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(500).duration(400)}
            className="bg-surface rounded-2xl p-5 mt-8 w-full border border-stroke"
          >
            <Text className="font-display text-xl text-offwhite mb-3">
              {product.title.toUpperCase()}
            </Text>
            <View className="flex-row items-center mb-2">
              <Ionicons name="calendar-outline" size={16} color="#E8C97A" />
              <Text className="text-sm text-mid ml-2">
                {format(parseISO(session.starts_at), 'EEE, MMM d')}
              </Text>
            </View>
            <View className="flex-row items-center mb-2">
              <Ionicons name="time-outline" size={16} color="#E8C97A" />
              <Text className="text-sm text-mid ml-2">
                {format(parseISO(session.starts_at), 'h:mm a')} –{' '}
                {format(parseISO(session.ends_at), 'h:mm a')}
              </Text>
            </View>
            {session.court && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="location-outline" size={16} color="#E8C97A" />
                <Text className="text-sm text-mid ml-2">{session.court.name}</Text>
              </View>
            )}
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={16} color="#4CAF72" />
              <Text className="text-sm font-bold text-sand ml-2">
                {formatPrice(totalCents)} paid
              </Text>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(700).duration(400)}
            className="w-full mt-6 gap-3"
          >
            <Button
              title="Back to Home"
              variant="primary"
              size="lg"
              onPress={() => {
                resetBookingStore();
                router.replace('/(tabs)');
              }}
              className="w-full"
            />
            <Button
              title="Book Another Session"
              variant="ghost"
              size="lg"
              onPress={handleGoToSession}
              className="w-full"
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  const startDate = parseISO(session.starts_at);
  const endDate = parseISO(session.ends_at);

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Order summary header */}
        <Animated.View
          entering={FadeInDown.delay(50).duration(300)}
          className="px-5 pt-4"
        >
          <Text className="text-xl font-bold text-text">
            Pay for {product.title}
          </Text>
          <Text className="text-sm text-text/50 mt-1">
            {format(startDate, 'EEE, MMM d')} · {format(startDate, 'h:mm')}–
            {format(endDate, 'h:mm a')}
            {session.court ? ` · ${session.court.name}` : ''}
          </Text>
        </Animated.View>

        {/* Attendee details */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(300)}
          className="mx-5 mt-4 bg-surface rounded-2xl p-4 border border-stroke"
        >
          <Text className="text-xs text-mid uppercase tracking-wide mb-3">Attendee</Text>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Ionicons name="person-outline" size={16} color="#8A8FA0" />
              <Text className="text-sm text-offwhite ml-2">
                {authUser?.user_metadata?.full_name ?? authUser?.email ?? 'You'}
              </Text>
            </View>
            {hasMembership && (
              <View className="flex-row items-center bg-success/10 rounded-full px-2 py-0.5">
                <Ionicons name="checkmark-circle" size={12} color="#4CAF72" />
                <Text className="text-xs text-success ml-1">Member</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Price summary */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(300)}
          className="mx-5 mt-5"
        >
          <PriceSummary
            priceCents={session.price_cents}
            discountCents={discountCentsPerPerson}
            membershipActive={hasMembership}
            guests={guests}
            extras={extras.map((e) => ({
              name: e.name,
              priceCents: e.price_cents,
              quantity: e.quantity,
            }))}
          />
        </Animated.View>

        {/* Total highlight */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(300)}
          className="mx-5 mt-4"
        >
          <View className="bg-primary/10 rounded-2xl p-4 flex-row items-center justify-between">
            <Text className="text-base font-semibold text-primary">
              You're in for:
            </Text>
            <Text className="text-2xl font-bold text-primary">
              {formatPrice(totalCents)}
            </Text>
          </View>
        </Animated.View>

        {/* Payment method selection */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(300)}
          className="px-5 mt-6"
        >
          <Text className="text-base font-semibold text-text mb-3">
            Payment Method
          </Text>

          {/* Apple Pay */}
          <Pressable
            onPress={() => setSelectedMethod('apple_pay')}
            className={[
              'flex-row items-center rounded-2xl p-4 mb-2 border',
              selectedMethod === 'apple_pay'
                ? 'border-primary bg-primary/5'
                : 'border-stroke bg-surface',
            ].join(' ')}
            style={({ pressed }: { pressed: boolean }): ViewStyle => ({
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View className="w-10 h-10 rounded-xl bg-black items-center justify-center">
              <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
            </View>
            <Text className="text-base font-medium text-text ml-3 flex-1">
              Apple Pay
            </Text>
            <View
              className={[
                'w-6 h-6 rounded-full border-2 items-center justify-center',
                selectedMethod === 'apple_pay'
                  ? 'border-primary'
                  : 'border-stroke',
              ].join(' ')}
            >
              {selectedMethod === 'apple_pay' && (
                <View className="w-3.5 h-3.5 rounded-full bg-primary" />
              )}
            </View>
          </Pressable>

          {/* Saved Card */}
          <Pressable
            onPress={() => setSelectedMethod('card')}
            className={[
              'flex-row items-center rounded-2xl p-4 mb-2 border',
              selectedMethod === 'card'
                ? 'border-primary bg-primary/5'
                : 'border-stroke bg-surface',
            ].join(' ')}
            style={({ pressed }: { pressed: boolean }): ViewStyle => ({
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View className="w-10 h-10 rounded-xl bg-accent/10 items-center justify-center">
              <Ionicons name="card-outline" size={22} color="#D6B07A" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-medium text-text">
                •••• •••• •••• 4242
              </Text>
              <Text className="text-xs text-mid mt-0.5">Exp: 12/26</Text>
            </View>
            <View
              className={[
                'w-6 h-6 rounded-full border-2 items-center justify-center',
                selectedMethod === 'card'
                  ? 'border-primary'
                  : 'border-stroke',
              ].join(' ')}
            >
              {selectedMethod === 'card' && (
                <View className="w-3.5 h-3.5 rounded-full bg-primary" />
              )}
            </View>
          </Pressable>

          {/* Add New Card */}
          <Pressable
            className="flex-row items-center rounded-2xl p-4 mb-2 border border-dashed border-stroke bg-surface"
            style={({ pressed }: { pressed: boolean }): ViewStyle => ({
              opacity: pressed ? 0.7 : 1,
            })}
            onPress={() => {}}
          >
            <View className="w-10 h-10 rounded-xl bg-stroke items-center justify-center">
              <Ionicons name="add" size={22} color="#8A8FA0" />
            </View>
            <Text className="text-sm text-mid ml-3">+ Add New Card</Text>
          </Pressable>

          {/* Simulate Payment (dev mode) */}
          <Pressable
            onPress={() => setSelectedMethod('simulate')}
            className={[
              'flex-row items-center rounded-2xl p-4 border',
              selectedMethod === 'simulate'
                ? 'border-primary bg-primary/5'
                : 'border-dashed border-stroke bg-surface',
            ].join(' ')}
            style={({ pressed }: { pressed: boolean }): ViewStyle => ({
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
              <Ionicons name="bug-outline" size={22} color="#E8C97A" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-medium text-text">
                Simulate Payment
              </Text>
              <Text className="text-xs text-text/40 mt-0.5">
                For development testing only
              </Text>
            </View>
            <View
              className={[
                'w-6 h-6 rounded-full border-2 items-center justify-center',
                selectedMethod === 'simulate'
                  ? 'border-primary'
                  : 'border-stroke',
              ].join(' ')}
            >
              {selectedMethod === 'simulate' && (
                <View className="w-3.5 h-3.5 rounded-full bg-primary" />
              )}
            </View>
          </Pressable>
        </Animated.View>

        {/* Error message */}
        {paymentState === 'error' && errorMessage && (
          <Animated.View
            entering={FadeIn.duration(300)}
            className="mx-5 mt-4"
          >
            <View className="bg-[#D95F2B]/10 rounded-2xl p-4 flex-row items-center">
              <Ionicons name="warning-outline" size={20} color="#D95F2B" />
              <Text className="text-sm text-[#D95F2B] ml-2 flex-1">
                {errorMessage}
              </Text>
              <Pressable
                onPress={handleRetry}
                style={({ pressed }: { pressed: boolean }): ViewStyle => ({
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text className="text-sm font-semibold text-primary">
                  Retry
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(400)}
        className="absolute bottom-0 left-0 right-0 bg-surface border-t border-stroke px-5 py-4"
        style={{ paddingBottom: 34 }}
      >
        {paymentState === 'processing' ? (
          <View className="flex-row items-center justify-center py-4">
            <ActivityIndicator size="small" color="#E8C97A" />
            <Text className="text-base font-semibold text-primary ml-3">
              Processing payment...
            </Text>
          </View>
        ) : (
          <>
            <Button
              title={`Pay Now · ${formatPrice(totalCents)}`}
              variant="primary"
              size="lg"
              onPress={handlePayment}
              loading={false}
              icon={
                selectedMethod === 'apple_pay' ? (
                  <Ionicons name="logo-apple" size={20} color="#0D0F14" />
                ) : selectedMethod === 'simulate' ? (
                  <Ionicons name="bug-outline" size={20} color="#0D0F14" />
                ) : (
                  <Ionicons name="card-outline" size={20} color="#0D0F14" />
                )
              }
              className="w-full"
            />
            <View className="flex-row items-center justify-center mt-2">
              <Ionicons name="lock-closed-outline" size={11} color="#8A8FA0" />
              <Text className="text-xs text-mid ml-1">
                Secured · Free cancellation up to 24 hrs.
              </Text>
            </View>
          </>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}
