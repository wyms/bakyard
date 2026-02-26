import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import SelectTimeScreen from '@/app/booking/select-time';
import { useBookingStore } from '@/lib/stores/bookingStore';

// ─── Module mocks ─────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: jest.fn(),
}));

// TimeSlotPicker: renders each session as a pressable by testID and exposes
// memberDiscountPercent so we can assert on it.
jest.mock('@/components/booking/TimeSlotPicker', () => {
  const { View, Text, Pressable } = require('react-native');
  return ({
    sessions,
    onSelect,
    memberDiscountPercent,
  }: {
    sessions: { id: string; [k: string]: unknown }[];
    onSelect: (s: unknown) => void;
    memberDiscountPercent?: number;
  }) => (
    <View testID="time-slot-picker">
      {sessions.map((s) => (
        <Pressable
          key={s.id}
          testID={`slot-${s.id}`}
          onPress={() => onSelect(s)}
        >
          <Text>{s.id}</Text>
        </Pressable>
      ))}
      {memberDiscountPercent != null && (
        <Text testID="member-discount-value">{memberDiscountPercent}</Text>
      )}
    </View>
  );
});

// CourtPicker: renders each court as a pressable by testID.
jest.mock('@/components/booking/CourtPicker', () => {
  const { View, Text, Pressable } = require('react-native');
  return ({
    courts,
    selectedCourtId,
    onSelect,
  }: {
    courts: { id: string; name: string; [k: string]: unknown }[];
    selectedCourtId: string | null;
    onSelect: (id: string) => void;
  }) => (
    <View testID="court-picker">
      <Text testID="selected-court-id">{selectedCourtId ?? 'none'}</Text>
      {courts.map((c) => (
        <Pressable key={c.id} testID={`court-${c.id}`} onPress={() => onSelect(c.id)}>
          <Text>{c.name}</Text>
        </Pressable>
      ))}
    </View>
  );
});

jest.mock('@/components/ui/Button', () => {
  const { Pressable, Text } = require('react-native');
  return ({
    title,
    onPress,
    disabled,
  }: {
    title: string;
    onPress?: () => void;
    disabled?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text>{title}</Text>
    </Pressable>
  );
});

jest.mock('@/components/ui/Skeleton', () => {
  const { View } = require('react-native');
  return () => <View testID="skeleton" />;
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [k: string]: unknown;
    }) => <View {...props}>{children}</View>,
  };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────

const mockProduct = {
  id: 'product-1',
  title: 'Open Play',
  base_price_cents: 2000,
};

const courtA = { id: 'court-1', name: 'Court 1', sort_order: 1, is_available: true };
const courtB = { id: 'court-2', name: 'Court 2', sort_order: 2, is_available: true };

const sessionA = {
  id: 'session-1',
  product_id: 'product-1',
  starts_at: '2026-02-25T18:00:00.000Z',
  ends_at: '2026-02-25T20:00:00.000Z',
  price_cents: 2000,
  spots_total: 12,
  spots_remaining: 8,
  spots_booked: 4,
  status: 'open',
  court_id: 'court-1',
  court: courtA,
};

const sessionB = {
  id: 'session-2',
  product_id: 'product-1',
  starts_at: '2026-02-25T20:00:00.000Z',
  ends_at: '2026-02-25T22:00:00.000Z',
  price_cents: 2000,
  spots_total: 12,
  spots_remaining: 6,
  spots_booked: 6,
  status: 'open',
  court_id: 'court-2',
  court: courtB,
};

// ─── Helpers ──────────────────────────────────────────────────────────────

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockSetSession = jest.fn();

interface SetupOptions {
  isLoading?: boolean;
  product?: typeof mockProduct | null;
  sessions?: typeof sessionA[];
  membership?: { status: string; discount_percent: number } | null;
}

