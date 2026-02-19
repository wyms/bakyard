# BAKYARD — Requirements & Implementation Plan

## Context

Bakyard is a marketplace-style booking app for a single beach volleyball venue. Modeled after Uber Eats / streaming service UIs — a discovery feed of bookable experiences (court rentals, open play, coaching, events) with frictionless payments and membership tiers. The goal is predictable recurring revenue through memberships and easy repeat bookings.

**Tech Stack:** React Native (Expo) + Supabase + Stripe
**Scope:** Single venue, beach volleyball only, MVP focus

---

## 1. Database Schema

### Core Tables

```
users
├── id (uuid, PK, references auth.users)
├── full_name (text)
├── phone (text)
├── avatar_url (text)
├── skill_level (enum: beginner, intermediate, advanced, pro)
├── role (enum: player, coach, admin)
├── stripe_customer_id (text)
├── push_token (text)
├── created_at / updated_at

courts
├── id (uuid, PK)
├── name (text) — e.g. "Court 1", "Court 2"
├── surface_type (text) — "sand"
├── is_available (boolean) — admin toggle
├── sort_order (int)

products
├── id (uuid, PK)
├── type (enum: court_rental, open_play, coaching, clinic, tournament, community_day, food_addon)
├── title (text)
├── description (text)
├── image_url (text)
├── base_price_cents (int)
├── capacity (int, nullable) — null = unlimited
├── duration_minutes (int)
├── tags (text[]) — ["beginner", "competitive", "kids", etc.]
├── coach_id (uuid, FK → users, nullable)
├── is_recurring (boolean)
├── recurrence_rule (jsonb, nullable) — iCal RRULE format
├── is_active (boolean)
├── created_at / updated_at

sessions
├── id (uuid, PK)
├── product_id (uuid, FK → products)
├── court_id (uuid, FK → courts, nullable)
├── starts_at (timestamptz)
├── ends_at (timestamptz)
├── price_cents (int) — actual price (may differ from base via dynamic pricing)
├── spots_total (int)
├── spots_remaining (int)
├── status (enum: open, full, in_progress, completed, cancelled)
├── weather_snapshot (jsonb, nullable)
├── created_at / updated_at
├── EXCLUDE USING gist (court_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
   — prevents double-booking at the database level

bookings
├── id (uuid, PK)
├── session_id (uuid, FK → sessions)
├── user_id (uuid, FK → users)
├── status (enum: reserved, confirmed, cancelled, no_show)
├── reserved_at (timestamptz) — for timeout-based release
├── confirmed_at (timestamptz)
├── cancelled_at (timestamptz)
├── guests (int, default 0)
├── UNIQUE(session_id, user_id)

orders
├── id (uuid, PK)
├── booking_id (uuid, FK → bookings)
├── user_id (uuid, FK → users)
├── amount_cents (int)
├── discount_cents (int, default 0)
├── membership_id (uuid, FK → memberships, nullable)
├── stripe_payment_intent_id (text)
├── status (enum: pending, paid, refunded, failed)
├── is_split (boolean, default false)
├── split_group_id (uuid, nullable) — groups split orders together
├── created_at

memberships
├── id (uuid, PK)
├── user_id (uuid, FK → users)
├── tier (enum: local_player, sand_regular, founders)
├── stripe_subscription_id (text)
├── status (enum: active, past_due, cancelled)
├── discount_percent (int) — 10, 15, 25 by tier
├── priority_booking_hours (int) — early access window
├── guest_passes_remaining (int)
├── current_period_start (timestamptz)
├── current_period_end (timestamptz)
├── created_at

coach_profiles
├── id (uuid, PK)
├── user_id (uuid, FK → users, UNIQUE)
├── bio (text)
├── certifications (text[])
├── hourly_rate_cents (int)
├── revenue_share_percent (int) — admin-configured
├── rating (numeric)
├── is_active (boolean)

session_chat_messages
├── id (uuid, PK)
├── session_id (uuid, FK → sessions)
├── user_id (uuid, FK → users)
├── message (text)
├── created_at

feed_interactions
├── id (uuid, PK)
├── user_id (uuid, FK → users)
├── product_id (uuid, FK → products)
├── interaction_type (enum: view, tap, book, dismiss)
├── created_at
— Used for recommendation engine / feed personalization

pricing_rules
├── id (uuid, PK)
├── name (text)
├── rule_type (enum: peak, off_peak, weekend, holiday, surge)
├── multiplier (numeric) — e.g. 1.5 = 50% markup
├── days_of_week (int[]) — 0=Sun, 6=Sat
├── start_time (time)
├── end_time (time)
├── is_active (boolean)

notifications
├── id (uuid, PK)
├── user_id (uuid, FK → users)
├── title (text)
├── body (text)
├── type (enum: booking_confirm, payment_reminder, session_update, membership, promo)
├── data (jsonb) — deep link params
├── is_read (boolean, default false)
├── created_at
```

