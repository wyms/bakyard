import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { format, parseISO } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';

import SessionHubScreen from '@/app/session/[id]';
import { useSession } from '@/lib/hooks/useSession';
import { useAuthStore } from '@/lib/stores/authStore';

// ─── Module mocks ─────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock('@/lib/hooks/useSession', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/lib/utils/pricing', () => ({
  formatPrice: (cents: number) => `$${(cents / 100).toFixed(2)}`,
}));

jest.mock('@/components/ui/Card', () => {
  const { View } = require('react-native');
  return ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    [k: string]: unknown;
  }) => <View {...props}>{children}</View>;
});

jest.mock('@/components/ui/Badge', () => {
  const { Text } = require('react-native');
  return ({ label }: { label: string }) => <Text>{label}</Text>;
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

// BottomSheet: renders children when isOpen is true.
jest.mock('@/components/ui/BottomSheet', () => {
  const { View } = require('react-native');
  return ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children?: React.ReactNode;
    [k: string]: unknown;
  }) => (isOpen ? <View testID="bottom-sheet">{children}</View> : null);
});

jest.mock('@/components/session/CountdownBadge', () => {
  const { View } = require('react-native');
  return () => <View testID="countdown-badge" />;
});

jest.mock('@/components/session/Roster', () => {
  const { View } = require('react-native');
  return () => <View testID="roster" />;
});

jest.mock('@/components/session/WeatherBadge', () => {
  const { View } = require('react-native');
  return () => <View testID="weather-badge" />;
});

jest.mock('@/components/session/ChatThread', () => {
  const { View } = require('react-native');
  return () => <View testID="chat-thread" />;
});

