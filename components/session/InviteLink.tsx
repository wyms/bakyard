import React, { useCallback } from 'react';
import { View, Text, Share, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import Button from '@/components/ui/Button';

interface InviteLinkProps {
  sessionId: string;
  spotsRemaining: number;
}

export default function InviteLink({
  sessionId,
  spotsRemaining,
}: InviteLinkProps) {
  const handleInvite = useCallback(async () => {
    const deepLink = Linking.createURL(`session/${sessionId}`);

    const spotsText =
      spotsRemaining === 1
        ? '1 spot remaining'
        : `${spotsRemaining} spots remaining`;

    try {
      await Share.share({
        message: `Join my beach volleyball session on Bakyard! ${spotsText}. Open this link to join: ${deepLink}`,
        url: deepLink,
      });
    } catch (error: unknown) {
      // Share was cancelled or failed
      if (error instanceof Error && error.message !== 'User did not share') {
        Alert.alert('Error', 'Unable to share invite link. Please try again.');
      }
    }
  }, [sessionId, spotsRemaining]);

  const isFull = spotsRemaining <= 0;

  return (
    <View>
      <Button
        title={isFull ? 'Session Full' : 'Invite'}
        onPress={handleInvite}
        variant="outline"
        size="md"
        disabled={isFull}
        icon={
          <Ionicons
            name="share-outline"
            size={18}
            color={isFull ? '#9E9E9E' : '#D6B07A'}
          />
        }
      />
      {!isFull && spotsRemaining > 0 && (
        <Text className="text-[10px] text-charcoal/40 text-center mt-1">
          {spotsRemaining} {spotsRemaining === 1 ? 'spot' : 'spots'} left
        </Text>
      )}
    </View>
  );
}
