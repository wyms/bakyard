import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  useFonts,
  BebasNeue_400Regular,
} from '@expo-google-fonts/bebas-neue';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import {
  Barlow_300Light,
  Barlow_400Regular,
} from '@expo-google-fonts/barlow';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/stores/authStore';

import './global.css';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

function useProtectedRoute(onboardingComplete: boolean | null) {
  const { session, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || onboardingComplete === null) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onOnboarding = segments[1] === 'onboarding';

    if (!session) {
      if (!inAuthGroup) {
        // Not in auth group — send to onboarding or login
        if (!onboardingComplete) {
          router.replace('/(auth)/onboarding');
        } else {
          router.replace('/(auth)/login');
        }
      } else if (!onboardingComplete && !onOnboarding) {
        // In auth group but onboarding not done and not already on onboarding
        router.replace('/(auth)/onboarding');
      }
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments, onboardingComplete]);
}

export default function RootLayout() {
  const { setSession, setLoading } = useAuthStore();
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    BebasNeue_400Regular,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    Barlow_300Light,
    Barlow_400Regular,
  });

  useEffect(() => {
    if (fontError) console.warn('Font loading failed, using system fonts:', fontError);
  }, [fontError]);

  useEffect(() => {
    // Load onboarding flag
    SecureStore.getItemAsync('onboarding_complete')
      .then((val) => setOnboardingComplete(val === 'true'))
      .catch(() => setOnboardingComplete(false));
  }, []);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession, setLoading]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded && !fontError && Platform.OS !== 'web') {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootLayoutNav onboardingComplete={onboardingComplete} />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function RootLayoutNav({ onboardingComplete }: { onboardingComplete: boolean | null }) {
  useProtectedRoute(onboardingComplete);

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="notifications"
        options={{ title: 'Notifications', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="product/[id]"
        options={{ title: '', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="session/[id]"
        options={{ title: 'Session', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="booking/select-time"
        options={{ title: 'Select Time', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="booking/confirm"
        options={{ title: 'Confirm', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="booking/extras"
        options={{ title: 'Add Extras', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="booking/payment"
        options={{ title: 'Payment', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="coach/[id]"
        options={{ title: 'Coach', headerBackTitle: 'Back' }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
