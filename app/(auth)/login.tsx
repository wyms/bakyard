import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/hooks/useAuth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function LoginScreen() {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      await signIn(email, password);
      // useProtectedRoute in _layout.tsx will redirect to (tabs)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Title */}
          <View className="items-center mb-12">
            <Text className="font-display text-6xl text-offwhite tracking-widest">BAKYARD</Text>
            <Text className="text-sm text-mid mt-2">Welcome back</Text>
          </View>

          {/* Error message */}
          {error ? (
            <View className="bg-ember/10 border border-ember/30 rounded-input px-4 py-3 mb-4">
              <Text className="text-sm text-ember text-center">{error}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View className="space-y-4">
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!isLoading}
            />

            <View className="mt-4">
              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                editable={!isLoading}
              />
            </View>

            {/* Sign In Button */}
            <Button
              title="Sign In"
              onPress={handleSignIn}
              loading={isLoading}
              disabled={isLoading}
              size="lg"
              className="w-full mt-6"
            />
          </View>

          {/* Divider */}
          <View className="flex-row items-center my-6">
            <View className="flex-1 h-px bg-muted/30" />
            <Text className="mx-4 text-sm text-muted">or</Text>
            <View className="flex-1 h-px bg-muted/30" />
          </View>

          {/* Google Sign In */}
          <Button
            title="Continue with Google"
            onPress={signInWithGoogle}
            variant="outline"
            size="lg"
            disabled={isLoading}
            icon={<Ionicons name="logo-google" size={20} color="#FF6B6B" />}
            className="w-full"
          />

          {/* Links */}
          <View className="items-center mt-8 space-y-3">
            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity>
                <Text className="text-sm text-muted">
                  Forgot password?
                </Text>
              </TouchableOpacity>
            </Link>

            <Link href="/(auth)/register" asChild>
              <TouchableOpacity className="mt-3">
                <Text className="text-sm text-muted">
                  Don't have an account?{' '}
                  <Text className="text-primary font-semibold">Register</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
