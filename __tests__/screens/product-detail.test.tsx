import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import ProductDetailScreen from '@/app/product/[id]';
import { useProduct } from '@/lib/hooks/useFeed';
import { logInteraction } from '@/lib/api/feed';
import { useBookingStore } from '@/lib/stores/bookingStore';

// ─── Module mocks ─────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('@/lib/hooks/useFeed', () => ({
  useProduct: jest.fn(),
}));

jest.mock('@/lib/api/feed', () => ({
  getSessionsForProduct: jest.fn(),
  logInteraction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: jest.fn(),
}));

// TimeSlotPicker: each session is a pressable by testID.
jest.mock('@/components/booking/TimeSlotPicker', () => {
  const { View, Text, Pressable } = require('react-native');
  return ({
    sessions,
    onSelect,
  }: {
    sessions: { id: string; [k: string]: unknown }[];
    onSelect: (s: unknown) => void;
  }) => (
    <View testID="time-slot-picker">
      {sessions.map((s) => (
        <Pressable key={s.id} testID={`slot-${s.id}`} onPress={() => onSelect(s)}>
          <Text>{s.id}</Text>
        </Pressable>
      ))}
    </View>
  );
});

// AvailabilityBar: expose spots so we can assert on them.
jest.mock('@/components/ui/AvailabilityBar', () => {
  const { View, Text } = require('react-native');
  return ({
    spotsRemaining,
    spotsTotal,
  }: {
    spotsRemaining: number;
    spotsTotal: number;
  }) => (
    <View testID="availability-bar">
      <Text>{`${spotsRemaining}/${spotsTotal}`}</Text>
    </View>
  );
});

