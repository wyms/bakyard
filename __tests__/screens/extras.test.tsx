import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import ExtrasScreen from '@/app/booking/extras';
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

const mockProduct = { id: 'product-1', title: 'Open Play' };

const mockExtrasProducts = [
  {
    id: 'extra-1',
    name: 'Water Bottle',
    description: 'Stay hydrated',
    price_cents: 300,
    icon: 'water-outline',
  },
  {
    id: 'extra-2',
    name: 'Snack Pack',
    description: 'Trail mix and nuts',
    price_cents: 500,
    icon: 'nutrition-outline',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

const mockRouter = { push: jest.fn(), back: jest.fn() };
const mockAddExtra = jest.fn();
const mockRemoveExtra = jest.fn();

interface StoreExtras {
  id: string;
  name: string;
  price_cents: number;
  quantity: number;
}

interface SetupOptions {
  extrasLoading?: boolean;
  extrasProducts?: typeof mockExtrasProducts | [];
  storeExtras?: StoreExtras[];
}

function setupMocks({
  extrasLoading = false,
  extrasProducts = mockExtrasProducts,
  storeExtras = [],
}: SetupOptions = {}) {
  (useLocalSearchParams as jest.Mock).mockReturnValue({
    productId: 'product-1',
    sessionId: 'session-1',
  });
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
  (useQuery as jest.Mock).mockImplementation(
    ({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === 'product') return { data: mockProduct };
      if (queryKey[0] === 'extras-products')
        return { data: extrasProducts, isLoading: extrasLoading };
      return { data: undefined, isLoading: false };
    },
  );
  (useBookingStore as unknown as jest.Mock).mockReturnValue({
    extras: storeExtras,
    addExtra: mockAddExtra,
    removeExtra: mockRemoveExtra,
  });
}

// Returns all nodes with an onPress handler in render-tree order.
function getOnPressNodes(renderResult: ReturnType<typeof render>) {
  return renderResult.UNSAFE_root.findAll(
    (node: { props: Record<string, unknown> }) => typeof node.props.onPress === 'function',
    { deep: true },
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('ExtrasScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────

  it('renders skeleton placeholders while extras are loading', () => {
    setupMocks({ extrasLoading: true, extrasProducts: [] });
    render(<ExtrasScreen />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  // ── Empty state ────────────────────────────────────────────────────────

  it('shows "No extras available right now" when the list is empty', () => {
    setupMocks({ extrasProducts: [] });
    render(<ExtrasScreen />);
    expect(screen.getByText('No extras available right now')).toBeTruthy();
  });

  // ── Normal render ──────────────────────────────────────────────────────

  it('renders the screen header', () => {
    setupMocks();
    render(<ExtrasScreen />);
    expect(screen.getByText('Add Extras')).toBeTruthy();
    expect(
      screen.getByText('Grab some food, drinks, or gear for your session'),
    ).toBeTruthy();
  });

  it('renders each extra item name', () => {
    setupMocks();
    render(<ExtrasScreen />);
    expect(screen.getByText('Water Bottle')).toBeTruthy();
    expect(screen.getByText('Snack Pack')).toBeTruthy();
  });

  it('renders each extra item description', () => {
    setupMocks();
    render(<ExtrasScreen />);
    expect(screen.getByText('Stay hydrated')).toBeTruthy();
    expect(screen.getByText('Trail mix and nuts')).toBeTruthy();
  });

  it('renders each extra item price', () => {
    setupMocks();
    render(<ExtrasScreen />);
    expect(screen.getByText('$3.00')).toBeTruthy();
    expect(screen.getByText('$5.00')).toBeTruthy();
  });

  // ── Zero-items UI ──────────────────────────────────────────────────────

  it('shows "Continue to Payment" without a price when no items are selected', () => {
    setupMocks();
    render(<ExtrasScreen />);
    expect(screen.getByText('Continue to Payment')).toBeTruthy();
  });

  it('shows the "Skip extras" link when no items are selected', () => {
    setupMocks();
    render(<ExtrasScreen />);
    expect(screen.getByText('Skip extras')).toBeTruthy();
  });

  it('does not show the running-total bar when no items are selected', () => {
    setupMocks();
    render(<ExtrasScreen />);
    expect(screen.queryByText(/item(s)? added/)).toBeNull();
  });

  // ── Increment interaction ──────────────────────────────────────────────
  // With two extras and no items selected, onPress order is:
  //   [0] increment Water Bottle, [1] increment Snack Pack,
  //   [2] Continue button, [3] Skip extras

  it('calls addExtra with correct args when the first item is incremented', () => {
    setupMocks();
    const rendered = render(<ExtrasScreen />);
    const nodes = getOnPressNodes(rendered);
    fireEvent.press(nodes[0]); // increment Water Bottle
    expect(mockAddExtra).toHaveBeenCalledWith({
      id: 'extra-1',
      name: 'Water Bottle',
      price_cents: 300,
      quantity: 1,
    });
  });

  it('shows the quantity after incrementing an item', () => {
    setupMocks();
    const rendered = render(<ExtrasScreen />);
    const nodes = getOnPressNodes(rendered);
    fireEvent.press(nodes[0]); // increment Water Bottle
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('shows "1 item added" in the running-total bar after one increment', () => {
    setupMocks();
    const rendered = render(<ExtrasScreen />);
    const nodes = getOnPressNodes(rendered);
    fireEvent.press(nodes[0]); // increment Water Bottle
    expect(screen.getByText('1 item added')).toBeTruthy();
  });

  it('shows the running total price in the bar', () => {
    setupMocks();
    const rendered = render(<ExtrasScreen />);
    const nodes = getOnPressNodes(rendered);
    fireEvent.press(nodes[0]); // increment Water Bottle ($3.00)
    expect(screen.getByText('+$3.00')).toBeTruthy();
  });

  it('uses plural "items" in the running-total bar when more than one item added', () => {
    setupMocks();
    const rendered = render(<ExtrasScreen />);
    const nodes = getOnPressNodes(rendered);
    fireEvent.press(nodes[0]); // increment Water Bottle → qty 1
    // After first increment: [0]=dec-Water, [1]=inc-Water, [2]=inc-Snack, [3]=Continue
    const nodesAfter = getOnPressNodes(rendered);
    fireEvent.press(nodesAfter[1]); // increment Water Bottle again → qty 2
    expect(screen.getByText('2 items added')).toBeTruthy();
  });

  it('adds the correct total when two different items are incremented', () => {
    // Water Bottle $3.00 + Snack Pack $5.00 = $8.00
    setupMocks();
    const rendered = render(<ExtrasScreen />);
    const nodes = getOnPressNodes(rendered);
    fireEvent.press(nodes[0]); // increment Water Bottle
    const nodesAfter = getOnPressNodes(rendered);
    // After Water Bottle added: [dec-Water, inc-Water, inc-Snack, Continue]
    fireEvent.press(nodesAfter[2]); // increment Snack Pack
    expect(screen.getByText('+$8.00')).toBeTruthy();
  });

  it('hides "Skip extras" after an item is added', () => {
    setupMocks();
    const rendered = render(<ExtrasScreen />);
    const nodes = getOnPressNodes(rendered);
    fireEvent.press(nodes[0]); // increment
    expect(screen.queryByText('Skip extras')).toBeNull();
  });

  it('updates Continue button to show total price after items are added', () => {
    setupMocks();
    const rendered = render(<ExtrasScreen />);
    const nodes = getOnPressNodes(rendered);
    fireEvent.press(nodes[0]); // increment Water Bottle ($3.00)
    expect(
      screen.getByText('Continue to Payment (+$3.00)'),
    ).toBeTruthy();
  });

  // ── Decrement interaction ──────────────────────────────────────────────
  // Initialize with Water Bottle qty=1 via store so the decrement button is visible.
  // onPress order: [0] dec-Water, [1] inc-Water, [2] inc-Snack, [3] Continue
  // (Skip hidden because itemCount > 0)

  it('calls removeExtra when decrementing the last unit of an item', () => {
    setupMocks({
      storeExtras: [{ id: 'extra-1', name: 'Water Bottle', price_cents: 300, quantity: 1 }],
    });
    const rendered = render(<ExtrasScreen />);
    const nodes = getOnPressNodes(rendered);
    fireEvent.press(nodes[0]); // decrement Water Bottle (qty 1 → 0)
    expect(mockRemoveExtra).toHaveBeenCalledWith('extra-1');
  });

  it('does not call addExtra when decrementing the last unit', () => {
    setupMocks({
      storeExtras: [{ id: 'extra-1', name: 'Water Bottle', price_cents: 300, quantity: 1 }],
    });
    const rendered = render(<ExtrasScreen />);
    const nodes = getOnPressNodes(rendered);
    fireEvent.press(nodes[0]); // decrement to 0
    expect(mockAddExtra).not.toHaveBeenCalled();
  });

  it('hides the quantity display after the last unit is decremented', () => {
    setupMocks({
      storeExtras: [{ id: 'extra-1', name: 'Water Bottle', price_cents: 300, quantity: 1 }],
    });
    const rendered = render(<ExtrasScreen />);
    const nodes = getOnPressNodes(rendered);
    fireEvent.press(nodes[0]); // decrement to 0
    expect(screen.queryByText('1')).toBeNull();
  });

  it('calls removeExtra then addExtra when decrementing a quantity greater than 1', () => {
    setupMocks({
      storeExtras: [{ id: 'extra-1', name: 'Water Bottle', price_cents: 300, quantity: 2 }],
    });
    const rendered = render(<ExtrasScreen />);
    const nodes = getOnPressNodes(rendered);
    fireEvent.press(nodes[0]); // decrement (qty 2 → 1)
    expect(mockRemoveExtra).toHaveBeenCalledWith('extra-1');
    expect(mockAddExtra).toHaveBeenCalledWith({
      id: 'extra-1',
      name: 'Water Bottle',
      price_cents: 300,
      quantity: 1,
    });
  });

  // ── Navigation ─────────────────────────────────────────────────────────

  it('navigates to payment screen when Continue is pressed', () => {
    setupMocks();
    render(<ExtrasScreen />);
    fireEvent.press(screen.getByText('Continue to Payment'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/booking/payment',
      params: { productId: 'product-1', sessionId: 'session-1' },
    });
  });

  it('navigates to payment screen when Skip is pressed', () => {
    setupMocks();
    render(<ExtrasScreen />);
    fireEvent.press(screen.getByText('Skip extras'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/booking/payment',
      params: { productId: 'product-1', sessionId: 'session-1' },
    });
  });
});
