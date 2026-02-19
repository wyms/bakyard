import { create } from 'zustand';

interface BookingExtra {
  id: string;
  name: string;
  price_cents: number;
  quantity: number;
}

interface BookingDraftState {
  selectedSessionId: string | null;
  guests: number;
  extras: BookingExtra[];
  setSession: (sessionId: string | null) => void;
  setGuests: (guests: number) => void;
  addExtra: (extra: BookingExtra) => void;
  removeExtra: (extraId: string) => void;
  reset: () => void;
}

const initialState = {
  selectedSessionId: null,
  guests: 0,
  extras: [] as BookingExtra[],
};

export const useBookingStore = create<BookingDraftState>((set) => ({
  ...initialState,
  setSession: (sessionId) => set({ selectedSessionId: sessionId }),
  setGuests: (guests) => set({ guests }),
  addExtra: (extra) =>
    set((state) => {
      const existing = state.extras.find((e) => e.id === extra.id);
      if (existing) {
        return {
          extras: state.extras.map((e) =>
            e.id === extra.id ? { ...e, quantity: e.quantity + extra.quantity } : e
          ),
        };
      }
      return { extras: [...state.extras, extra] };
    }),
  removeExtra: (extraId) =>
    set((state) => ({
      extras: state.extras.filter((e) => e.id !== extraId),
    })),
  reset: () => set(initialState),
}));
