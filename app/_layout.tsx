import { useEffect } from 'react';
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

function useProtectedRoute() {
  const { session, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isLoading, segments]);
}

export default function RootLayout() {
  const { setSession, setLoading } = useAuthStore();

  const [fontsLoaded, fontError] = useFonts({
    BebasNeue_400Regular,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    Barlow_300Light,
    Barlow_400Regular,
  });

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

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

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <RootLayoutNav />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  useProtectedRoute();

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
