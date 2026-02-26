import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
          toValue: -20,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [bounceAnim]);

  return (
    <View style={{ alignItems: 'center', height: 180 }}>
      <Animated.View style={{ transform: [{ translateY: bounceAnim }] }}>
        <View
          style={{
            width: 130,
            height: 130,
            borderRadius: 65,
            backgroundColor: '#E8C97A',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            shadowColor: '#E8C97A',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
          }}
        >
          {/* Horizontal seam */}
          <View style={{ position: 'absolute', width: 130, height: 2, backgroundColor: '#0D0F14', opacity: 0.3 }} />
          {/* Vertical seam */}
          <View style={{ position: 'absolute', width: 2, height: 130, backgroundColor: '#0D0F14', opacity: 0.3 }} />
          {/* Diagonal seam 1 */}
          <View style={{ position: 'absolute', width: 130, height: 2, backgroundColor: '#0D0F14', opacity: 0.2, transform: [{ rotate: '45deg' }] }} />
          {/* Diagonal seam 2 */}
          <View style={{ position: 'absolute', width: 130, height: 2, backgroundColor: '#0D0F14', opacity: 0.2, transform: [{ rotate: '-45deg' }] }} />
        </View>
      </Animated.View>
      {/* Shadow */}
      <View
        style={{
          width: 60,
          height: 8,
          borderRadius: 30,
          backgroundColor: 'rgba(0,0,0,0.4)',
          marginTop: 10,
        }}
      />
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setCurrentSlide(idx);
    },
    []
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
      scrollRef.current?.scrollTo({
        x: (currentSlide + 1) * SCREEN_WIDTH,
        animated: true,
      });
      setCurrentSlide(currentSlide + 1);
    }
  }, [currentSlide]);

  const isLastSlide = currentSlide === SLIDES.length - 1;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
          <View
            key={i}
            style={{ width: SCREEN_WIDTH, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}
          >
            <VolleyballAnimation />
            <Text style={{ fontFamily: 'BarlowCondensed_700Bold', fontSize: 11, letterSpacing: 3.2, textTransform: 'uppercase', color: '#E8C97A', textAlign: 'center', marginTop: 32, marginBottom: 16 }}>
              {s.eyebrow}
            </Text>
            <Text style={{ fontFamily: 'BebasNeue_400Regular', fontSize: 52, letterSpacing: 1.5, color: '#F0EDE6', textAlign: 'center', lineHeight: 52, marginBottom: 18 }}>
              {s.headline}
            </Text>
            <Text style={{ fontSize: 15, color: '#8A8FA0', textAlign: 'center', lineHeight: 24, fontWeight: '300' }}>
              {s.body}
            </Text>
          </View>
        ))}
      </ScrollView>

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
      <View style={{ paddingHorizontal: 24, paddingBottom: 32, gap: 12 }}>
        {isLastSlide ? (
          <>
            <Pressable
              onPress={handleCreateAccount}
              style={({ pressed }) => ({
                backgroundColor: '#E8C97A',
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontFamily: 'BarlowCondensed_700Bold', fontSize: 15, letterSpacing: 2, textTransform: 'uppercase', color: '#0D0F14' }}>
                Create Your Account
              </Text>
            </Pressable>
            <Pressable
              onPress={handleAlreadyHaveAccount}
              style={({ pressed }) => ({
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 14, letterSpacing: 1.2, color: '#F0EDE6' }}>
                I Already Have an Account
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => ({
                backgroundColor: '#E8C97A',
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: 'center',
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontFamily: 'BarlowCondensed_700Bold', fontSize: 15, letterSpacing: 2, textTransform: 'uppercase', color: '#0D0F14' }}>
                Next
              </Text>
            </Pressable>
            <Pressable
              onPress={handleAlreadyHaveAccount}
              style={({ pressed }) => ({
                paddingVertical: 14,
                alignItems: 'center',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 13, letterSpacing: 0.8, color: '#8A8FA0', textAlign: 'center' }}>
                I Already Have an Account
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
