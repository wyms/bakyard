# Bakyard — Project Status

**Last updated:** February 18, 2026

## Overview

Bakyard is a marketplace-style booking app for a single beach volleyball venue. It follows an Uber Eats / streaming service UI model — a discovery feed of bookable experiences (court rentals, open play, coaching, events) with frictionless payments and membership tiers.

**Tech Stack:** React Native (Expo SDK 54) + Supabase + Stripe + NativeWind v4

---

## Current State (Resume From Here)

**All code written. 522 tests pass. Backend deployed to Supabase. App runs locally on web.**

### What's live:
- Supabase database — 12 tables, RLS policies, triggers, cron jobs
- Supabase seed data — 9 products, 4 courts, 22 sessions, 4 pricing rules
- 9 edge functions deployed and running
- App runs locally via `npx expo start --web --clear` at `http://localhost:8081`

### What still needs setup:
1. **Stripe integration** — API keys not yet configured (see "Remaining Setup" below)
2. **Weather API** — key not yet configured
3. **App deployment** — currently local-only (not hosted anywhere)

### To run the app right now:
```bash
npm install          # if fresh clone
npx expo start --web --clear
```

---

## Build Progress

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation (auth, navigation, design system) | Complete |
| 2 | Feed & Discovery | Complete |
| 3 | Booking & Payments | Complete |
| 4 | Session Hub | Complete |
| 5 | Memberships | Complete |
| 6 | Split Payments & Polish | Complete |
| 7 | Coach Portal & Admin Console | Complete |
| 8 | AI Feed Ranking & Smart Notifications | Complete |
| — | Testing (522 tests) | Complete |
| — | Web compatibility fixes | Complete |
| — | Database deployment to Supabase | Complete |
| — | Edge function deployment | Complete |
| — | Seed data loaded | Complete |

---

## Supabase Backend (LIVE)

**Project ref:** `vujgrceogdfdzxwprqwj`
**URL:** `https://vujgrceogdfdzxwprqwj.supabase.co`
**Credentials:** `b1.md` (gitignored — contains DB password, anon key, secret key, access token)

### Database (deployed Feb 18, 2026)

**4 migrations applied:**

| Migration | Contents |
|-----------|----------|
| `20240101000000_initial_schema.sql` | 12 tables, enums, GiST exclusion constraint for court double-booking |
| `20240101000001_rls_policies.sql` | Row Level Security policies for all tables |
| `20240101000002_functions_triggers.sql` | `book_session()` atomic function, triggers for spot counts and order status |
| `20240101000003_cron_jobs.sql` | Reservation timeout (5 min), weather sync (30 min), session completion (daily) |

**Seed data loaded:**

| Data | Count |
|------|-------|
| Courts | 4 (3 active, 1 maintenance) |
| Products | 9 (court rental, open play, clinics, coaching, tournament, community day, food add-on) |
| Sessions | 22 (spread across next 7 days, all open) |
| Pricing rules | 4 (peak, off-peak, weekend, holiday surge) |

### Edge Functions (deployed Feb 18, 2026)

| Function | Purpose | Needs Secrets |
|----------|---------|---------------|
| `create-checkout` | Reserve spots, create Stripe PaymentIntent | STRIPE_SECRET_KEY |
| `stripe-webhook` | Handle payment + subscription events | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET |
| `create-subscription` | Create Stripe subscription for membership tier | STRIPE_SECRET_KEY |
| `cancel-booking` | Cancel with tiered refund policy (100%/50%/0%) | STRIPE_SECRET_KEY |
| `split-payment` | Generate individual payment links for group | STRIPE_SECRET_KEY |
| `generate-feed` | AI-ranked feed with 7 scoring signals | None |
| `smart-notifications` | 4 cron strategies (reminders, urgency, re-engagement, upsell) | None |
| `sync-weather` | Fetch OpenWeatherMap data for today's sessions | WEATHER_API_KEY |
| `send-notification` | Expo push notification dispatch | None |

---

## Mobile App (React Native / Expo)

**19 screens:**