// CourtDiagram: expose the type prop so we can assert on it.
jest.mock('@/components/ui/CourtDiagram', () => {
  const { View, Text } = require('react-native');
  return ({ type }: { type: string }) => (
    <View testID="court-diagram">
      <Text testID="court-diagram-type">{type}</Text>
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

jest.mock('@/components/ui/Badge', () => {
  const { Text } = require('react-native');
  return ({ label }: { label: string }) => <Text testID="product-badge">{label}</Text>;
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
  type: 'open_play' as const,
  description: 'Fun session for all skill levels',
  base_price_cents: 2000,
  duration_minutes: 90,
  capacity: 16,
  tags: ['beginner-friendly', 'social'],
  image_url: null as string | null,
  coach_id: null as string | null,
};

const mockSession = {
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
  court: { id: 'court-1', name: 'Court A' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockSetSession = jest.fn();

interface SetupOptions {
  productLoading?: boolean;
  productError?: Error | null;
  product?: (Omit<typeof mockProduct, 'type'> & { type: string }) | null;
  sessionsLoading?: boolean;
  sessions?: typeof mockSession[];
}

function setupMocks({
  productLoading = false,
  productError = null,
  product = mockProduct,
  sessionsLoading = false,
  sessions = [mockSession],
}: SetupOptions = {}) {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'product-1' });
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useProduct as jest.Mock).mockReturnValue({
    data: product,
    isLoading: productLoading,
    error: productError,
  });
  (useQuery as jest.Mock).mockReturnValue({
    data: sessions,
    isLoading: sessionsLoading,
  });
  (useBookingStore as unknown as jest.Mock).mockReturnValue({
    setSession: mockSetSession,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('ProductDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (logInteraction as jest.Mock).mockResolvedValue(undefined);
  });

  // ── Loading state ──────────────────────────────────────────────────────

  it('renders skeleton placeholders while the product is loading', () => {
    setupMocks({ productLoading: true, product: null });
    render(<ProductDetailScreen />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('does not render the product title while loading', () => {
    setupMocks({ productLoading: true, product: null });
    render(<ProductDetailScreen />);
    expect(screen.queryByText('OPEN PLAY')).toBeNull();
  });

  // ── Error state ────────────────────────────────────────────────────────

  it('shows "Could not load product" on error', () => {
    setupMocks({ productError: new Error('Network error'), product: null });
    render(<ProductDetailScreen />);
    expect(screen.getByText('Could not load product')).toBeTruthy();
  });

  it('shows the error message detail on error', () => {
    setupMocks({ productError: new Error('Network error'), product: null });
    render(<ProductDetailScreen />);
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('shows "Product not found" when product is null with no error', () => {
    setupMocks({ product: null });
    render(<ProductDetailScreen />);
    expect(screen.getByText('Product not found')).toBeTruthy();
  });

  it('calls router.back() when "Go Back" is pressed on the error screen', () => {
    setupMocks({ product: null });
    render(<ProductDetailScreen />);
    fireEvent.press(screen.getByText('Go Back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  // ── Product header ─────────────────────────────────────────────────────

  it('renders the product title uppercased', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    expect(screen.getByText('OPEN PLAY')).toBeTruthy();
  });

  it('renders the product description', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    expect(screen.getByText('Fun session for all skill levels')).toBeTruthy();
  });

  it('renders the product type badge with the correct label', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    expect(screen.getByTestId('product-badge').props.children).toBe('Open Play');
  });

  it('renders product tags', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    expect(screen.getByText('beginner-friendly')).toBeTruthy();
    expect(screen.getByText('social')).toBeTruthy();
  });

  it('does not render tags when the product has none', () => {
    setupMocks({ product: { ...mockProduct, tags: [] } });
    render(<ProductDetailScreen />);
    expect(screen.queryByText('beginner-friendly')).toBeNull();
  });

  // ── Price display ──────────────────────────────────────────────────────

  it('shows "$X.XX/person" for open_play products', () => {
    setupMocks({ product: { ...mockProduct, type: 'open_play' } });
    render(<ProductDetailScreen />);
    expect(screen.getByText('$20.00/person')).toBeTruthy();
  });

  it('shows "$X.XX/hr" for court_rental products', () => {
    setupMocks({ product: { ...mockProduct, type: 'court_rental' } });
    render(<ProductDetailScreen />);
    expect(screen.getByText('$20.00/hr')).toBeTruthy();
  });

  it('shows "$X.XX/session" for coaching products', () => {
    setupMocks({ product: { ...mockProduct, type: 'coaching' } });
    render(<ProductDetailScreen />);
    expect(screen.getByText('$20.00/session')).toBeTruthy();
  });

  it('does not render a price when base_price_cents is null', () => {
    setupMocks({ product: { ...mockProduct, base_price_cents: null as unknown as number } });
    render(<ProductDetailScreen />);
    expect(screen.queryByText(/\$.*\//)).toBeNull();
  });

  // ── Meta info ──────────────────────────────────────────────────────────

  it('shows duration_minutes when no session is selected', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    expect(screen.getByText('90 min')).toBeTruthy();
  });

  it('shows capacity when set', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    expect(screen.getByText('Up to 16 players')).toBeTruthy();
  });

  // ── Back button ────────────────────────────────────────────────────────

  it('calls router.back() when the back button is pressed', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    fireEvent.press(screen.getByText('Schedule'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  // ── logInteraction ─────────────────────────────────────────────────────

  it('calls logInteraction with (id, "view") on mount', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    expect(logInteraction).toHaveBeenCalledWith('product-1', 'view');
  });

  // ── Sessions section ───────────────────────────────────────────────────

  it('shows session skeleton when sessions are loading', () => {
    setupMocks({ sessionsLoading: true, sessions: [] });
    render(<ProductDetailScreen />);
    // At least one skeleton present (product already loaded, sessions still loading)
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('shows "No upcoming sessions available" when sessions list is empty', () => {
    setupMocks({ sessions: [] });
    render(<ProductDetailScreen />);
    expect(screen.getByText('No upcoming sessions available')).toBeTruthy();
  });

  it('renders the TimeSlotPicker when sessions exist', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    expect(screen.getByTestId('time-slot-picker')).toBeTruthy();
  });

  it('passes all sessions to the TimeSlotPicker', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    expect(screen.getByTestId('slot-session-1')).toBeTruthy();
  });

  // ── Session selection ──────────────────────────────────────────────────

  it('calls setSession with the selected session id', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(mockSetSession).toHaveBeenCalledWith('session-1');
  });

  it('shows the AvailabilityBar after a session is selected', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    expect(screen.queryByTestId('availability-bar')).toBeNull();
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(screen.getByTestId('availability-bar')).toBeTruthy();
  });

  it('passes spots data to the AvailabilityBar', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(screen.getByText('8/12')).toBeTruthy();
  });

  it('shows the session court name in the meta row after selection', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(screen.getByText('Court A')).toBeTruthy();
  });

  it('hides duration_minutes after a session is selected', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    expect(screen.getByText('90 min')).toBeTruthy();
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(screen.queryByText('90 min')).toBeNull();
  });

  // ── CTA button ─────────────────────────────────────────────────────────

  it('shows "Select a Time to Book" before a session is selected', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    expect(screen.getByText('Select a Time to Book')).toBeTruthy();
  });

  it('shows the session price in the CTA after selection', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    expect(screen.getByText('BOOK THIS SESSION · $20.00')).toBeTruthy();
  });

  it('does not navigate when CTA is pressed without a session selected', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    fireEvent.press(screen.getByText('Select a Time to Book'));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  // ── handleBookNow navigation ───────────────────────────────────────────

  it('navigates to /booking/confirm for non-court_rental products', () => {
    setupMocks({ product: { ...mockProduct, type: 'open_play' } });
    render(<ProductDetailScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    fireEvent.press(screen.getByText('BOOK THIS SESSION · $20.00'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/booking/confirm',
      params: { productId: 'product-1', sessionId: 'session-1' },
    });
  });

  it('navigates to /booking/select-time for court_rental products', () => {
    setupMocks({ product: { ...mockProduct, type: 'court_rental' } });
    render(<ProductDetailScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    fireEvent.press(screen.getByText('BOOK THIS SESSION · $20.00'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/booking/select-time',
      params: { productId: 'product-1' },
    });
  });

  it('calls logInteraction with (id, "tap") when booking', () => {
    setupMocks();
    render(<ProductDetailScreen />);
    fireEvent.press(screen.getByTestId('slot-session-1'));
    fireEvent.press(screen.getByText('BOOK THIS SESSION · $20.00'));
    expect(logInteraction).toHaveBeenCalledWith('product-1', 'tap');
  });

  // ── Coach card ─────────────────────────────────────────────────────────

  it('does not show the coach card for non-coaching products', () => {
    setupMocks({ product: { ...mockProduct, type: 'open_play' } });
    render(<ProductDetailScreen />);
    expect(screen.queryByText('Head Coach')).toBeNull();
  });

  it('shows the coach card for coaching products with a coach_id', () => {
    setupMocks({ product: { ...mockProduct, type: 'coaching', coach_id: 'coach-1' } });
    render(<ProductDetailScreen />);
    expect(screen.getByText('Head Coach')).toBeTruthy();
    expect(screen.getByText('Bakyard · Plano, TX')).toBeTruthy();
  });

  it('navigates to the coach profile when the coach card is pressed', () => {
    setupMocks({ product: { ...mockProduct, type: 'coaching', coach_id: 'coach-1' } });
    render(<ProductDetailScreen />);
    fireEvent.press(screen.getByText('Head Coach'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/coach/[id]',
      params: { id: 'coach-1' },
    });
  });

  // ── CourtDiagram type prop ─────────────────────────────────────────────

  it('passes "clinic" type to CourtDiagram for clinic products', () => {
    setupMocks({ product: { ...mockProduct, type: 'clinic' } });
    render(<ProductDetailScreen />);
    expect(screen.getByTestId('court-diagram-type').props.children).toBe('clinic');
  });

  it('passes "private" type to CourtDiagram for court_rental products', () => {
    setupMocks({ product: { ...mockProduct, type: 'court_rental' } });
    render(<ProductDetailScreen />);
    expect(screen.getByTestId('court-diagram-type').props.children).toBe('private');
  });

  it('passes "open_play" type to CourtDiagram for all other product types', () => {
    setupMocks({ product: { ...mockProduct, type: 'open_play' } });
    render(<ProductDetailScreen />);
    expect(screen.getByTestId('court-diagram-type').props.children).toBe('open_play');
  });
});