function setupMocks({
  isLoading = false,
  product = mockProduct,
  sessions = [sessionA, sessionB],
  membership = null,
}: SetupOptions = {}) {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ productId: 'product-1' });
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useQuery as jest.Mock).mockImplementation(
    ({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'product') return { data: product, isLoading };
      if (queryKey[0] === 'sessions') return { data: sessions, isLoading };
      if (queryKey[0] === 'membership') return { data: membership };
      return { data: undefined, isLoading: false };
    },
  );
  (useBookingStore as unknown as jest.Mock).mockReturnValue({
    setSession: mockSetSession,
    selectedSessionId: null,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('SelectTimeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────

  it('renders skeleton placeholders while data is loading', () => {
    setupMocks({ isLoading: true });
    render(<SelectTimeScreen />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('does not render the TimeSlotPicker while loading', () => {
    setupMocks({ isLoading: true });
    render(<SelectTimeScreen />);
    expect(screen.queryByTestId('time-slot-picker')).toBeNull();
  });

  // ── Product header ─────────────────────────────────────────────────────

  it('renders "Book {product.title}" as the screen heading', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    expect(screen.getByText('Book Open Play')).toBeTruthy();
  });

  it('renders the starting price when base_price_cents is set', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    expect(screen.getByText('Starting at $20.00')).toBeTruthy();
  });

  it('does not render a starting price when base_price_cents is null', () => {
    setupMocks({ product: { ...mockProduct, base_price_cents: null as unknown as number } });
    render(<SelectTimeScreen />);
    expect(screen.queryByText(/Starting at/)).toBeNull();
  });

  // ── TimeSlotPicker ─────────────────────────────────────────────────────

  it('renders the TimeSlotPicker', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    expect(screen.getByTestId('time-slot-picker')).toBeTruthy();
  });

  it('passes all sessions to TimeSlotPicker when no court is selected', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    expect(screen.getByTestId('slot-session-1')).toBeTruthy();
    expect(screen.getByTestId('slot-session-2')).toBeTruthy();
  });

  it('does not pass memberDiscountPercent when there is no membership', () => {
    setupMocks({ membership: null });
    render(<SelectTimeScreen />);
    expect(screen.queryByTestId('member-discount-value')).toBeNull();
  });

  it('passes memberDiscountPercent to TimeSlotPicker when membership is active', () => {
    setupMocks({ membership: { status: 'active', discount_percent: 15 } });
    render(<SelectTimeScreen />);
    expect(screen.getByTestId('member-discount-value').props.children).toBe(15);
  });

  // ── CourtPicker ────────────────────────────────────────────────────────

  it('renders the CourtPicker when sessions have courts', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    expect(screen.getByTestId('court-picker')).toBeTruthy();
  });

  it('hides the CourtPicker when sessions have no courts', () => {
    const sessionsNoCourt = [
      { ...sessionA, court_id: null as unknown as string, court: null as unknown as typeof courtA },
    ];
    setupMocks({ sessions: sessionsNoCourt });
    render(<SelectTimeScreen />);
    expect(screen.queryByTestId('court-picker')).toBeNull();
  });

  it('renders all unique courts in the CourtPicker', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    expect(screen.getByTestId('court-court-1')).toBeTruthy();
    expect(screen.getByTestId('court-court-2')).toBeTruthy();
  });

  // ── Session selection ──────────────────────────────────────────────────

  it('calls setSession with the selected session id', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(mockSetSession).toHaveBeenCalledWith('session-1');
  });

  it('shows "Your Selection" summary after a session is selected', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    expect(screen.queryByText('Your Selection')).toBeNull();
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(screen.getByText('Your Selection')).toBeTruthy();
  });

  it('shows price per person in the selection summary', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(screen.getByText('$20.00 per person')).toBeTruthy();
  });

  it('shows spots remaining in the selection summary', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(screen.getByText('8 of 12 spots remaining')).toBeTruthy();
  });

  it('shows the court name in the selection summary when the session has a court', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    // Before selection only the CourtPicker renders "Court 1" once.
    expect(screen.getAllByText('Court 1')).toHaveLength(1);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    // After selection the summary also renders the court name → two occurrences.
    expect(screen.getAllByText('Court 1')).toHaveLength(2);
  });

  it('auto-selects the court when a session with a court is chosen', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1')); // court-1
    expect(screen.getByTestId('selected-court-id').props.children).toBe('court-1');
  });

  // ── Court filtering ────────────────────────────────────────────────────

  it('filters sessions to only the chosen court after CourtPicker selection', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    fireEvent.press(screen.getByTestId('court-court-1'));
    // Only session-1 (court-1) should reach TimeSlotPicker
    expect(screen.getByTestId('slot-session-1')).toBeTruthy();
    expect(screen.queryByTestId('slot-session-2')).toBeNull();
  });

  it('clears the selected session when a different court is chosen', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    // Pick session-1 (court-1), then switch to court-2
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(screen.getByText('Your Selection')).toBeTruthy();
    fireEvent.press(screen.getByTestId('court-court-2'));
    // Summary should disappear
    expect(screen.queryByText('Your Selection')).toBeNull();
    expect(mockSetSession).toHaveBeenLastCalledWith(null);
  });

  // ── CTA button states ──────────────────────────────────────────────────

  it('shows "Select a time slot" on the CTA before any selection', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    expect(screen.getByText('Select a time slot')).toBeTruthy();
  });

  it('shows "Continue" on the CTA after a session is selected', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('does not show "Keep going" hint before a session is selected', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    expect(screen.queryByText('Keep going')).toBeNull();
  });

  it('shows "Keep going" hint after a session is selected', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(screen.getByText('Keep going')).toBeTruthy();
  });

  it('does not navigate when CTA is pressed without a session selected', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    fireEvent.press(screen.getByText('Select a time slot'));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  // ── Navigation ─────────────────────────────────────────────────────────

  it('navigates to /booking/confirm with correct params when Continue is pressed', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    fireEvent.press(screen.getByText('Continue'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/booking/confirm',
      params: { productId: 'product-1', sessionId: 'session-1' },
    });
  });

  it('navigates via the "Pay" action button after a session is selected', () => {
    setupMocks();
    render(<SelectTimeScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    fireEvent.press(screen.getByText('Pay'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/booking/confirm',
      params: { productId: 'product-1', sessionId: 'session-1' },
    });
  });
});
