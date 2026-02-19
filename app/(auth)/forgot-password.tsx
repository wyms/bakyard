import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/hooks/useAuth';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(email);
      Alert.alert(
        'Check Your Email',
        'If an account exists with that email, we sent a password reset link.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      Alert.alert('Error', message);
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
            <Text className="text-4xl font-bold text-sand tracking-tight">
              Reset Password
            </Text>
            <Text className="text-base text-charcoal/60 mt-2 text-center px-4">
              Enter your email and we'll send you a link to reset your password.
            </Text>
          </View>

          {/* Form */}
          <View>
            <Text className="text-sm font-medium text-charcoal mb-1.5">
              Email
            </Text>
            <TextInput
              className="w-full h-12 px-4 bg-white rounded-xl border border-charcoal/10 text-charcoal text-base"
              placeholder="you@example.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!isLoading}
            />

            {/* Send Reset Link Button */}
            <TouchableOpacity
              className={`w-full h-14 rounded-2xl items-center justify-center mt-6 ${
                isLoading ? 'bg-sand/70' : 'bg-sand'
              }`}
              onPress={handleResetPassword}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-base font-semibold">
                  Send Reset Link
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Link */}
          <View className="items-center mt-8">
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-sm text-teal font-medium">
                  Back to login
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