| Screen | File | Description |
|--------|------|-------------|
| Login | `app/(auth)/login.tsx` | Email/password auth |
| Register | `app/(auth)/register.tsx` | Sign up with skill level picker |
| Forgot Password | `app/(auth)/forgot-password.tsx` | Password reset via email |
| Feed | `app/(tabs)/index.tsx` | Personalized product feed with filters, court status, categories |
| My Sessions | `app/(tabs)/sessions.tsx` | Upcoming/past bookings with SectionList |
| Membership | `app/(tabs)/membership.tsx` | Tier cards, active membership management |
| Profile | `app/(tabs)/profile.tsx` | User info, stats, settings, sign out |
| Product Detail | `app/product/[id].tsx` | Hero image, time slots, coach info, book CTA |
| Select Time | `app/booking/select-time.tsx` | Day/time picker, court picker |
| Confirm | `app/booking/confirm.tsx` | Guest count, price summary, extras |
| Extras | `app/booking/extras.tsx` | Food/drink add-ons with quantity selectors |
| Payment | `app/booking/payment.tsx` | Stripe PaymentSheet, Apple Pay, simulate mode |
| Session Hub | `app/session/[id].tsx` | Roster, weather, chat, invite, payment status |
| Coach Profile | `app/coach/[id].tsx` | Bio, certifications, stats, upcoming sessions |
| Notifications | `app/notifications.tsx` | Notification list with read/unread states |
| Not Found | `app/+not-found.tsx` | 404 screen |
| Root Layout | `app/_layout.tsx` | Providers, auth guard, stack navigator |
| Auth Layout | `app/(auth)/_layout.tsx` | Auth group stack |
| Tab Layout | `app/(tabs)/_layout.tsx` | 4-tab navigator |

**30 components:**

| Category | Components |
|----------|-----------|
| UI Primitives | Button, Card, Badge, Chip, Skeleton, BottomSheet, Input, Avatar |
| Feed | ProductCard, FilterBar, FeedList, CategoryButton, CourtStatusCard |
| Booking | TimeSlotPicker, CourtPicker, CapacityIndicator, PriceSummary |
| Session | Roster, WeatherBadge, ChatThread, InviteLink, CountdownBadge |
| Membership | TierCard, BenefitsList, ActiveMembershipCard |
| Payment | SplitPaymentSheet |
| Legacy | ExternalLink, Themed, EditScreenInfo, StyledText |

### Lib Layer (20+ files)

| Category | Files | Purpose |
|----------|-------|---------|
| API | `feed.ts`, `bookings.ts`, `payments.ts`, `memberships.ts`, `coaches.ts` | Supabase queries + edge function calls |
| Hooks | `useAuth.ts`, `useFeed.ts`, `useSession.ts`, `useBooking.ts`, `useRealtime.ts`, `useNotifications.ts` | React hooks wrapping API + state |
| Stores | `authStore.ts`, `bookingStore.ts`, `filterStore.ts` | Zustand client state |
| Utils | `pricing.ts`, `dates.ts`, `constants.ts` | Pure utility functions |
| Clients | `supabase.ts`, `stripe.ts`, `stripe-shim.web.js` | SDK initialization + web shim |
| Types | `database.ts` | Full TypeScript schema (303 lines) |

---

## Admin Console (React + Vite)

Located in `admin/` directory — 28 files, separate web app sharing the same Supabase project.

**9 pages:**

| Page | Features |
|------|----------|
| Login | Admin-only auth with role check |
| Dashboard | Revenue stats, charts (Recharts), today's sessions, recent bookings |
| Products | CRUD table, create/edit modal, active toggle |
| Sessions | Filterable table, date/product/status filters, detail view with bookings |
| Courts | Card grid with schedule blocks, availability toggle |
| Orders | Searchable table, status filters, refund button with confirmation |
| Memberships | Member list, tier/status filters, upgrade/cancel actions |
| Pricing | Dynamic pricing rules with day/time targeting, live price preview |
| Reports | Revenue charts, bookings by type, popular time slots, top products |

**Shared components:** Layout, Sidebar, AuthGuard, DataTable, Modal, FormField, StatCard

---

## Test Suite

**24 test suites, 522 tests — all passing**

| Category | Suites | Tests | Coverage |
|----------|--------|-------|----------|
| Utility functions | 3 | 48 | pricing, dates, constants |
| Zustand stores | 3 | 38 | bookingStore, filterStore, authStore |
| API layer | 4 | 41 | feed, bookings, payments, memberships |
| React hooks | 4 | 76 | useAuth, useFeed, useBooking, useRealtime |
| UI components | 5 | 90 | Button, Card, Badge, Chip, Skeleton |
| Edge function logic | 5 | 229 | generate-feed, create-checkout, cancel-booking, split-payment, stripe-webhook |

---

## Bugs Fixed

### Feb 17, 2026

| # | Bug | Fix | File |
|---|-----|-----|------|
| 1 | `react-native-url-polyfill/dist/polyfill` not found (v3 removed dist/) | Changed import to `/auto` | `lib/supabase.ts` |
| 2 | `@stripe/stripe-react-native` crashes web (native-only RN internals) | Added Metro resolver to shim on web | `metro.config.js`, `lib/stripe-shim.web.js` |
| 3 | `expo-secure-store` not available on web | Platform-specific storage: localStorage on web, SecureStore on native | `lib/supabase.ts` |
| 4 | `SecureStore.deleteItemAsync` → sync `deleteItem` (SDK 54) | Changed to sync method | `lib/supabase.ts` |
| 5 | generate-feed test dates wrong bracket (38 days vs 16 days) | Fixed test date | `__tests__/supabase/functions/generate-feed-logic.test.ts` |
| 6 | Pricing rules test using local time instead of UTC | Changed to UTC methods | `__tests__/supabase/functions/generate-feed-logic.test.ts` |
| 7 | Invalid Jest config key `setupFilesAfterSetup` | Removed invalid key | `jest.config.js` |

