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

const SKILL_LEVELS = [
  { key: 'beginner', label: 'Beginner' },
  { key: 'intermediate', label: 'Intermediate' },
  { key: 'advanced', label: 'Advanced' },
  { key: 'pro', label: 'Pro' },
] as const;

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [skillLevel, setSkillLevel] = useState('beginner');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      await signUp(email, password, fullName.trim(), {
        skill_level: skillLevel,
      });
      Alert.alert(
        'Account Created',
        'Please check your email to verify your account, then sign in.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      Alert.alert('Registration Failed', message);
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
              Join Bakyard
            </Text>
            <Text className="text-base text-charcoal/60 mt-2">
              Create your account to get started.
            </Text>
          </View>

          {/* Form */}
          <View className="space-y-4">
            <View>
              <Text className="text-sm font-medium text-charcoal mb-1.5">
                Full Name
              </Text>
              <TextInput
                className="w-full h-12 px-4 bg-white rounded-xl border border-charcoal/10 text-charcoal text-base"
                placeholder="Your full name"
                placeholderTextColor="#999"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                editable={!isLoading}
              />
            </View>

            <View className="mt-4">
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
            </View>

            <View className="mt-4">
              <Text className="text-sm font-medium text-charcoal mb-1.5">
                Password
              </Text>
              <TextInput
                className="w-full h-12 px-4 bg-white rounded-xl border border-charcoal/10 text-charcoal text-base"
                placeholder="Minimum 8 characters"
                placeholderTextColor="#999"
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
              <Text className="text-sm font-medium text-charcoal mb-2">
                Skill Level
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {SKILL_LEVELS.map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setSkillLevel(key)}
                    disabled={isLoading}
                    className={`px-4 py-2.5 rounded-full border ${
                      skillLevel === key
                        ? 'bg-teal border-teal'
                        : 'bg-white border-charcoal/10'
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        skillLevel === key ? 'text-white' : 'text-charcoal/70'
                      }`}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Create Account Button */}
            <TouchableOpacity
              className={`w-full h-14 rounded-2xl items-center justify-center mt-6 ${
                isLoading ? 'bg-sand/70' : 'bg-sand'
              }`}
              onPress={handleSignUp}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-base font-semibold">
                  Create Account
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Link */}
          <View className="items-center mt-8">
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-sm text-charcoal/70">
                  Already have an account?{' '}
                  <Text className="text-teal font-semibold">Sign in</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
