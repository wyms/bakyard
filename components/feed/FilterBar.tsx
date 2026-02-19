import React from 'react';
import { ScrollView, View } from 'react-native';
import Chip from '@/components/ui/Chip';
import { useFilterStore } from '@/lib/stores/filterStore';

interface FilterOption {
  key: string;
  label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { key: 'all', label: 'All' },
  { key: 'court_rental', label: 'Courts' },
  { key: 'open_play', label: 'Open Play' },
  { key: 'coaching', label: 'Training' },
  { key: 'clinic', label: 'Clinics' },
  { key: 'tournament', label: 'Events' },
];

export default function FilterBar() {
  const { activeFilters, toggleFilter, clearFilters } = useFilterStore();

  const handlePress = (filterKey: string) => {
    if (filterKey === 'all') {
      clearFilters();
      return;
    }
    toggleFilter(filterKey);
  };

  const isAllSelected = activeFilters.length === 0;

  return (
    <View className="mb-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
      >
        <Chip
          label="All"
          selected={isAllSelected}
          onPress={() => handlePress('all')}
        />
        {FILTER_OPTIONS.filter((f) => f.key !== 'all').map((filter) => (
          <Chip
            key={filter.key}
            label={filter.label}
            selected={activeFilters.includes(filter.key)}
            onPress={() => handlePress(filter.key)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