### Feb 18, 2026

| # | Bug | Fix | File |
|---|-----|-----|------|
| 8 | Missing `babel.config.js` — NativeWind styles not applied on web (unstyled/1990s look) | Created babel config with `nativewind/babel` preset and `jsxImportSource: "nativewind"` | `babel.config.js` |
| 9 | Seed data court overlap — Kids Camp and Weekend Tournament both on Court 2 day+6 | Moved tournament to Court 3 | `supabase/seed.sql` |

---

## Configuration

| File | Status |
|------|--------|
| `.env.local` (mobile) | Configured — Supabase URL + anon key |
| `admin/.env.local` | Configured — Supabase URL + anon key |
| `app.json` | Configured — Expo, Stripe plugin, notifications |
| `babel.config.js` | NativeWind JSX runtime + babel preset |
| `metro.config.js` | NativeWind + Stripe web shim resolver |
| `tailwind.config.js` | Custom palette (sand/teal/coral/charcoal/offwhite) |
| `jest.config.js` | jest-expo preset, module mapper, transform ignore patterns |
| `tsconfig.json` | Strict mode, `@/*` path alias |
| `.gitignore` | Excludes node_modules, .env files, b1.md credentials, supabase .temp |

---

## Remaining Setup

### Priority 1 — Stripe Integration
- [ ] Create Stripe account (or use existing) at https://stripe.com
- [ ] Get test-mode API keys from https://dashboard.stripe.com/test/apikeys
- [ ] Set edge function secrets:
  ```bash
  supabase secrets set STRIPE_SECRET_KEY=sk_test_...
  supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
  ```
- [ ] Add publishable key to `.env.local`:
  ```
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
  ```
- [ ] Create Stripe webhook endpoint pointing to:
  `https://vujgrceogdfdzxwprqwj.supabase.co/functions/v1/stripe-webhook`
- [ ] Create Stripe products/prices for the 3 membership tiers
- [ ] Configure Stripe price IDs as edge function secrets

### Priority 2 — Weather API
- [ ] Get free API key from https://openweathermap.org/api
- [ ] Set edge function secret:
  ```bash
  supabase secrets set WEATHER_API_KEY=...
  ```

### Priority 3 — App Deployment
- [ ] **Web:** `npx expo export --platform web` → deploy to Vercel/Netlify
- [ ] **iOS:** Configure EAS, build via `eas build --platform ios`, submit to TestFlight
- [ ] **Android:** Build via `eas build --platform android`, distribute APK or Play Store

### Priority 4 — Assets
- [ ] App icon (`assets/images/icon.png`)
- [ ] Splash screen (`assets/images/splash-icon.png`)
- [ ] Adaptive icon for Android (`assets/images/adaptive-icon.png`)
- [ ] Product images (currently using placeholder)

### Priority 5 — Future Enhancements
- [ ] Apple Sign-In / Google Sign-In (required for App Store)
- [ ] Install admin console dependencies (`cd admin && npm install`)
- [ ] E2E tests (Detox or Maestro)
- [ ] Performance profiling and optimization
- [ ] Error tracking (Sentry)

---

## How to Run

### Mobile App (Web)
```bash
npx expo start --web --clear
# Opens at http://localhost:8081
```

### Mobile App (Native)
```bash
npx expo start
# Press i for iOS Simulator, a for Android, or scan QR with Expo Go
```

### Admin Console
```bash
cd admin
npm install
npm run dev
# Opens at http://localhost:5173
```

### Tests
```bash
npm test              # Run all 522 tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

---

## Key Files

| Purpose | Path |
|---------|------|
| This status doc | `STATUS.md` |
| Testing report | `TESTING.md` |
| Requirements | `REQUIREMENTS.md` |
| Supabase credentials | `b1.md` (gitignored) |
| Design references | `d1.PNG` through `d4.PNG` |
| Database types | `lib/types/database.ts` |
| Supabase client | `lib/supabase.ts` |
| Babel config (NativeWind) | `babel.config.js` |
| Metro config (web shims) | `metro.config.js` |
| Root layout | `app/_layout.tsx` |
| Feed screen | `app/(tabs)/index.tsx` |
| Jest config | `jest.config.js` |
| Jest setup/mocks | `jest.setup.js` |
