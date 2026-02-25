import React from 'react';
import {
  render,
  fireEvent,
  screen,
} from '@testing-library/react-native';
import { Alert } from 'react-native';
import { format, parseISO } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import ConfirmBookingScreen from '@/app/booking/confirm';
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

jest.mock('@/components/ui/Button', () => {
  const { Pressable, Text } = require('react-native');
  return ({ title, onPress }: { title: string; onPress?: () => void }) => (
    <Pressable onPress={onPress} accessibilityLabel={title}>
      <Text>{title}</Text>
    </Pressable>
  );
});

jest.mock('@/components/ui/Badge', () => {
  const { Text } = require('react-native');
  return ({ label }: { label: string }) => <Text>{label}</Text>;
});

jest.mock('@/components/ui/Skeleton', () => {
  const { View } = require('react-native');
  return () => <View testID="skeleton" />;
});

jest.mock('@/components/booking/CapacityIndicator', () => 'CapacityIndicator');
jest.mock('@/components/booking/PriceSummary', () => 'PriceSummary');

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

// ─── Alert mock ───────────────────────────────────────────────────────────
// Alert.alert is undefined in the jest-expo environment; assign a jest.fn directly.
const mockAlertFn = jest.fn();
beforeAll(() => {
  Alert.alert = mockAlertFn;
});

// ─── Fixtures ─────────────────────────────────────────────────────────────

const mockProduct = {
  id: 'product-1',
  title: 'Open Play',
  type: 'open_play',
};

const mockSession = {
  id: 'session-1',
  product_id: 'product-1',
  starts_at: '2026-02-24T18:00:00.000Z', // noon CST — safe across US timezones
  ends_at: '2026-02-24T20:00:00.000Z',
  price_cents: 2000,
  spots_total: 12,
  spots_remaining: 8,
  spots_booked: 4,
  court: { id: 'court-1', name: 'Court A' },
};

// Compute expected strings the same way the component does (timezone-safe)
const EXPECTED_DATE = format(parseISO(mockSession.starts_at), 'EEEE, MMMM d, yyyy');
const EXPECTED_TIME = `${format(parseISO(mockSession.starts_at), 'h:mm a')} - ${format(parseISO(mockSession.ends_at), 'h:mm a')}`;

// ─── Helpers ──────────────────────────────────────────────────────────────

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
const mockSetGuests = jest.fn();

interface SetupOptions {
  isLoading?: boolean;
  product?: typeof mockProduct | null;
  sessions?: (typeof mockSession & { court: { id: string; name: string } | null })[];
  membership?: { status: string; discount_percent: number } | null;
  guests?: number;
}

