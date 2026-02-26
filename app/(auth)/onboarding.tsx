import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const SLIDES = [
  {
    eyebrow: 'Built on Deep Sand · Plano, TX',
    headline: 'BOOK IN SECONDS.\nPLAY TODAY.',
    body: 'Bakyard brings beach volleyball to Plano. Find open play sessions, clinics, and private court time—all in one place.',
  },
  {
    eyebrow: 'Open Play · Every Day',
    headline: 'JUMP IN\nANY TIME.',
    body: "No membership needed. Browse today's sessions, see who's playing, and grab your spot in seconds.",
  },
  {
    eyebrow: 'Level Up',
    headline: 'TRAIN WITH\nTHE BEST.',
    body: 'Book clinics with certified coaches, track your progress, and build your beach game faster.',
  },
  {
    eyebrow: 'Your Community',
    headline: 'PLAY MORE.\nPAY LESS.',
    body: 'Members unlock unlimited open play, priority booking, and exclusive perks. Join the Bakyard family.',
  },
];

function VolleyballAnimation() {
  const bounceAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -18,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 550,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [bounceAnim]);

  return (
    <View style={{ alignItems: 'center', height: 150 }}>
      <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
        <View
          style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: '#E8C97A',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Horizontal seam */}
          <View
            style={{
              position: 'absolute',
              width: 100,
              height: 2,
              backgroundColor: '#0D0F14',
              opacity: 0.35,
            }}
          />
          {/* Vertical seam */}
          <View
            style={{
              position: 'absolute',
              width: 2,
              height: 100,
              backgroundColor: '#0D0F14',
              opacity: 0.35,
            }}
          />
          {/* Diagonal seam 1 */}
          <View
            style={{
              position: 'absolute',
              width: 100,
              height: 2,
              backgroundColor: '#0D0F14',
              opacity: 0.25,
              transform: [{ rotate: '45deg' }],
            }}
          />
          {/* Diagonal seam 2 */}
          <View
            style={{
              position: 'absolute',
              width: 100,
              height: 2,
              backgroundColor: '#0D0F14',
              opacity: 0.25,
              transform: [{ rotate: '-45deg' }],
            }}
          />
        </View>
      </Animated.View>
      {/* Shadow */}
      <View
        style={{
          width: 56,
          height: 8,
          borderRadius: 28,
          backgroundColor: 'rgba(0,0,0,0.35)',
          marginTop: 8,
        }}
      />
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const goToSlide = useCallback(
    (idx: number) => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setCurrentSlide(idx);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    },
    [fadeAnim]
  );

  const markComplete = useCallback(async () => {
    try {
      await SecureStore.setItemAsync('onboarding_complete', 'true');
    } catch {
      // Non-critical
    }
  }, []);

  const handleCreateAccount = useCallback(async () => {
    await markComplete();
    router.replace('/(auth)/register');
  }, [markComplete, router]);

  const handleAlreadyHaveAccount = useCallback(async () => {
    await markComplete();
    router.replace('/(auth)/login');
  }, [markComplete, router]);

  const handleNext = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      goToSlide(currentSlide + 1);
    }
  }, [currentSlide, goToSlide]);

  const isLastSlide = currentSlide === SLIDES.length - 1;
  const slide = SLIDES[currentSlide];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      {/* Slide content */}
      <Animated.View
        className="flex-1 items-center justify-center px-8"
        style={{ opacity: fadeAnim }}
      >
        <VolleyballAnimation />
        <Text className="text-xs font-semibold text-mid text-center uppercase tracking-widest mt-8 mb-5">
          {slide.eyebrow}
        </Text>
        <Text className="font-display text-5xl text-offwhite text-center leading-none mb-5">
          {slide.headline}
        </Text>
        <Text className="text-base text-mid text-center leading-6">
          {slide.body}
        </Text>
      </Animated.View>

      {/* Progress dots */}
      <View className="flex-row items-center justify-center py-5" style={{ gap: 6 }}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === currentSlide ? 20 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === currentSlide ? '#E8C97A' : '#8A8FA0',
            }}
          />
        ))}
      </View>

      {/* CTAs */}
      <View className="px-6 pb-8" style={{ gap: 12 }}>
        {isLastSlide ? (
          <>
            <Pressable
              onPress={handleCreateAccount}
              className="bg-sand rounded-2xl py-4 items-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Text className="text-base font-bold text-[#0D0F14]">
                Create Your Account
              </Text>
            </Pressable>
            <Pressable
              onPress={handleAlreadyHaveAccount}
              className="rounded-2xl py-4 items-center border border-stroke"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-base font-semibold text-offwhite">
                I Already Have an Account
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={handleNext}
              className="bg-sand rounded-2xl py-4 items-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Text className="text-base font-bold text-[#0D0F14]">Next</Text>
            </Pressable>
            <Pressable
              onPress={handleAlreadyHaveAccount}
              className="rounded-2xl py-4 items-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-sm text-mid text-center">
                I Already Have an Account
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