### Key Relationships
- **Products** are templates; **Sessions** are concrete time-slotted instances
- Each Session belongs to one Product and optionally one Court
- Bookings link Users to Sessions; Orders link to Bookings for payment tracking
- The GiST exclusion constraint on `sessions` prevents court double-booking at the DB level

---

## 2. Supabase Architecture

### Auth Strategy
- **Email/password** for MVP (Supabase Auth)
- **Apple Sign-In** added in Phase 2 (required for App Store)
- **Google Sign-In** added in Phase 2
- JWT claims extended with custom `role` claim via auth hook

### Row Level Security (RLS)
Every table has RLS enabled. Key policies:
- **users**: read own profile + public fields of others; update own only
- **products/sessions**: read by all authenticated; write by admin/coach (owner)
- **bookings**: read/create own; admin reads all
- **orders**: read own; admin reads all
- **memberships**: read own; admin reads/writes all
- **session_chat_messages**: read/write if user has booking for that session
- Helper functions: `is_admin()`, `is_coach()`, `is_session_participant(session_id)`

### Edge Functions (Deno)
| Function | Purpose |
|---|---|
| `create-checkout` | Reserve spots, create Stripe PaymentIntent, return client secret |
| `stripe-webhook` | Handle payment confirmations, subscription events |
| `create-subscription` | Create Stripe subscription for membership tier |
| `cancel-booking` | Cancel + refund logic with policy checks |
| `split-payment` | Generate individual payment links for group |
| `generate-feed` | Personalized feed with pricing rules applied |
| `sync-weather` | Fetch weather data, update session snapshots |
| `release-expired` | Cron: release unpaid reservations after 10min timeout |
| `send-notification` | Push notification dispatch |
| `admin-reports` | Revenue/booking analytics queries |

### Realtime Subscriptions
- `sessions` table: spot count changes (live availability)
- `bookings` filtered by session: roster updates in Session Hub
- `session_chat_messages` filtered by session: live chat
- `notifications` filtered by user: push notification badge

### Storage Buckets
- `avatars` — user profile photos
- `product-images` — product card images
- `coach-media` — coach profile photos

### Database Triggers
- On booking insert → decrement `sessions.spots_remaining`
- On booking cancel → increment `sessions.spots_remaining`
- On order status → update booking status
- On feed interaction → log for recommendations

### Cron Jobs (pg_cron)
- Every 5 min: release expired reservations (`reserved_at` > 10 min, status still `reserved`)
- Every 30 min: sync weather for today's sessions
- Daily: mark past sessions as `completed`

---

## 3. React Native App Structure

### Project Layout
```
bakyard/
├── app/                          # Expo Router file-based routing
│   ├── _layout.tsx               # Root layout (providers, fonts)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab navigator
│   │   ├── index.tsx             # Feed tab
│   │   ├── sessions.tsx          # My Sessions tab
│   │   ├── membership.tsx        # Membership tab
│   │   └── profile.tsx           # Profile tab
│   ├── product/[id].tsx          # Product detail
│   ├── session/[id].tsx          # Session Hub
│   ├── booking/
│   │   ├── select-time.tsx
│   │   ├── confirm.tsx
│   │   ├── extras.tsx
│   │   └── payment.tsx
│   ├── coach/[id].tsx            # Coach profile
│   └── notifications.tsx
├── components/
│   ├── ui/                       # Design system primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── BottomSheet.tsx
│   │   ├── Chip.tsx
│   │   └── Skeleton.tsx
│   ├── feed/
│   │   ├── ProductCard.tsx       # Main feed card component
│   │   ├── FilterBar.tsx         # Horizontal filter chips
│   │   └── FeedList.tsx
│   ├── booking/
│   │   ├── TimeSlotPicker.tsx
│   │   ├── CapacityIndicator.tsx
│   │   └── PriceSummary.tsx
│   ├── session/
│   │   ├── Roster.tsx
│   │   ├── WeatherBadge.tsx
│   │   ├── ChatThread.tsx
│   │   └── InviteLink.tsx
│   └── membership/
│       ├── TierCard.tsx
│       └── BenefitsList.tsx
├── lib/
│   ├── supabase.ts               # Supabase client init
│   ├── stripe.ts                 # Stripe provider setup
│   ├── api/                      # API layer (edge function calls)
│   │   ├── bookings.ts
│   │   ├── feed.ts
│   │   ├── payments.ts
│   │   └── memberships.ts
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useFeed.ts
│   │   ├── useSession.ts
│   │   ├── useBooking.ts
│   │   └── useRealtime.ts
│   ├── stores/                   # Zustand stores (client state)
│   │   ├── authStore.ts
│   │   ├── bookingStore.ts
│   │   └── filterStore.ts
│   └── utils/
│       ├── pricing.ts            # Price formatting, discount calc
│       ├── dates.ts              # Date/time helpers
│       └── constants.ts
├── assets/
│   ├── fonts/
│   └── images/
├── supabase/
│   ├── migrations/               # SQL migration files
│   ├── functions/                # Edge functions source
│   │   ├── create-checkout/
│   │   ├── stripe-webhook/
│   │   ├── create-subscription/
│   │   └── ...
│   └── seed.sql                  # Development seed data
├── app.json                      # Expo config
├── tsconfig.json
├── package.json
└── .env.local                    # SUPABASE_URL, SUPABASE_ANON_KEY, STRIPE_PK
```