function setupMocks({
  isLoading = false,
  product = mockProduct,
  sessions = [mockSession],
  membership = null,
  guests = 0,
}: SetupOptions = {}) {
  (useLocalSearchParams as jest.Mock).mockReturnValue({
    productId: 'product-1',
    sessionId: 'session-1',
  });
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useQuery as jest.Mock).mockImplementation(
    ({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'product') return { data: product, isLoading };
      if (queryKey[0] === 'sessions') return { data: sessions, isLoading };
      if (queryKey[0] === 'membership') return { data: membership };
      return { data: undefined, isLoading: false };
    },
  );
  (useBookingStore as jest.Mock).mockReturnValue({
    guests,
    setGuests: mockSetGuests,
    extras: [],
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('ConfirmBookingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlertFn.mockClear();
  });

  // ── Loading state ──────────────────────────────────────────────────────

  it('renders skeleton placeholders while data is loading', () => {
    setupMocks({ isLoading: true });
    render(<ConfirmBookingScreen />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('does not render the Pay button while loading', () => {
    setupMocks({ isLoading: true });
    render(<ConfirmBookingScreen />);
    expect(screen.queryByText('Pay')).toBeNull();
  });

  // ── Session not found ──────────────────────────────────────────────────

  it('shows "Session not found" when session is absent from results', () => {
    setupMocks({ sessions: [] });
    render(<ConfirmBookingScreen />);
    expect(screen.getByText('Session not found')).toBeTruthy();
  });

  it('shows "Session not found" when product is null', () => {
    setupMocks({ product: null });
    render(<ConfirmBookingScreen />);
    expect(screen.getByText('Session not found')).toBeTruthy();
  });

  it('calls router.back() when "Go Back" is pressed on the error screen', () => {
    setupMocks({ sessions: [] });
    render(<ConfirmBookingScreen />);
    fireEvent.press(screen.getByText('Go Back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  // ── Normal render ──────────────────────────────────────────────────────

  it('renders the product title', () => {
    setupMocks();
    render(<ConfirmBookingScreen />);
    expect(screen.getByText('Open Play')).toBeTruthy();
  });

  it('renders the price per person', () => {
    setupMocks();
    render(<ConfirmBookingScreen />);
    expect(screen.getByText('$20.00')).toBeTruthy();
  });

  it('renders the formatted session date', () => {
    setupMocks();
    render(<ConfirmBookingScreen />);
    expect(screen.getByText(EXPECTED_DATE)).toBeTruthy();
  });

  it('renders the formatted session time range', () => {
    setupMocks();
    render(<ConfirmBookingScreen />);
    expect(screen.getByText(EXPECTED_TIME)).toBeTruthy();
  });

  it('renders the court name when present', () => {
    setupMocks();
    render(<ConfirmBookingScreen />);
    expect(screen.getByText('Court A')).toBeTruthy();
  });

  it('does not render court row when session has no court', () => {
    const sessionWithoutCourt = { ...mockSession, court: null };
    setupMocks({ sessions: [sessionWithoutCourt] });
    render(<ConfirmBookingScreen />);
    expect(screen.queryByText('Court A')).toBeNull();
  });

  // ── Guest counter display ──────────────────────────────────────────────

  it('shows "You + 0 guests" when guests is 0', () => {
    setupMocks({ guests: 0 });
    render(<ConfirmBookingScreen />);
    expect(screen.getByText('You + 0 guests')).toBeTruthy();
  });

  it('uses singular "guest" when guests is 1', () => {
    setupMocks({ guests: 1 });
    render(<ConfirmBookingScreen />);
    expect(screen.getByText('You + 1 guest')).toBeTruthy();
  });

  it('shows total people count in the stepper (1 + guests)', () => {
    setupMocks({ guests: 2 });
    render(<ConfirmBookingScreen />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows available spots count', () => {
    setupMocks();
    render(<ConfirmBookingScreen />);
    expect(screen.getByText('8 spots available')).toBeTruthy();
  });

  // ── Guest counter interactions ─────────────────────────────────────────
  // The stepper's - and + buttons contain only a null-rendered Ionicons, so
  // they have no accessible text. We locate them by scanning the render tree
  // for all nodes with an onPress handler; the first two in document order
  // are always the decrement (index 0) then increment (index 1) buttons.

  function getStepperButtons(renderResult: ReturnType<typeof render>) {
    const onPressNodes = renderResult.UNSAFE_root.findAll(
      (node) => typeof node.props.onPress === 'function',
      { deep: true },
    );
    return { decrement: onPressNodes[0], increment: onPressNodes[1] };
  }

  it('calls setGuests(1) when increment is pressed at 0 guests', () => {
    setupMocks({ guests: 0 });
    const rendered = render(<ConfirmBookingScreen />);
    const { increment } = getStepperButtons(rendered);
    fireEvent.press(increment);
    expect(mockSetGuests).toHaveBeenCalledWith(1);
  });

  it('calls setGuests(1) when decrement is pressed at 2 guests', () => {
    setupMocks({ guests: 2 });
    const rendered = render(<ConfirmBookingScreen />);
    const { decrement } = getStepperButtons(rendered);
    fireEvent.press(decrement);
    expect(mockSetGuests).toHaveBeenCalledWith(1);
  });

  it('does not call setGuests when decrement is pressed at 0 guests', () => {
    setupMocks({ guests: 0 });
    const rendered = render(<ConfirmBookingScreen />);
    const { decrement } = getStepperButtons(rendered);
    fireEvent.press(decrement); // disabled — onPress guard in handler returns early
    expect(mockSetGuests).not.toHaveBeenCalled();
  });

  it('shows Alert instead of incrementing when at max capacity', () => {
    // maxGuests = spots_remaining(8) - 1 = 7; guests=7 → at the limit
    setupMocks({ guests: 7 });
    const rendered = render(<ConfirmBookingScreen />);
    const { increment } = getStepperButtons(rendered);
    fireEvent.press(increment);
    expect(mockAlertFn).toHaveBeenCalledWith(
      'No more spots',
      'Only 8 total spots remaining.',
    );
    expect(mockSetGuests).not.toHaveBeenCalled();
  });

  // ── Action buttons ─────────────────────────────────────────────────────

  it('shows an Alert when "Invite Friends" is pressed', () => {
    setupMocks();
    render(<ConfirmBookingScreen />);
    fireEvent.press(screen.getByText('Invite Friends'));
    expect(mockAlertFn).toHaveBeenCalledWith(
      'Invite Friends',
      'Share a link so your friends can join this session.',
      [{ text: 'OK' }],
    );
  });

  it('navigates to the extras screen with correct params when "Add Extras" is pressed', () => {
    setupMocks();
    render(<ConfirmBookingScreen />);
    fireEvent.press(screen.getByText('Add Extras'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/booking/extras',
      params: { productId: 'product-1', sessionId: 'session-1' },
    });
  });

  it('navigates to the payment screen with correct params when "Pay" is pressed', () => {
    setupMocks();
    render(<ConfirmBookingScreen />);
    fireEvent.press(screen.getByText('Pay'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/booking/payment',
      params: { productId: 'product-1', sessionId: 'session-1' },
    });
  });

  // ── Membership upsell ──────────────────────────────────────────────────

  it('shows the membership upsell banner when user has no membership', () => {
    setupMocks({ membership: null });
    render(<ConfirmBookingScreen />);
    expect(screen.getByText('Save up to 30% with a membership')).toBeTruthy();
  });

  it('hides the membership upsell banner when membership is active', () => {
    setupMocks({ membership: { status: 'active', discount_percent: 20 } });
    render(<ConfirmBookingScreen />);
    expect(
      screen.queryByText('Save up to 30% with a membership'),
    ).toBeNull();
  });

  it('navigates to the membership tab when the upsell banner is pressed', () => {
    setupMocks({ membership: null });
    render(<ConfirmBookingScreen />);
    fireEvent.press(screen.getByText('Save up to 30% with a membership'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/membership');
  });
});
