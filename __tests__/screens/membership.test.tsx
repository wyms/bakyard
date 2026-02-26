import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import MembershipScreen from '@/app/(tabs)/membership';

// ─── Module mocks ─────────────────────────────────────────────────────────

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/utils/pricing', () => ({
  formatPrice: (cents: number) => `$${(cents / 100).toFixed(2)}`,
}));

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

jest.mock('@/components/ui/Badge', () => {
  const { Text } = require('react-native');
  return ({ label }: { label: string }) => <Text>{label}</Text>;
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

// ─── Price constants ───────────────────────────────────────────────────────
// Computed from PRD_PLANS data + formatPrice mock ($${(cents/100).toFixed(2)})

// Monthly prices
const DROPIN_MONTHLY  = '$20.00';   // 2000
const MEMBER_MONTHLY  = '$149.00';  // 14900
const ELITE_MONTHLY   = '$299.00';  // 29900

// Annual per-month prices: Math.round(price * 9.6 / 12)
// Drop-In:  Math.round(2000  * 9.6 / 12) = 1600   → $16.00
// Monthly:  Math.round(14900 * 9.6 / 12) = 11920  → $119.20
// Elite:    Math.round(29900 * 9.6 / 12) = 23920  → $239.20
const DROPIN_ANNUAL_PM = '$16.00';
const MEMBER_ANNUAL_PM = '$119.20';
const ELITE_ANNUAL_PM  = '$239.20';

// ─── Helpers ──────────────────────────────────────────────────────────────

const mockRouter = { push: jest.fn() };

function setup() {
  (useRouter as jest.Mock).mockReturnValue(mockRouter);
}

// Returns the Monthly and Annual toggle Pressables (always the first two
// onPress nodes in document order, before any plan card Pressables).
function getToggleButtons(renderResult: ReturnType<typeof render>) {
  const nodes = renderResult.UNSAFE_root.findAll(
    (node: { props: Record<string, unknown> }) => typeof node.props.onPress === 'function',
    { deep: true },
  );
  return { monthlyBtn: nodes[0], annualBtn: nodes[1] };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('MembershipScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Screen header ──────────────────────────────────────────────────────

  it('renders the "PLANS" heading', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.getByText('PLANS')).toBeTruthy();
  });

  it('renders the subtitle', () => {
    setup();
    render(<MembershipScreen />);
    expect(
      screen.getByText('Join the Bakyard community and save on every session.'),
    ).toBeTruthy();
  });

  // ── Billing toggle ─────────────────────────────────────────────────────

  it('renders the Monthly toggle button', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.getByText('Monthly')).toBeTruthy();
  });

  it('renders the Annual toggle button', () => {
    setup();
    render(<MembershipScreen />);
    // Annual toggle text contains "Annual"; use regex to match the Text node
    expect(screen.getByText(/Annual/)).toBeTruthy();
  });

  // ── Plan names ─────────────────────────────────────────────────────────

  it('renders all three plan names in uppercase', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.getByText('DROP-IN')).toBeTruthy();
    expect(screen.getByText('MONTHLY UNLIMITED')).toBeTruthy();
    expect(screen.getByText('ELITE TRAINING')).toBeTruthy();
  });

  // ── Plan descriptions ──────────────────────────────────────────────────

  it('renders each plan description', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.getByText('Pay as you go, no commitment')).toBeTruthy();
    expect(screen.getByText('Unlimited sessions, best value')).toBeTruthy();
    expect(screen.getByText('Everything + private training')).toBeTruthy();
  });

  // ── Monthly prices (default) ───────────────────────────────────────────

  it('shows monthly prices by default', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.getByText(DROPIN_MONTHLY)).toBeTruthy();
    expect(screen.getByText(MEMBER_MONTHLY)).toBeTruthy();
    expect(screen.getByText(ELITE_MONTHLY)).toBeTruthy();
  });

  it('shows "per session" label only on the Drop-In plan', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.getByText('per session')).toBeTruthy();
    expect(screen.getAllByText('per session')).toHaveLength(1);
  });

  it('does not show annual savings text in Monthly mode', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.queryByText(/Save 20% ·/)).toBeNull();
  });

  // ── Featured badge ─────────────────────────────────────────────────────

  it('shows "Most Popular" badge exactly once (on Monthly Unlimited)', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.getAllByText('Most Popular')).toHaveLength(1);
  });

  // ── CTA button labels ──────────────────────────────────────────────────

  it('shows "GET STARTED" on the featured Monthly Unlimited plan', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.getByText('GET STARTED')).toBeTruthy();
  });

  it('shows "Choose Plan" on each non-featured plan (Drop-In and Elite)', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.getAllByText('Choose Plan')).toHaveLength(2);
  });

  // ── Plan features ──────────────────────────────────────────────────────

  it('renders Drop-In features', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.getByText('Single open play session')).toBeTruthy();
    expect(screen.getByText('No commitment')).toBeTruthy();
    expect(screen.getByText('All skill levels welcome')).toBeTruthy();
  });

  it('renders Monthly Unlimited features', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.getByText('Unlimited open play sessions')).toBeTruthy();
    expect(screen.getByText('Priority booking window')).toBeTruthy();
    expect(screen.getByText('Cancel anytime')).toBeTruthy();
  });

  it('renders Elite Training features', () => {
    setup();
    render(<MembershipScreen />);
    expect(screen.getByText('4 private lessons per month')).toBeTruthy();
    expect(screen.getByText('Video analysis')).toBeTruthy();
  });

  // ── Annual toggle ──────────────────────────────────────────────────────

  it('switches to annual per-month prices after pressing Annual', () => {
    setup();
    const rendered = render(<MembershipScreen />);
    const { annualBtn } = getToggleButtons(rendered);
    fireEvent.press(annualBtn);
    expect(screen.getByText(DROPIN_ANNUAL_PM)).toBeTruthy();
    expect(screen.getByText(MEMBER_ANNUAL_PM)).toBeTruthy();
    expect(screen.getByText(ELITE_ANNUAL_PM)).toBeTruthy();
  });

  it('shows annual savings text on all three plan cards after switching to Annual', () => {
    setup();
    const rendered = render(<MembershipScreen />);
    const { annualBtn } = getToggleButtons(rendered);
    fireEvent.press(annualBtn);
    expect(screen.getAllByText(/Save 20% ·/)).toHaveLength(3);
  });

  it('hides monthly prices after switching to Annual', () => {
    setup();
    const rendered = render(<MembershipScreen />);
    const { annualBtn } = getToggleButtons(rendered);
    fireEvent.press(annualBtn);
    expect(screen.queryByText(DROPIN_MONTHLY)).toBeNull();
    expect(screen.queryByText(MEMBER_MONTHLY)).toBeNull();
    expect(screen.queryByText(ELITE_MONTHLY)).toBeNull();
  });

  it('restores monthly prices after toggling back to Monthly', () => {
    setup();
    const rendered = render(<MembershipScreen />);
    const { monthlyBtn, annualBtn } = getToggleButtons(rendered);
    fireEvent.press(annualBtn);
    fireEvent.press(monthlyBtn);
    expect(screen.getByText(DROPIN_MONTHLY)).toBeTruthy();
    expect(screen.getByText(MEMBER_MONTHLY)).toBeTruthy();
    expect(screen.getByText(ELITE_MONTHLY)).toBeTruthy();
  });

  it('hides annual savings text after toggling back to Monthly', () => {
    setup();
    const rendered = render(<MembershipScreen />);
    const { monthlyBtn, annualBtn } = getToggleButtons(rendered);
    fireEvent.press(annualBtn);
    fireEvent.press(monthlyBtn);
    expect(screen.queryByText(/Save 20% ·/)).toBeNull();
  });

  // ── Navigation ─────────────────────────────────────────────────────────

  it('navigates to /(tabs)/book with plan=monthly when GET STARTED is pressed', () => {
    setup();
    render(<MembershipScreen />);
    fireEvent.press(screen.getByText('GET STARTED'));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/book',
      params: { plan: 'monthly' },
    });
  });

  it('navigates to /(tabs)/book with plan=drop_in when Drop-In Choose Plan is pressed', () => {
    setup();
    render(<MembershipScreen />);
    fireEvent.press(screen.getAllByText('Choose Plan')[0]); // Drop-In is first
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/book',
      params: { plan: 'drop_in' },
    });
  });

  it('navigates to /(tabs)/book with plan=elite when Elite Choose Plan is pressed', () => {
    setup();
    render(<MembershipScreen />);
    fireEvent.press(screen.getAllByText('Choose Plan')[1]); // Elite is second
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/(tabs)/book',
      params: { plan: 'elite' },
    });
  });
});