jest.mock('@/components/session/InviteLink', () => {
  const { View } = require('react-native');
  return () => <View testID="invite-link" />;
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

// ─── Alert mock ───────────────────────────────────────────────────────────
// Alert.alert is undefined in jest-expo; assign directly in beforeAll.
const mockAlertFn = jest.fn();
beforeAll(() => {
  Alert.alert = mockAlertFn;
});

// ─── Fixtures ─────────────────────────────────────────────────────────────

const mockUser = { id: 'user-1', email: 'player@bakyard.com' };

const bookingConfirmed = {
  id: 'booking-1',
  user_id: 'user-1',
  status: 'confirmed',
  user: { id: 'user-1', full_name: 'Jane Doe', avatar_url: null },
};

const bookingPending = {
  id: 'booking-2',
  user_id: 'user-1',
  status: 'pending',
  user: { id: 'user-1', full_name: 'Jane Doe', avatar_url: null },
};

const bookingOtherCancelled = {
  id: 'booking-3',
  user_id: 'user-2',
  status: 'cancelled',
  user: { id: 'user-2', full_name: 'John Smith', avatar_url: null },
};

const mockSession = {
  id: 'session-1',
  starts_at: '2026-02-24T18:00:00.000Z',
  ends_at: '2026-02-24T20:00:00.000Z',
  price_cents: 2000,
  spots_remaining: 8,
  spots_total: 12,
  status: 'open',
  product: { id: 'product-1', title: 'Open Play' },
  court: { id: 'court-1', name: 'Court A' },
  bookings: [bookingConfirmed],
  weather_snapshot: null as unknown,
};

// Computed the same way the component does (timezone-safe)
const EXPECTED_TIME_RANGE = `${format(parseISO(mockSession.starts_at), 'h:mm')} \u2013 ${format(parseISO(mockSession.ends_at), 'h:mm a')}`;

// ─── Helpers ──────────────────────────────────────────────────────────────

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockRefetch = jest.fn().mockResolvedValue(undefined);

interface SetupOptions {
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  session?: typeof mockSession | null;
  userId?: string | null;
}

function setupMocks({
  isLoading = false,
  isError = false,
  error = null,
  session = mockSession,
  userId = 'user-1',
}: SetupOptions = {}) {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'session-1' });
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useSession as jest.Mock).mockReturnValue({
    data: session,
    isLoading,
    isError,
    error,
    refetch: mockRefetch,
  });
  // useAuthStore uses a selector: useAuthStore(s => s.user)
  (useAuthStore as unknown as jest.Mock).mockImplementation(
    (sel: (s: { user: { id: string } | null }) => unknown) =>
      sel({ user: userId ? { ...mockUser, id: userId } : null }),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('SessionHubScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlertFn.mockClear();
  });

  // ── Loading state ──────────────────────────────────────────────────────

  it('renders skeleton placeholders while data is loading', () => {
    setupMocks({ isLoading: true, session: null });
    render(<SessionHubScreen />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('does not render product title while loading', () => {
    setupMocks({ isLoading: true, session: null });
    render(<SessionHubScreen />);
    expect(screen.queryByText('Open Play')).toBeNull();
  });

  // ── Error state ────────────────────────────────────────────────────────

  it('shows "Unable to load session" when isError is true', () => {
    setupMocks({ isError: true, session: null, error: new Error('Network error') });
    render(<SessionHubScreen />);
    expect(screen.getByText('Unable to load session')).toBeTruthy();
  });

  it('shows "Unable to load session" when session is null without error', () => {
    setupMocks({ session: null });
    render(<SessionHubScreen />);
    expect(screen.getByText('Unable to load session')).toBeTruthy();
  });

  it('displays the error message from the thrown error', () => {
    setupMocks({ isError: true, session: null, error: new Error('Network error') });
    render(<SessionHubScreen />);
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('shows fallback message when no error object is present', () => {
    setupMocks({ isError: true, session: null, error: null });
    render(<SessionHubScreen />);
    expect(screen.getByText('Something went wrong. Please try again.')).toBeTruthy();
  });

  it('calls refetch when Retry is pressed on the error screen', () => {
    setupMocks({ isError: true, session: null, error: new Error('fail') });
    render(<SessionHubScreen />);
    fireEvent.press(screen.getByText('Retry'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  // ── Normal render ──────────────────────────────────────────────────────

  it('renders the product title', () => {
    setupMocks();
    render(<SessionHubScreen />);
    expect(screen.getByText('Open Play')).toBeTruthy();
  });

  it('renders the formatted time range', () => {
    setupMocks();
    render(<SessionHubScreen />);
    expect(screen.getByText(EXPECTED_TIME_RANGE)).toBeTruthy();
  });

  it('renders the CountdownBadge', () => {
    setupMocks();
    render(<SessionHubScreen />);
    expect(screen.getByTestId('countdown-badge')).toBeTruthy();
  });

  it('renders the Roster', () => {
    setupMocks();
    render(<SessionHubScreen />);
    expect(screen.getByTestId('roster')).toBeTruthy();
  });

  it('renders the InviteLink', () => {
    setupMocks();
    render(<SessionHubScreen />);
    expect(screen.getByTestId('invite-link')).toBeTruthy();
  });

  // ── Court row ──────────────────────────────────────────────────────────

  it('renders the court name', () => {
    setupMocks();
    render(<SessionHubScreen />);
    expect(screen.getByText('Court A')).toBeTruthy();
  });

  it('shows "Court assignment pending" when session has no court', () => {
    setupMocks({
      session: { ...mockSession, court: null as unknown as typeof mockSession.court },
    });
    render(<SessionHubScreen />);
    expect(screen.getByText('Court assignment pending')).toBeTruthy();
  });

  it('shows "Open" badge when status is open and spots remain', () => {
    setupMocks({ session: { ...mockSession, status: 'open', spots_remaining: 4 } });
    render(<SessionHubScreen />);
    expect(screen.getByText('Open')).toBeTruthy();
  });

  it('shows "Full" badge when status is full', () => {
    setupMocks({ session: { ...mockSession, status: 'full', spots_remaining: 0 } });
    render(<SessionHubScreen />);
    expect(screen.getByText('Full')).toBeTruthy();
  });

  it('shows no status badge when status is open but spots_remaining is 0', () => {
    setupMocks({ session: { ...mockSession, status: 'open', spots_remaining: 0 } });
    render(<SessionHubScreen />);
    expect(screen.queryByText('Open')).toBeNull();
    expect(screen.queryByText('Full')).toBeNull();
  });

  // ── Price per person ───────────────────────────────────────────────────

  it('shows price divided by active participant count', () => {
    // 1 confirmed booking, price_cents=2000 → $20 Each
    setupMocks();
    render(<SessionHubScreen />);
    expect(screen.getByText('$20 Each')).toBeTruthy();
  });

  it('falls back to session price when there are no active bookings', () => {
    setupMocks({ session: { ...mockSession, bookings: [], price_cents: 3000 } });
    render(<SessionHubScreen />);
    expect(screen.getByText('$30 Each')).toBeTruthy();
  });

  it('excludes cancelled bookings from the participant count', () => {
    // 1 confirmed (user-1) + 1 cancelled (user-2) → activeCount=1
    // If cancelled were counted: price/2=$10; correct answer: price/1=$20
    const session = {
      ...mockSession,
      price_cents: 2000,
      bookings: [bookingConfirmed, bookingOtherCancelled],
    };
    setupMocks({ session });
    render(<SessionHubScreen />);
    expect(screen.getByText('$20 Each')).toBeTruthy();
  });

  // ── Pay button state ───────────────────────────────────────────────────

  it('shows "Pay" when user has no booking in the session', () => {
    setupMocks({ session: { ...mockSession, bookings: [] } });
    render(<SessionHubScreen />);
    expect(screen.getByText('Pay')).toBeTruthy();
  });

  it('shows "Paid" when current user has a confirmed booking', () => {
    setupMocks(); // bookingConfirmed belongs to user-1
    render(<SessionHubScreen />);
    expect(screen.getByText('Paid')).toBeTruthy();
  });

  it('shows "Pay" when current user has only a pending (not confirmed) booking', () => {
    setupMocks({ session: { ...mockSession, bookings: [bookingPending] } });
    render(<SessionHubScreen />);
    expect(screen.getByText('Pay')).toBeTruthy();
  });

  // ── handlePay navigation ───────────────────────────────────────────────

  it('navigates to /booking/payment with the sessionId when Pay is pressed', () => {
    // Use a pending booking so Pay is enabled (not isPaid) and currentUserBooking exists
    setupMocks({ session: { ...mockSession, bookings: [bookingPending] } });
    render(<SessionHubScreen />);
    fireEvent.press(screen.getByText('Pay'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/booking/payment',
      params: { sessionId: 'session-1' },
    });
  });

  // ── handleAddTime ──────────────────────────────────────────────────────

  it('shows an Alert with the correct title and message when "Add Time" is pressed', () => {
    setupMocks();
    render(<SessionHubScreen />);
    fireEvent.press(screen.getByText('Add Time'));
    expect(mockAlertFn).toHaveBeenCalledWith(
      'Add Time',
      'Extend your session by 30 minutes or more.',
      [{ text: 'OK' }],
    );
  });

  // ── Chat bottom sheet ──────────────────────────────────────────────────

  it('does not render the bottom sheet on initial load', () => {
    setupMocks();
    render(<SessionHubScreen />);
    expect(screen.queryByTestId('bottom-sheet')).toBeNull();
  });

  it('opens the bottom sheet when "Session Chat" is pressed', () => {
    setupMocks();
    render(<SessionHubScreen />);
    fireEvent.press(screen.getByText('Session Chat'));
    expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
  });

  it('renders ChatThread inside the bottom sheet when open', () => {
    setupMocks();
    render(<SessionHubScreen />);
    fireEvent.press(screen.getByText('Session Chat'));
    expect(screen.getByTestId('chat-thread')).toBeTruthy();
  });

  // ── Weather section ────────────────────────────────────────────────────

  it('does not render WeatherBadge when weather_snapshot is null', () => {
    setupMocks(); // weather_snapshot: null
    render(<SessionHubScreen />);
    expect(screen.queryByTestId('weather-badge')).toBeNull();
  });

  it('renders WeatherBadge when weather_snapshot is present', () => {
    setupMocks({
      session: {
        ...mockSession,
        weather_snapshot: { temp_f: 72, condition: 'Sunny', icon: 'sunny' },
      },
    });
    render(<SessionHubScreen />);
    expect(screen.getByTestId('weather-badge')).toBeTruthy();
  });
});
