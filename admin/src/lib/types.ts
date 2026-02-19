export type ProductType =
  | 'court_rental'
  | 'open_play'
  | 'coaching'
  | 'clinic'
  | 'tournament'
  | 'community_day'
  | 'food_addon';

export type SessionStatus = 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled';

export type BookingStatus = 'reserved' | 'confirmed' | 'cancelled' | 'no_show';

export type OrderStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export type MembershipTier = 'local_player' | 'sand_regular' | 'founders';

export type MembershipStatus = 'active' | 'past_due' | 'cancelled';

export type PricingRuleType = 'peak' | 'off_peak' | 'weekend' | 'holiday' | 'surge';

export interface Product {
  id: string;
  type: ProductType;
  title: string;
  description: string | null;
  image_url: string | null;
  base_price_cents: number | null;
  capacity: number | null;
  duration_minutes: number | null;
  tags: string[] | null;
  coach_id: string | null;
  is_recurring: boolean;
  recurrence_rule: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  product_id: string;
  court_id: string | null;
  starts_at: string;
  ends_at: string;
  price_cents: number;
  spots_total: number;
  spots_remaining: number;
  status: SessionStatus;
  weather_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  product?: Product;
  court?: Court;
}

export interface Court {
  id: string;
  name: string;
  surface_type: string;
  is_available: boolean;
  sort_order: number | null;
}

export interface Booking {
  id: string;
  session_id: string;
  user_id: string;
  status: BookingStatus;
  reserved_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  guests: number;
  session?: Session;
  user?: User;
}

export interface Order {
  id: string;
  booking_id: string;
  user_id: string;
  amount_cents: number;
  discount_cents: number;
  membership_id: string | null;
  stripe_payment_intent_id: string | null;
  status: OrderStatus;
  is_split: boolean;
  split_group_id: string | null;
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  tier: MembershipTier;
  stripe_subscription_id: string | null;
  status: MembershipStatus;
  discount_percent: number;
  priority_booking_hours: number;
  guest_passes_remaining: number;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  user?: User;
}

export interface User {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  skill_level: string | null;
  role: 'player' | 'coach' | 'admin';
  stripe_customer_id: string | null;
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface PricingRule {
  id: string;
  name: string;
  rule_type: PricingRuleType;
  multiplier: number;
  days_of_week: number[] | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
}

export interface CoachProfile {
  id: string;
  user_id: string;
  bio: string | null;
  certifications: string[] | null;
  hourly_rate_cents: number | null;
  revenue_share_percent: number | null;
  rating: number | null;
  is_active: boolean;
  user?: User;
}

// Utility types
export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}
