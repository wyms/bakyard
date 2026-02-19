import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BenefitsListProps {
  benefits: string[];
}

export default function BenefitsList({ benefits }: BenefitsListProps) {
  return (
    <View className="gap-2.5">
      {benefits.map((benefit, index) => (
        <View key={index} className="flex-row items-start gap-2.5">
          <View className="w-5 h-5 rounded-full bg-[#4CAF50]/15 items-center justify-center mt-0.5">
            <Ionicons name="checkmark" size={12} color="#4CAF50" />
          </View>
          <Text className="flex-1 text-sm text-charcoal/80 leading-5">
            {benefit}
          </Text>
        </View>
      ))}
    </View>
  );
}
