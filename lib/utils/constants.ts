import type { MembershipTier } from '@/lib/types/database';

// ----- Color Palette -----

export const COLORS = {
  PRIMARY: '#3F6F6A',
  SECONDARY: '#D6B07A',
  BACKGROUND: '#F6F1EA',
  SURFACE: '#FBF7F2',
  TEXT: '#111827',
  SUCCESS: '#3F6F6A',
  ACCENT: '#D6B07A',
  ERROR: '#FF6B6B',
  WHITE: '#FFFFFF',
  BORDER: 'rgba(17,24,39,0.08)',
  TEXT_SECONDARY: '#6B7280',
  MUTED: '#6B7280',
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
