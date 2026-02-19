import { useFilterStore } from '@/lib/stores/filterStore';

// Reset the store to its initial state before each test
beforeEach(() => {
  useFilterStore.setState({
    activeFilters: [],
    searchQuery: '',
  });
});

describe('filterStore', () => {
  // ---------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------
  describe('initial state', () => {
    it('has an empty activeFilters array', () => {
      expect(useFilterStore.getState().activeFilters).toEqual([]);
    });

    it('has an empty searchQuery', () => {
      expect(useFilterStore.getState().searchQuery).toBe('');
    });
  });

  // ---------------------------------------------------------------
  // toggleFilter
  // ---------------------------------------------------------------
  describe('toggleFilter', () => {
    it('adds a filter that is not currently active', () => {
      useFilterStore.getState().toggleFilter('beginner');
      expect(useFilterStore.getState().activeFilters).toContain('beginner');
      expect(useFilterStore.getState().activeFilters).toHaveLength(1);
    });

    it('removes a filter that is currently active (toggle off)', () => {
      useFilterStore.getState().toggleFilter('beginner');
      useFilterStore.getState().toggleFilter('beginner');
      expect(useFilterStore.getState().activeFilters).not.toContain('beginner');
      expect(useFilterStore.getState().activeFilters).toHaveLength(0);
    });

    it('handles multiple independent filters', () => {
      useFilterStore.getState().toggleFilter('beginner');
      useFilterStore.getState().toggleFilter('coaching');
      useFilterStore.getState().toggleFilter('open_play');

      const filters = useFilterStore.getState().activeFilters;
      expect(filters).toHaveLength(3);
      expect(filters).toContain('beginner');
      expect(filters).toContain('coaching');
      expect(filters).toContain('open_play');
    });

    it('removes only the toggled filter, leaving others intact', () => {
      useFilterStore.getState().toggleFilter('beginner');
      useFilterStore.getState().toggleFilter('coaching');
      useFilterStore.getState().toggleFilter('beginner'); // toggle off

      const filters = useFilterStore.getState().activeFilters;
      expect(filters).toHaveLength(1);
      expect(filters).toContain('coaching');
      expect(filters).not.toContain('beginner');
    });
  });

  // ---------------------------------------------------------------
  // setSearch
  // ---------------------------------------------------------------
  describe('setSearch', () => {
    it('sets the search query', () => {
      useFilterStore.getState().setSearch('pickleball');
      expect(useFilterStore.getState().searchQuery).toBe('pickleball');
    });

    it('can set the search query to an empty string', () => {
      useFilterStore.getState().setSearch('pickleball');
      useFilterStore.getState().setSearch('');
      expect(useFilterStore.getState().searchQuery).toBe('');
    });

    it('overwrites a previous search query', () => {
      useFilterStore.getState().setSearch('tennis');
      useFilterStore.getState().setSearch('volleyball');
      expect(useFilterStore.getState().searchQuery).toBe('volleyball');
    });
  });

  // ---------------------------------------------------------------
  // clearFilters
  // ---------------------------------------------------------------
  describe('clearFilters', () => {
    it('clears all active filters', () => {
      useFilterStore.getState().toggleFilter('beginner');
      useFilterStore.getState().toggleFilter('coaching');
      useFilterStore.getState().clearFilters();
      expect(useFilterStore.getState().activeFilters).toEqual([]);
    });

    it('clears the search query', () => {
      useFilterStore.getState().setSearch('pickleball');
      useFilterStore.getState().clearFilters();
      expect(useFilterStore.getState().searchQuery).toBe('');
    });

    it('clears both filters and search query at the same time', () => {
      useFilterStore.getState().toggleFilter('advanced');
      useFilterStore.getState().setSearch('beach');
      useFilterStore.getState().clearFilters();

      const state = useFilterStore.getState();
      expect(state.activeFilters).toEqual([]);
      expect(state.searchQuery).toBe('');
    });

    it('is a no-op when already in initial state', () => {
      useFilterStore.getState().clearFilters();
      const state = useFilterStore.getState();
      expect(state.activeFilters).toEqual([]);
      expect(state.searchQuery).toBe('');
    });
  });
});
