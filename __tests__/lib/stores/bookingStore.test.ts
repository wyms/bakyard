import { useBookingStore } from '@/lib/stores/bookingStore';

// Reset the store to its initial state before each test
beforeEach(() => {
  useBookingStore.setState({
    selectedSessionId: null,
    guests: 0,
    extras: [],
  });
});

describe('bookingStore', () => {
  // ---------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------
  describe('initial state', () => {
    it('has null selectedSessionId', () => {
      expect(useBookingStore.getState().selectedSessionId).toBeNull();
    });

    it('has 0 guests', () => {
      expect(useBookingStore.getState().guests).toBe(0);
    });

    it('has an empty extras array', () => {
      expect(useBookingStore.getState().extras).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // setSession
  // ---------------------------------------------------------------
  describe('setSession', () => {
    it('sets the selected session ID', () => {
      useBookingStore.getState().setSession('session-123');
      expect(useBookingStore.getState().selectedSessionId).toBe('session-123');
    });

    it('clears the session ID when set to null', () => {
      useBookingStore.getState().setSession('session-123');
      useBookingStore.getState().setSession(null);
      expect(useBookingStore.getState().selectedSessionId).toBeNull();
    });

    it('overwrites a previously set session ID', () => {
      useBookingStore.getState().setSession('session-111');
      useBookingStore.getState().setSession('session-222');
      expect(useBookingStore.getState().selectedSessionId).toBe('session-222');
    });
  });

  // ---------------------------------------------------------------
  // setGuests
  // ---------------------------------------------------------------
  describe('setGuests', () => {
    it('sets the guest count', () => {
      useBookingStore.getState().setGuests(3);
      expect(useBookingStore.getState().guests).toBe(3);
    });

    it('can set guests back to zero', () => {
      useBookingStore.getState().setGuests(5);
      useBookingStore.getState().setGuests(0);
      expect(useBookingStore.getState().guests).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // addExtra
  // ---------------------------------------------------------------
  describe('addExtra', () => {
    const extra1 = { id: 'extra-1', name: 'Towel', price_cents: 500, quantity: 1 };
    const extra2 = { id: 'extra-2', name: 'Water', price_cents: 300, quantity: 2 };

    it('adds a new extra to an empty list', () => {
      useBookingStore.getState().addExtra(extra1);
      expect(useBookingStore.getState().extras).toHaveLength(1);
      expect(useBookingStore.getState().extras[0]).toEqual(extra1);
    });

    it('adds multiple different extras', () => {
      useBookingStore.getState().addExtra(extra1);
      useBookingStore.getState().addExtra(extra2);
      expect(useBookingStore.getState().extras).toHaveLength(2);
    });

    it('increments quantity when adding an extra with the same ID', () => {
      useBookingStore.getState().addExtra(extra1);
      useBookingStore.getState().addExtra({ ...extra1, quantity: 3 });
      const extras = useBookingStore.getState().extras;
      expect(extras).toHaveLength(1);
      expect(extras[0].quantity).toBe(4); // 1 + 3
    });

    it('does not duplicate entries when incrementing quantity', () => {
      useBookingStore.getState().addExtra(extra1);
      useBookingStore.getState().addExtra(extra1);
      expect(useBookingStore.getState().extras).toHaveLength(1);
      expect(useBookingStore.getState().extras[0].quantity).toBe(2);
    });
  });

  // ---------------------------------------------------------------
  // removeExtra
  // ---------------------------------------------------------------
  describe('removeExtra', () => {
    const extra1 = { id: 'extra-1', name: 'Towel', price_cents: 500, quantity: 1 };
    const extra2 = { id: 'extra-2', name: 'Water', price_cents: 300, quantity: 2 };

    it('removes an extra by ID', () => {
      useBookingStore.getState().addExtra(extra1);
      useBookingStore.getState().addExtra(extra2);
      useBookingStore.getState().removeExtra('extra-1');
      const extras = useBookingStore.getState().extras;
      expect(extras).toHaveLength(1);
      expect(extras[0].id).toBe('extra-2');
    });

    it('is a no-op when removing a non-existent ID', () => {
      useBookingStore.getState().addExtra(extra1);
      useBookingStore.getState().removeExtra('non-existent');
      expect(useBookingStore.getState().extras).toHaveLength(1);
    });

    it('results in empty array when last extra is removed', () => {
      useBookingStore.getState().addExtra(extra1);
      useBookingStore.getState().removeExtra('extra-1');
      expect(useBookingStore.getState().extras).toEqual([]);
    });
  });

  // ---------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------
  describe('reset', () => {
    it('resets all state back to initial values', () => {
      // Modify all state fields
      useBookingStore.getState().setSession('session-abc');
      useBookingStore.getState().setGuests(4);
      useBookingStore.getState().addExtra({
        id: 'extra-1',
        name: 'Towel',
        price_cents: 500,
        quantity: 1,
      });

      // Reset
      useBookingStore.getState().reset();

      const state = useBookingStore.getState();
      expect(state.selectedSessionId).toBeNull();
      expect(state.guests).toBe(0);
      expect(state.extras).toEqual([]);
    });
  });
});
