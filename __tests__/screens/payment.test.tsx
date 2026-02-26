import React from 'react';
import {
  render,
  fireEvent,
  screen,
  waitFor,
  act,
} from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import PaymentScreen from '@/app/booking/payment';
import { useBookingStore } from '@/lib/stores/bookingStore';
import { useAuthStore } from '@/lib/stores/authStore';
import { useCreateBooking } from '@/lib/hooks/useBooking';
import { createCheckout } from '@/lib/api/payments';

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

jest.mock('@/lib/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/lib/hooks/useBooking', () => ({
  useCreateBooking: jest.fn(),
}));

jest.mock('@/lib/api/payments', () => ({
  createCheckout: jest.fn(),
}));

jest.mock('@/components/booking/PriceSummary', () => 'PriceSummary');

jest.mock('@/components/ui/Button', () => {
  const { Pressable, Text } = require('react-native');
  return ({
    title,
    onPress,
  }: {
    title: string;
    onPress?: () => void;
  }) => (
    <Pressable onPress={onPress} accessibilityLabel={title}>
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
  const { View: RNView } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
      <RNView {...props}>{children}</RNView>
    ),
  };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────

const mockProduct = { id: 'product-1', title: 'Open Play' };

const mockSession = {
  id: 'session-1',
  product_id: 'product-1',
  starts_at: '2026-02-24T10:00:00.000Z',
  ends_at: '2026-02-24T12:00:00.000Z',
  price_cents: 2000,
  spots_total: 12,
  spots_booked: 4,
  court: { id: 'court-1', name: 'Court A' },
};

// price_cents=2000, guests=0 → totalPeople=1, extrasTotal=0, no discount
// total = 2000 + 0 + 150 (processing fee) = $21.50
const EXPECTED_TOTAL_LABEL = 'Pay Now · $21.50';

// ─── Helpers ──────────────────────────────────────────────────────────────

const mockRouter = { back: jest.fn(), replace: jest.fn() };
const mockMutateAsync = jest.fn();
const mockReset = jest.fn();

interface SetupOptions {
  isLoading?: boolean;
  product?: typeof mockProduct | null;
  sessions?: typeof mockSession[];
  membership?: { status: string; discount_percent: number; id: string } | null;
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
  (useBookingStore as unknown as jest.Mock).mockReturnValue({
    guests,
    extras: [],
    reset: mockReset,
  });
  (useAuthStore as unknown as jest.Mock).mockReturnValue({
    user: {
      email: 'player@bakyard.com',
      user_metadata: { full_name: 'Jane Doe' },
    },
  });
  (useCreateBooking as jest.Mock).mockReturnValue({
    mutateAsync: mockMutateAsync,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('PaymentScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Loading state ──────────────────────────────────────────────────────

  it('renders skeleton placeholders while data is loading', () => {
    setupMocks({ isLoading: true });
    render(<PaymentScreen />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('does not render the pay button while loading', () => {
    setupMocks({ isLoading: true });
    render(<PaymentScreen />);
    expect(screen.queryByText(EXPECTED_TOTAL_LABEL)).toBeNull();
  });

  // ── Session not found ──────────────────────────────────────────────────

  it('shows "Session not found" when session is missing from results', () => {
    setupMocks({ sessions: [] });
    render(<PaymentScreen />);
    expect(screen.getByText('Session not found')).toBeTruthy();
  });

  it('shows "Session not found" when product is null', () => {
    setupMocks({ product: null });
    render(<PaymentScreen />);
    expect(screen.getByText('Session not found')).toBeTruthy();
  });

  it('calls router.back() when "Go Back" is pressed on the not-found screen', () => {
    setupMocks({ sessions: [] });
    render(<PaymentScreen />);
    fireEvent.press(screen.getByText('Go Back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  // ── Normal render ──────────────────────────────────────────────────────

  it('renders the product title in the payment header', () => {
    setupMocks();
    render(<PaymentScreen />);
    expect(screen.getByText('Pay for Open Play')).toBeTruthy();
  });

  it('renders the authenticated user name in the attendee section', () => {
    setupMocks();
    render(<PaymentScreen />);
    expect(screen.getByText('Jane Doe')).toBeTruthy();
  });

  it('shows the pay button with correct total including $1.50 processing fee', () => {
    setupMocks();
    render(<PaymentScreen />);
    expect(screen.getByText(EXPECTED_TOTAL_LABEL)).toBeTruthy();
  });

  it('includes processing fee in total when guests are added', () => {
    // price=2000, guests=1 → totalPeople=2, base=4000, fee=150 → $41.50
    setupMocks({ guests: 1 });
    render(<PaymentScreen />);
    expect(screen.getByText('Pay Now · $41.50')).toBeTruthy();
  });

  it('renders all three selectable payment methods', () => {
    setupMocks();
    render(<PaymentScreen />);
    expect(screen.getByText('Apple Pay')).toBeTruthy();
    expect(screen.getByText('•••• •••• •••• 4242')).toBeTruthy();
    expect(screen.getByText('Simulate Payment')).toBeTruthy();
  });

  // ── Payment method selection ───────────────────────────────────────────

  it('changes pay button label to reflect simulate mode after selection', () => {
    setupMocks();
    render(<PaymentScreen />);

    fireEvent.press(screen.getByText('Simulate Payment'));
    // Title now includes the bug icon variant — the total stays the same
    expect(screen.getByText(EXPECTED_TOTAL_LABEL)).toBeTruthy();
  });

  // ── Processing state ───────────────────────────────────────────────────

  it('shows "Processing payment..." indicator while simulate payment runs', async () => {
    jest.useFakeTimers();
    mockMutateAsync.mockImplementation(() => new Promise(() => {})); // never resolves
    setupMocks();
    render(<PaymentScreen />);

    fireEvent.press(screen.getByText('Simulate Payment'));
    fireEvent.press(screen.getByText(EXPECTED_TOTAL_LABEL));

    expect(screen.getByText('Processing payment...')).toBeTruthy();
  });

  // ── Success state ──────────────────────────────────────────────────────

  it('shows success screen after simulate payment completes', async () => {
    jest.useFakeTimers();
    mockMutateAsync.mockResolvedValue({});
    setupMocks();
    render(<PaymentScreen />);

    fireEvent.press(screen.getByText('Simulate Payment'));
    fireEvent.press(screen.getByText(EXPECTED_TOTAL_LABEL));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByText(/SEE YOU ON THE/)).toBeTruthy();
    });
  });

  it('shows the paid amount on the success confirmation card', async () => {
    jest.useFakeTimers();
    mockMutateAsync.mockResolvedValue({});
    setupMocks();
    render(<PaymentScreen />);

    fireEvent.press(screen.getByText('Simulate Payment'));
    fireEvent.press(screen.getByText(EXPECTED_TOTAL_LABEL));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByText('$21.50 paid')).toBeTruthy();
    });
  });

  it('navigates to home when "Back to Home" is pressed on success screen', async () => {
    jest.useFakeTimers();
    mockMutateAsync.mockResolvedValue({});
    setupMocks();
    render(<PaymentScreen />);

    fireEvent.press(screen.getByText('Simulate Payment'));
    fireEvent.press(screen.getByText(EXPECTED_TOTAL_LABEL));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => screen.getByText('Back to Home'));
    fireEvent.press(screen.getByText('Back to Home'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    expect(mockReset).toHaveBeenCalled();
  });

  // ── Error state ────────────────────────────────────────────────────────

  it('shows an error banner when booking creation fails', async () => {
    jest.useFakeTimers();
    mockMutateAsync.mockRejectedValue(new Error('Booking failed: no spots'));
    setupMocks();
    render(<PaymentScreen />);

    fireEvent.press(screen.getByText('Simulate Payment'));
    fireEvent.press(screen.getByText(EXPECTED_TOTAL_LABEL));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.getByText('Booking failed: no spots')).toBeTruthy();
    });
  });

  it('clears the error banner when Retry is pressed', async () => {
    jest.useFakeTimers();
    mockMutateAsync.mockRejectedValue(new Error('Network error'));
    setupMocks();
    render(<PaymentScreen />);

    fireEvent.press(screen.getByText('Simulate Payment'));
    fireEvent.press(screen.getByText(EXPECTED_TOTAL_LABEL));

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => screen.getByText('Network error'));
    fireEvent.press(screen.getByText('Retry'));

    expect(screen.queryByText('Network error')).toBeNull();
  });

  // ── Stripe / card payment ──────────────────────────────────────────────

  it('calls createCheckout with sessionId when card payment is triggered', async () => {
    jest.useFakeTimers();
    (createCheckout as jest.Mock).mockResolvedValue({
      payment_intent_id: 'pi_test',
      client_secret: 'pi_test_secret',
      amount_cents: 2150,
      discount_cents: 0,
    });
    mockMutateAsync.mockResolvedValue({});
    setupMocks();
    render(<PaymentScreen />);

    // default method is 'card' — press Pay Now directly
    fireEvent.press(screen.getByText(EXPECTED_TOTAL_LABEL));

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    await waitFor(() => {
      expect(createCheckout).toHaveBeenCalledWith('session-1', undefined);
    });
  });

  it('shows error banner when createCheckout throws a non-Stripe error', async () => {
    (createCheckout as jest.Mock).mockRejectedValue(new Error('Checkout failed'));
    setupMocks();
    render(<PaymentScreen />);

    fireEvent.press(screen.getByText(EXPECTED_TOTAL_LABEL));

    await waitFor(() => {
      expect(screen.getByText('Checkout failed')).toBeTruthy();
    });
  });

  // ── Membership discount ────────────────────────────────────────────────

  it('shows Member badge when user has an active membership', () => {
    setupMocks({
      membership: { status: 'active', discount_percent: 20, id: 'mem-1' },
    });
    render(<PaymentScreen />);
    expect(screen.getByText('Member')).toBeTruthy();
  });

  it('applies membership discount to the total', () => {
    // price=2000, discount=20% → discountPerPerson=400
    // total = (2000-400)*1 + 0 + 150 = 1750 → $17.50
    setupMocks({
      membership: { status: 'active', discount_percent: 20, id: 'mem-1' },
    });
    render(<PaymentScreen />);
    expect(screen.getByText('Pay Now · $17.50')).toBeTruthy();
  });
});
