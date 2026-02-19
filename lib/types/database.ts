// Bakyard Database Types
// Mirrors the Supabase public schema exactly

// ----- Enums -----

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro';

export type UserRole = 'player' | 'coach' | 'admin';

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

export type InteractionType = 'view' | 'tap' | 'book' | 'dismiss';

export type PricingRuleType = 'peak' | 'off_peak' | 'weekend' | 'holiday' | 'surge';

export type NotificationType =
  | 'booking_confirm'
  | 'payment_reminder'
  | 'session_update'
  | 'membership'
  | 'promo';

// ----- Row Types -----

export interface User {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  skill_level: SkillLevel | null;
  role: UserRole;
  stripe_customer_id: string | null;
  push_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface Court {
  id: string;
  name: string;
  surface_type: string;
  is_available: boolean;
  sort_order: number | null;
}

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
  // Joined relations (optional, populated via queries)
  product?: Product;
  court?: Court;
  bookings?: Booking[];
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
  // Joined relations
  session?: Session;
  user?: User;
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

export interface CoachProfile {
  id: string;
  user_id: string;
  bio: string | null;
  certifications: string[] | null;
  hourly_rate_cents: number | null;
  revenue_share_percent: number | null;
  rating: number | null;
  is_active: boolean;
  // Joined
  user?: User;
}

export interface SessionChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  message: string;
  created_at: string;
}

export interface FeedInteraction {
  id: string;
  user_id: string;
  product_id: string;
  interaction_type: InteractionType;
  created_at: string;
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

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

// ----- Insert Types (omit server-generated fields) -----

export type UserInsert = Omit<User, 'created_at' | 'updated_at'>;
export type UserUpdate = Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>;

export type CourtInsert = Omit<Court, 'id'>;
export type CourtUpdate = Partial<Omit<Court, 'id'>>;

export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at'>;
export type ProductUpdate = Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>;

export type SessionInsert = Omit<Session, 'id' | 'created_at' | 'updated_at' | 'product' | 'court' | 'bookings'>;
export type SessionUpdate = Partial<Omit<Session, 'id' | 'created_at' | 'updated_at' | 'product' | 'court' | 'bookings'>>;

export type BookingInsert = Omit<Booking, 'id' | 'session' | 'user'>;
export type BookingUpdate = Partial<Omit<Booking, 'id' | 'session' | 'user'>>;

export type OrderInsert = Omit<Order, 'id' | 'created_at'>;

export type MembershipInsert = Omit<Membership, 'id' | 'created_at'>;
export type MembershipUpdate = Partial<Omit<Membership, 'id' | 'created_at'>>;

export type CoachProfileInsert = Omit<CoachProfile, 'id' | 'user'>;
export type CoachProfileUpdate = Partial<Omit<CoachProfile, 'id' | 'user'>>;

export type FeedInteractionInsert = Omit<FeedInteraction, 'id' | 'created_at'>;

export type NotificationInsert = Omit<Notification, 'id' | 'created_at'>;

// ----- Database Interface -----

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: UserInsert;
        Update: UserUpdate;
      };
      courts: {
        Row: Court;
        Insert: CourtInsert;
        Update: CourtUpdate;
      };
      products: {
        Row: Product;
        Insert: ProductInsert;
        Update: ProductUpdate;
      };
      sessions: {
        Row: Session;
        Insert: SessionInsert;
        Update: SessionUpdate;
      };
      bookings: {
        Row: Booking;
        Insert: BookingInsert;
        Update: BookingUpdate;
      };
      orders: {
        Row: Order;
        Insert: OrderInsert;
        Update: never;
      };
      memberships: {
        Row: Membership;
        Insert: MembershipInsert;
        Update: MembershipUpdate;
      };
      coach_profiles: {
        Row: CoachProfile;
        Insert: CoachProfileInsert;
        Update: CoachProfileUpdate;
      };
      session_chat_messages: {
        Row: SessionChatMessage;
        Insert: Omit<SessionChatMessage, 'id' | 'created_at'>;
        Update: never;
      };
      feed_interactions: {
        Row: FeedInteraction;
        Insert: FeedInteractionInsert;
        Update: never;
      };
      pricing_rules: {
        Row: PricingRule;
        Insert: Omit<PricingRule, 'id'>;
        Update: Partial<Omit<PricingRule, 'id'>>;
      };
      notifications: {
        Row: Notification;
        Insert: NotificationInsert;
        Update: Partial<Pick<Notification, 'is_read'>>;
      };
    };
    Enums: {
      skill_level: SkillLevel;
      user_role: UserRole;
      product_type: ProductType;
      session_status: SessionStatus;
      booking_status: BookingStatus;
      order_status: OrderStatus;
      membership_tier: MembershipTier;
      membership_status: MembershipStatus;
      interaction_type: InteractionType;
      pricing_rule_type: PricingRuleType;
      notification_type: NotificationType;
    };
  };
}
