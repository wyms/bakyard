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
import Chip from '@/components/ui/Chip';

const SKILL_LEVELS = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'pro', label: 'Pro' },
] as const;

export default function RegisterScreen() {
  const { signUp, signInWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [skillLevel, setSkillLevel] = useState('beginner');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignUp = async () => {
    setError('');

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(email, password, fullName.trim(), {
        skill_level: skillLevel,
      });
      // With email confirmation disabled, signUp auto-signs in.
      // useProtectedRoute in _layout.tsx will redirect to (tabs).
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
            <Text className="text-h1 text-text">Create your account</Text>
          </View>

          {/* Error message */}
          {error ? (
            <View className="bg-coral/10 border border-coral/30 rounded-input px-4 py-3 mb-4">
              <Text className="text-sm text-coral text-center">{error}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View className="space-y-4">
            <Input
              label="Full Name"
              placeholder="Your full name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              editable={!isLoading}
            />

            <View className="mt-4">
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
            </View>

            <View className="mt-4">
              <Input
                label="Password"
                placeholder="Minimum 8 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
                editable={!isLoading}
              />
            </View>

            {/* Skill Level Picker */}
            <View className="mt-4">
              <Text className="text-sm font-medium text-text mb-2">
                Skill Level
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {SKILL_LEVELS.map(({ key, label }) => (
                  <Chip
                    key={key}
                    label={label}
                    selected={skillLevel === key}
                    onPress={() => setSkillLevel(key)}
                  />
                ))}
              </View>
            </View>

            {/* Create Account Button */}
            <Button
              title="Create Account"
              onPress={handleSignUp}
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

          {/* Link */}
          <View className="items-center mt-8">
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-sm text-muted">
                  Already have an account?{' '}
                  <Text className="text-primary font-semibold">Sign in</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
