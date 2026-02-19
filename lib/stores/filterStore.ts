import { create } from 'zustand';

interface FilterState {
  activeFilters: string[];
  searchQuery: string;
  toggleFilter: (filter: string) => void;
  setSearch: (query: string) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  activeFilters: [],
  searchQuery: '',
  toggleFilter: (filter) =>
    set((state) => {
      const isActive = state.activeFilters.includes(filter);
      return {
        activeFilters: isActive
          ? state.activeFilters.filter((f) => f !== filter)
          : [...state.activeFilters, filter],
      };
    }),
  setSearch: (query) => set({ searchQuery: query }),
  clearFilters: () => set({ activeFilters: [], searchQuery: '' }),
}));