### Key Libraries
| Library | Purpose |
|---|---|
| `expo-router` | File-based navigation |
| `@supabase/supabase-js` | Supabase client |
| `@stripe/stripe-react-native` | Stripe PaymentSheet + Apple Pay |
| `@tanstack/react-query` | Server state management, caching |
| `zustand` | Lightweight client state |
| `react-native-reanimated` | Smooth animations |
| `@gorhom/bottom-sheet` | Bottom sheets for booking flow |
| `expo-secure-store` | Secure token storage |
| `expo-notifications` | Push notifications |
| `expo-linking` | Deep links / invite links |
| `date-fns` | Date formatting |
| `nativewind` | Tailwind CSS for React Native |

### State Management
- **Server state** (feed, sessions, bookings): TanStack Query with Supabase realtime invalidation
- **Client state** (filters, booking draft, auth): Zustand stores
- **No Redux** — too heavy for this scope

---

## 4. Stripe Integration

### One-Time Payments (Court Rentals, Open Play, etc.)
1. User taps "Book" → app calls `create-checkout` edge function
2. Edge function: reserves spots (DB), creates Stripe PaymentIntent, returns `clientSecret`
3. App presents Stripe PaymentSheet (handles card + Apple Pay)
4. On success → Stripe webhook confirms → booking status → `confirmed`
5. On failure/abandon → cron releases reservation after 10 min

