import React from 'react';
import { Pressable, Text, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ProductType } from '@/lib/types/database';

interface CategoryConfig {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  productTypes: ProductType[];
}

const CATEGORIES: CategoryConfig[] = [
  {
    label: 'Grab Court',
    icon: 'tennisball-outline',
    iconColor: '#D4A574',
    productTypes: ['court_rental'],
  },
  {
    label: 'Jump In',
    icon: 'walk-outline',
    iconColor: '#1A5E63',
    productTypes: ['open_play'],
  },
  {
    label: 'Train',
    icon: 'fitness-outline',
    iconColor: '#FF6B6B',
    productTypes: ['coaching', 'clinic'],
  },
  {
    label: 'Open Play',
    icon: 'flame-outline',
    iconColor: '#FF9800',
    productTypes: ['open_play'],
  },
];

interface CategoryButtonProps {
  category: CategoryConfig;
  onPress?: () => void;
}

function CategoryButton({ category, onPress }: CategoryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-white rounded-2xl px-5 py-4 mb-2.5 shadow-sm shadow-black/8"
      style={({ pressed }: { pressed: boolean }): ViewStyle => ({
        transform: [{ scale: pressed ? 0.97 : 1 }],
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <Ionicons
        name={category.icon}
        size={22}
        color={category.iconColor}
        style={{ marginRight: 14 }}
      />
      <Text className="text-base font-semibold text-charcoal">
        {category.label}
      </Text>
    </Pressable>
  );
}

interface CategoryButtonListProps {
  onCategoryPress?: (productTypes: ProductType[], label: string) => void;
}

export default function CategoryButtonList({ onCategoryPress }: CategoryButtonListProps) {
  const router = useRouter();

  const handlePress = (category: CategoryConfig) => {
    if (onCategoryPress) {
      onCategoryPress(category.productTypes, category.label);
      return;
    }
    // Default: navigate to sessions tab with filter applied via query params
    router.push({
      pathname: '/(tabs)/sessions',
      params: { filter: category.productTypes.join(',') },
    });
  };

  return (
    <>
      {CATEGORIES.map((category) => (
        <CategoryButton
          key={category.label}
          category={category}
          onPress={() => handlePress(category)}
        />
      ))}
    </>
  );
}

export { CATEGORIES, type CategoryConfig };
