import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/hooks/useAuth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleResetPassword = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-offwhite">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-8"
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="items-center mb-10">
            <Text className="text-sm font-medium text-muted tracking-widest uppercase">Bakyard</Text>
            <Text className="text-h1 text-text">Reset Password</Text>
            <Text className="text-base text-muted mt-2 text-center px-4">
              Enter your email and we'll send you a link to reset your password.
            </Text>
          </View>

          {/* Error message */}
          {error ? (
            <View className="bg-coral/10 border border-coral/30 rounded-input px-4 py-3 mb-4">
              <Text className="text-sm text-coral text-center">{error}</Text>
            </View>
          ) : null}

          {sent ? (
            <View className="items-center py-4">
              <Text className="text-base text-text font-medium mb-2">
                Check your email
              </Text>
              <Text className="text-sm text-muted text-center mb-6">
                If an account exists with that email, we sent a password reset link.
              </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text className="text-sm text-primary font-semibold">
                    Back to login
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : (
            <>
              {/* Form */}
              <View>
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

                {/* Send Reset Link Button */}
                <Button
                  title="Send Reset Link"
                  onPress={handleResetPassword}
                  loading={isLoading}
                  disabled={isLoading}
                  size="lg"
                  className="w-full mt-6"
                />
              </View>

              {/* Link */}
              <View className="items-center mt-8">
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity>
                    <Text className="text-sm text-primary font-medium">
                      Back to login
                    </Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