### Memberships (Subscriptions)
1. User selects tier → app calls `create-subscription` edge function
2. Edge function creates Stripe Customer (if needed) + Subscription
3. Returns `clientSecret` for initial payment
4. Webhook handles: `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Membership record synced on each webhook event

### Split Payments
1. Host books session → selects "Split with group"
2. Edge function creates one order per player with individual PaymentIntents
3. Share links sent via invite system
4. Each player pays individually; roster shows payment status in real-time
5. Unpaid players get auto-reminders (24h, 2h before session)

### Membership Discounts
- Applied server-side in `create-checkout` edge function
- Lookup user's active membership → apply `discount_percent` to `amount_cents`
- Discount recorded on order for audit trail

---

## 5. Concurrency & Double-Booking Prevention

Four layers of defense:

1. **DB Constraint** — GiST exclusion on `sessions(court_id, tstzrange(starts_at, ends_at))` prevents overlapping sessions on the same court
2. **Row Locking** — `SELECT ... FOR UPDATE` on session row during booking to serialize concurrent requests
3. **Atomic Function** — `book_session()` Postgres function: lock → check spots → decrement → insert booking in one transaction
4. **Reservation Timeout** — Unpaid reservations auto-released after 10 minutes via cron

---

## 6. Admin Console

**Separate web app** using React + Vite + Tailwind + shadcn/ui, sharing the same Supabase project.

Located in `admin/` directory within the monorepo. Connects to the same Supabase instance with admin-level RLS policies (checked via `users.role = 'admin'`).

### Admin Screens
- **Dashboard** — Today's revenue, bookings, court status at a glance
- **Products** — CRUD products, set pricing, toggle active/inactive
- **Sessions** — View/create sessions, manage capacity, assign courts
- **Courts** — Toggle availability, view schedule grid
- **Orders** — View all orders, process refunds
- **Memberships** — View members, manage tiers, cancel/comp memberships
- **Pricing Rules** — Create/edit dynamic pricing rules
- **Reports** — Revenue by period, popular products, member retention

---

## 7. Build Phases

### Phase 1: Foundation (Week 1)
- [ ] Initialize Expo project with TypeScript + NativeWind
- [ ] Set up Supabase project (tables, RLS, auth)
- [ ] Write all SQL migrations
- [ ] Set up Supabase client in React Native
- [ ] Implement auth flow (register, login, forgot password)
- [ ] Build tab navigation skeleton
- [ ] Create design system primitives (Button, Card, Badge, Chip, Skeleton)
- **Deliverable:** User can register, log in, see empty tab screens

### Phase 2: Feed & Discovery (Week 2)
- [ ] Build `ProductCard` component (matches Uber Eats card style)
- [ ] Build `FilterBar` with horizontal scrolling chips
- [ ] Implement `generate-feed` edge function with pricing rules
- [ ] Build feed screen with pull-to-refresh + infinite scroll
- [ ] Product detail screen with time slots
- [ ] Seed database with sample products/sessions
- **Deliverable:** User can browse feed, filter, tap into product details

### Phase 3: Booking & Payments (Week 2-3)
- [ ] Build booking flow screens (select time → confirm → extras → pay)
- [ ] Implement `create-checkout` edge function
- [ ] Integrate Stripe PaymentSheet + Apple Pay
- [ ] Implement `stripe-webhook` edge function
- [ ] Build `book_session()` Postgres function with row locking
- [ ] Implement reservation timeout cron
- [ ] Build "My Sessions" tab with upcoming/past sections
- **Deliverable:** User can book and pay for a session end-to-end

### Phase 4: Session Hub (Week 3)
- [ ] Build Session Hub screen (roster, weather, chat, map link)
- [ ] Implement realtime subscriptions (roster updates, chat)
- [ ] Weather integration (edge function + display)
- [ ] Invite link generation and sharing
- [ ] Push notification setup (booking confirmation, reminders)
- **Deliverable:** After booking, user lands in a live session hub

### Phase 5: Memberships (Week 3-4)
- [ ] Build membership tab with tier cards and benefits
- [ ] Implement `create-subscription` edge function
- [ ] Stripe subscription webhook handling
- [ ] Auto-discount application in checkout
- [ ] Membership badge on profile
- [ ] Priority booking window logic
- **Deliverable:** User can subscribe, see discount at checkout

### Phase 6: Split Payments & Polish (Week 4)
- [ ] Implement split payment edge function
- [ ] Build split payment UI (host selects players, shares link)
- [ ] Auto-reminder notifications for unpaid splits
- [ ] Cancellation flow with refund logic
- [ ] Profile screen (edit info, payment methods, history)
- **Deliverable:** Group booking with split pay works end-to-end

### Phase 7: Coach Portal & Admin Console (Week 5)
- [ ] Coach profile and session creation in mobile app
- [ ] Initialize admin web app (React + Vite + shadcn/ui)
- [ ] Admin dashboard, product CRUD, court management
- [ ] Order management with refunds
- [ ] Revenue reporting
- **Deliverable:** Coaches can create sessions; admins manage everything via web

### Phase 8: AI & Optimization (Week 6)
- [ ] Feed ranking based on `feed_interactions` data
- [ ] Personalized recommendations (collaborative filtering)
- [ ] Smart notification timing
- [ ] Admin pricing insights
- [ ] Final QA, performance optimization, beta prep
- **Deliverable:** Personalized feed, beta-ready app

---

## 8. Design Guidelines

- **UI Tone:** Minimal, warm, premium. Think sand/earth tones with clean whites.
- **Typography:** Single font family, clear hierarchy (bold titles, regular body)
- **Cards:** Rounded corners, subtle shadows, hero image on product cards
- **Animations:** Smooth transitions between screens, skeleton loaders, haptic feedback on booking confirmation
- **Color Palette (suggested):**
  - Primary: warm sand (#D4A574)
  - Secondary: deep teal (#1A5E63)
  - Background: off-white (#FAFAF8)
  - Text: charcoal (#2D2D2D)
  - Success: green (#4CAF50)
  - Accent: coral (#FF6B6B)

---

## 9. Verification & Testing Plan

### Manual Testing Flow
1. Register new account → verify lands on feed
2. Browse feed → apply filters → verify cards update
3. Tap product → select time → book → pay with test card → verify Session Hub
4. Check "My Sessions" → verify booking appears
5. Subscribe to membership → verify discount on next checkout
6. Test split payment flow with 2 accounts
7. Admin: create product → verify appears in feed
8. Coach: create session → verify bookable

### Automated Testing
- **Unit tests:** Pricing calculations, date utilities, discount logic (Jest)
- **Edge function tests:** Mock Supabase client, test booking logic
- **E2E tests:** Detox or Maestro for critical booking + payment flow

### Stripe Testing
- Use Stripe test mode throughout development
- Test cards: `4242424242424242` (success), `4000000000000002` (decline)
- Test webhooks via Stripe CLI: `stripe listen --forward-to`

---

## 10. Environment Variables

```
# .env.local (mobile app)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Supabase Edge Function secrets
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
WEATHER_API_KEY=
```
