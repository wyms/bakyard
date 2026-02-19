# Bakyard — Testing Report

**Date:** February 17, 2026
**Tested by:** Claude Code (automated)
**Platform:** macOS (Darwin 25.3.0) — Web via Expo

---

## 1. Unit Test Results

**All 522 tests passing across 24 test suites.**

```
Test Suites: 24 passed, 24 total
Tests:       522 passed, 522 total
Snapshots:   0 total
Time:        ~2.9s
```

### Test Breakdown

| Category | Suites | Tests | Status |
|----------|--------|-------|--------|
| Utility functions (pricing, dates, constants) | 3 | 48 | PASS |
| Zustand stores (booking, filter, auth) | 3 | 38 | PASS |
| API layer (feed, bookings, payments, memberships) | 4 | 41 | PASS |
| React hooks (useAuth, useFeed, useBooking, useRealtime) | 4 | 76 | PASS |
| UI components (Button, Card, Badge, Chip, Skeleton) | 5 | 90 | PASS |
| Edge function logic (generate-feed, create-checkout, cancel-booking, split-payment, stripe-webhook) | 5 | 229 | PASS |

---

## 2. Web App Rendering Tests

The Expo dev server was started with `npx expo start --web --clear` and all pages were tested via HTTP requests.

### 2a. Login Screen (`/(auth)/login`)

**HTTP Status:** 200 OK
**Response size:** ~59KB (fully rendered HTML)
**No static errors** (no `_expo-static-error` markers in HTML)

**Rendered content verified:**
- "BAKYARD" title text
- "Sign In" button
- "Email" input field
- "Password" input field
- "Forgot" password link
- "Register" link

**SSR Output (Server-Side Rendered HTML includes):**
```
BAKYARD, Bakyard, Sign In, Email, Password, Forgot, Register
```

### 2b. Register Screen (`/(auth)/register`)

**HTTP Status:** 200 OK

**Rendered content verified:**
- "Create Account" heading
- "Name" input field
- "Email" input field
- "Password" input field
- "Skill Level" selector
- "Beginner" option visible

**SSR Output:**
```
Create Account, Name, Email, Password, Skill Level, Beginner
```

### 2c. Forgot Password Screen (`/(auth)/forgot-password`)

**HTTP Status:** 200 OK

### 2d. Auth Guard Behavior

- Visiting root URL (`/`) correctly redirects to login screen (auth guard in `_layout.tsx` detects no session)
- The `BAKYARD` title appears on the root page, confirming the redirect to login works

---

## 3. Bugs Found & Fixed

### Bug 1: `react-native-url-polyfill` import path (CRITICAL)

**Error:**
```
Unable to resolve module react-native-url-polyfill/dist/polyfill
```

**Cause:** v3 of `react-native-url-polyfill` removed the `dist/` directory.

**Fix:** Changed import in `lib/supabase.ts`:
```diff
- import 'react-native-url-polyfill/dist/polyfill';
+ import 'react-native-url-polyfill/auto';
```

### Bug 2: `@stripe/stripe-react-native` crashing web bundle (CRITICAL)

**Error:**
```
Importing native-only module "react-native/Libraries/ReactPrivate/ReactNativePrivateInitializeCore" on web
```

**Cause:** The Stripe React Native SDK imports RN internals that don't exist on web. Metro bundler resolves the `require()` call statically even though it's inside a try/catch.

**Fix:** Added Metro resolver in `metro.config.js` to resolve `@stripe/stripe-react-native` to an empty shim (`lib/stripe-shim.web.js`) on web platform:
```js
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === '@stripe/stripe-react-native') {
    return {
      filePath: path.resolve(__dirname, 'lib/stripe-shim.web.js'),
      type: 'sourceFile',
    };
  }
  // ...
};
```

### Bug 3: `expo-secure-store` not available on web (CRITICAL)

**Error:**
```
TypeError: ExpoSecureStore.default.getValueWithKeySync is not a function
```

**Cause:** `expo-secure-store` is a native-only module — no web implementation exists. The Supabase client was using it for auth token storage on all platforms.

**Fix:** Updated `lib/supabase.ts` to use platform-specific storage:
- **Web:** `localStorage`
- **Native (iOS/Android):** `expo-secure-store`

```typescript
if (Platform.OS === 'web') {
  storage = { /* localStorage adapter */ };
} else {
  const SecureStore = require('expo-secure-store');
  storage = { /* SecureStore adapter */ };
}
```

### Bug 4: `SecureStore.deleteItemAsync` → `deleteItem` (MINOR)

**Cause:** expo-secure-store SDK 54 uses sync `deleteItem()`, not async `deleteItemAsync()`.

**Fix:** Changed to `SecureStore.deleteItem(key)` in the storage adapter.

### Bug 5: generate-feed test time decay dates (TEST-ONLY)

**Cause:** Test used a date 38 days in the past (decay bracket = 0.2) but asserted decay = 0.5.

**Fix:** Changed test date from `2026-01-10` to `2026-02-01` (16 days, correct 0.5 bracket).

### Bug 6: Pricing rules using local time instead of UTC (TEST-ONLY)

**Cause:** `applyPricingRules` test helper used `getDay()` and `toTimeString()` (local timezone) but test dates were UTC.

**Fix:** Changed to `getUTCDay()`, `getUTCHours()`, `getUTCMinutes()`.

### Bug 7: Invalid Jest config key (CONFIG)

**Cause:** `setupFilesAfterSetup` is not a valid Jest config key (correct key is `setupFilesAfterSetup`).

**Fix:** Removed the invalid key.

---

## 4. Configuration Verified

| Config | Status |
|--------|--------|
| `.env.local` — Supabase URL + anon key | Configured, loaded by Expo |
| `admin/.env.local` — Vite Supabase keys | Configured |
| `metro.config.js` — NativeWind + Stripe web shim | Configured |
| `jest.config.js` — All tests passing | Configured |
| `jest.setup.js` — All mocks working | Configured |

---

## 5. What Remains Untestable (No DB Setup Yet)

The Supabase database tables have not been created yet. Once migrations are pushed, the following should work:

- [ ] **Feed screen** — Will show products from the database
- [ ] **Booking flow** — End-to-end: select time → confirm → pay
- [ ] **Session Hub** — Roster, weather, chat (requires realtime subscription)
- [ ] **Membership** — Tier subscription flow
- [ ] **Profile** — User data display/edit
- [ ] **My Sessions** — Upcoming/past bookings list

### To enable full testing:
```bash
# Push database migrations
supabase db push

# Run seed data
supabase db seed

# Deploy edge functions
supabase functions deploy
```

---

## 6. Summary

| Area | Result |
|------|--------|
| Unit tests | 522/522 PASS |
| Web server starts | YES (HTTP 200) |
| Login screen renders | YES — all elements present |
| Register screen renders | YES — all fields + skill picker |
| Forgot password renders | YES (HTTP 200) |
| Auth guard redirects | YES — unauthenticated → login |
| No bundler errors | YES — 0 static errors |
| SSR working | YES — content in initial HTML |
| Metro config | Valid — NativeWind + Stripe shim |
| Expo config | Valid — loads env vars correctly |
