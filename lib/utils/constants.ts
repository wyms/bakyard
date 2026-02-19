import type { MembershipTier } from '@/lib/types/database';

// ----- Color Palette -----

export const COLORS = {
  PRIMARY: '#D4A574',
  SECONDARY: '#1A5E63',
  BACKGROUND: '#FAFAF8',
  TEXT: '#2D2D2D',
  SUCCESS: '#4CAF50',
  ACCENT: '#FF6B6B',
  WHITE: '#FFFFFF',
  BORDER: '#E8E5E0',
  TEXT_SECONDARY: '#7A7A7A',
} as const;

// ----- Membership Tiers -----

export interface MembershipTierConfig {
  tier: MembershipTier;
  name: string;
  price_cents: number;
  interval: 'month';
  discount_percent: number;
  priority_hours: number;
  benefits: string[];
}

export const MEMBERSHIP_TIERS: MembershipTierConfig[] = [
  {
    tier: 'local_player',
    name: 'Local Player',
    price_cents: 4900,
    interval: 'month',
    discount_percent: 10,
    priority_hours: 12,
    benefits: [
      '10% off all bookings',
      '12-hour early booking window',
      'Member badge on profile',
    ],
  },
  {
    tier: 'sand_regular',
    name: 'Sand Regular',
    price_cents: 9900,
    interval: 'month',
    discount_percent: 20,
    priority_hours: 24,
    benefits: [
      '20% off all bookings',
      '24-hour early booking window',
      '1 free guest pass per month',
      'Member badge on profile',
    ],
  },
  {
    tier: 'founders',
    name: 'Founders Circle',
    price_cents: 19900,
    interval: 'month',
    discount_percent: 30,
    priority_hours: 48,
    benefits: [
      '30% off all bookings',
      '48-hour early booking window',
      'Unlimited guest passes',
      'Invite-only events access',
      'Premium member badge',
      'Priority customer support',
    ],
  },
];
