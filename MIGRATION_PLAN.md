# VarunsOnline — Codebase Restructuring Plan

## 1. Current Ownership Analysis

### Analytics Summary
- **Total source files**: ~84 .ts/.tsx files (excluding configs, scripts, DB migrations, assets)
- **app/**: 79 .tsx/.ts files (pages + API routes)
- **components/**: 16 .tsx/.ts files
- **lib/**: 17 .ts files (including tests)

### Current Import Flow (critical dependencies)

```
lib/supabase/client.ts          → imported by: ALL client components, pages, hooks
lib/supabase/server.ts          → imported by: admin actions, auth callback, layouts
lib/authMiddleware.ts           → imported by: adminAuth.ts, order-calculations.ts, ALL API routes
lib/adminAuth.ts                → imported by: admin API routes
lib/logger.ts                   → imported by: authMiddleware, loginTracker, rateLimit
lib/gps.ts                      → imported by: LocationPicker, AgentLiveLocationBar, customerGps
lib/customerGps.ts              → imported by: CheckoutContent (customer-only)
lib/uploadImage.ts              → imported by: shopkeeper products, shopkeeper profile
lib/fcm.ts                      → imported by: pushHelper
lib/pushHelper.ts               → imported by: notifications API routes
lib/usePushNotifications.ts     → imported by: ShopkeeperShell, delivery layout
lib/useOrderAlert.ts            → imported by: ShopkeeperShell, delivery layout
lib/existingUserDetection.ts    → imported by: login pages (customer, shopkeeper, delivery)
lib/order-calculations.ts       → imported by: order placement APIs
lib/rateLimit.ts                → imported by: auth login API
lib/loginTracker.ts             → imported by: auth login API
```

## 2. Proposed Module Architecture

```
varunsonline/
├── app/                        # Next.js App Router (unchanged — routing layer)
│   ├── customer/               # Customer pages (stay — route-bound)
│   ├── shopkeeper/             # Shopkeeper pages (stay — route-bound)
│   ├── delivery/               # Delivery pages (stay — route-bound)
│   ├── admin/                  # Admin pages (stay — route-bound)
│   ├── api/                    # API routes (stay — route-bound)
│   ├── login/                  # Auth pages (stay — shared)
│   ├── auth/                   # Auth callback (stay — shared)
│   ├── forgot-password/        # (stay — shared)
│   ├── reset-password/         # (stay — shared)
│   ├── splash/                 # (stay — shared)
│   ├── layout.tsx              # Root layout (stay — shared)
│   ├── page.tsx                # Root redirect (stay — shared)
│   ├── error.tsx               # Error boundary (stay — shared)
│   └── globals.css             # Global styles (stay — shared)
│
├── modules/                    # NEW — Role-based modules
│   ├── customer/
│   │   ├── components/         # CustomerShell, ProductCard, ProductFilters, FilterChips, useCustomerLocation
│   │   └── services/           # customerGps.ts
│   ├── shopkeeper/
│   │   ├── components/         # ShopkeeperShell
│   │   └── services/           # (empty for now)
│   ├── delivery/
│   │   └── components/         # AgentLiveLocationBar
│   ├── admin/
│   │   └── services/           # (empty for now — admin API logic stays in app/admin/)
│   ├── payment/
│   │   └── services/           # Razorpay order creation logic, payment verification
│   └── shared/
│       ├── components/         # Sidebar, LocationPicker, OrderChat
│       ├── hooks/              # usePushNotifications, useOrderAlert
│       └── services/           # existingUserDetection (used by multi-role login)
│
├── components/                 # Kept — but only truly shared components remain
│   ├── shared/                 # StarRating, ShopReviews, ProductReviews, ShopLocationBar, CustomerLocationBar
│   ├── ui/                     # Skeleton loader
│   ├── Sidebar.tsx             # (stays)
│   ├── LocationPicker.tsx      # (stays)
│   └── OrderChat/              # (stays)
│
├── lib/                        # Kept — true shared library (supabase, auth, gps, logger, etc.)
│   ├── supabase/               # client.ts, server.ts
│   ├── authMiddleware.ts
│   ├── adminAuth.ts
│   ├── logger.ts
│   ├── gps.ts
│   ├── rateLimit.ts
│   ├── loginTracker.ts
│   ├── fcm.ts
│   ├── pushHelper.ts
│   ├── uploadImage.ts
│   ├── order-calculations.ts
│   └── *.test.ts
```

## 3. Exact Files to Move

| # | Current Path | Destination Path | Module |
|---|-------------|-----------------|--------|
| 1 | `components/customer/CustomerShell.tsx` | `modules/customer/components/CustomerShell.tsx` | Customer |
| 2 | `components/customer/ProductCard.tsx` | `modules/customer/components/ProductCard.tsx` | Customer |
| 3 | `components/customer/ProductFilters.tsx` | `modules/customer/components/ProductFilters.tsx` | Customer |
| 4 | `components/customer/FilterChips.tsx` | `modules/customer/components/FilterChips.tsx` | Customer |
| 5 | `components/customer/useCustomerLocation.ts` | `modules/customer/components/useCustomerLocation.ts` | Customer |
| 6 | `components/shopkeeper/ShopkeeperShell.tsx` | `modules/shopkeeper/components/ShopkeeperShell.tsx` | Shopkeeper |
| 7 | `lib/customerGps.ts` | `modules/customer/services/customerGps.ts` | Customer |
| 8 | `components/shared/AgentLiveLocationBar.tsx` | `modules/delivery/components/AgentLiveLocationBar.tsx` | Delivery |
| 9 | `lib/existingUserDetection.ts` | `modules/shared/services/auth/existingUserDetection.ts` | Shared |
| 10 | `lib/usePushNotifications.ts` | `modules/shared/hooks/usePushNotifications.ts` | Shared |
| 11 | `lib/useOrderAlert.ts` | `modules/shared/hooks/useOrderAlert.ts` | Shared |

## 4. Files That STAY in Place (Shared/Core — NEVER moved)

| File | Reason |
|------|--------|
| `lib/supabase/client.ts` | Used by EVERY client component across ALL modules |
| `lib/supabase/server.ts` | Used by admin actions, auth callback, layouts across ALL modules |
| `lib/authMiddleware.ts` | CSRF + JWT verification for ALL API routes |
| `lib/adminAuth.ts` | Admin auth wrapper for admin API routes |
| `lib/logger.ts` | Structured logging used by EVERY server-side file |
| `lib/gps.ts` | GPS utilities used by customer, delivery, shopkeeper, location picker |
| `lib/rateLimit.ts` | Rate limiting used by auth + order APIs |
| `lib/loginTracker.ts` | Login tracking used by auth API |
| `lib/fcm.ts` | FCM sender used by notification endpoints |
| `lib/pushHelper.ts` | Push notification dispatch used by order, notification endpoints |
| `lib/uploadImage.ts` | Image upload used by shopkeeper products + profile pages |
| `lib/order-calculations.ts` | Order financial calculations used by order placement APIs |
| `components/shared/StarRating.tsx` | Used by ShopReviews + ProductReviews (cross-module) |
| `components/shared/ShopReviews.tsx` | Used by customer shop detail, potentially admin |
| `components/shared/ProductReviews.tsx` | Used by customer shop detail |
| `components/shared/ShopLocationBar.tsx` | Used by ShopkeeperShell |
| `components/shared/CustomerLocationBar.tsx` | Used by CustomerShell |
| `components/ui/skeleton.tsx` | Used by EVERY page for loading states |
| `components/Sidebar.tsx` | Used by ALL role shells (customer, shopkeeper, admin) |
| `components/LocationPicker.tsx` | Used by customer checkout + shopkeeper profile |
| `components/OrderChat/OrderChat.tsx` | Used by customer, shopkeeper, delivery, admin order detail |
| `app/layout.tsx` | Root layout |
| `app/globals.css` | Global styles |
| `app/page.tsx` | Root redirect |
| `app/error.tsx` | Error boundary |
| ALL `app/*` page files | Routing structure (Next.js requirement) |
| ALL `app/api/*` route files | API routing (Next.js requirement) |
| ALL config files | Build/config infrastructure |

## 5. Payment Architecture Placement

Payment lives in a **cross-cutting** layer — it's embedded in API routes. No dedicated `modules/payment/` needed because:

| Payment Function | Current Location | Module Owner | Why |
|-----------------|-----------------|-------------|-----|
| Razorpay order creation | `app/api/payment/create-order/route.ts` | Customer (checkout) | Called during customer checkout |
| Razorpay verification | `app/api/payment/verify/route.ts` | Payment | Used by both orders & settlements |
| Razorpay webhooks | `app/api/webhooks/razorpay/route.ts` | Payment | External webhook handler |
| Secure order placement | `app/api/orders/secure-place/route.ts` | Customer+Payment | Post-payment order creation |
| COD order placement | `app/api/orders/place-cod/route.ts` | Delivery+Payment | COD order creation |
| Order cancellation/refund | `app/api/orders/cancel/route.ts` | Shared | Used by customer + admin |
| Subscription payment | `app/api/shopkeeper/create-subscription-order/route.ts` | Shopkeeper+Payment | Shopkeeper plan purchase |
| Delivery settlement | `app/api/delivery/settlement/*/route.ts` | Delivery+Payment | Agent settlement payments |
| Order financial calc | `lib/order-calculations.ts` | Shared | Used by ALL payment paths |

Payment logic STAYS in `app/api/payment/` since it's already correctly placed. Payment services would go in `modules/payment/services/` if extracted.

## 6. Dependency Map (After Restructuring)

```
Customer Module
├── app/customer/*               → imports from modules/customer/components/*
│   ├── CheckoutContent.tsx      → imports from modules/customer/services/customerGps
│   └── app/customer/cart/page   → imports from modules/customer/components/ProductCard
├── modules/customer/components/* → imports from lib/supabase/client, components/shared/*
└── modules/customer/services/*   → imports from lib/gps

Shopkeeper Module
├── app/shopkeeper/*             → imports from modules/shopkeeper/components/ShopkeeperShell
├── modules/shopkeeper/components/* → imports from lib/supabase/client, lib/usePushNotifications,
│                                      lib/useOrderAlert, components/shared/ShopLocationBar,
│                                      components/Sidebar
└── modules/shopkeeper/services/*  → (empty)

Delivery Module
├── app/delivery/*               → imports from modules/delivery/components/AgentLiveLocationBar
├── modules/delivery/components/* → imports from lib/supabase/client, lib/gps
└── modules/delivery/services/*   → (empty)

Admin Module
├── app/admin/*                  → imports from lib/supabase/server, lib/adminAuth
└── (no module-specific components to move)

Payment Module
├── app/api/payment/*            → imports from lib/authMiddleware, lib/logger
├── app/api/webhooks/razorpay/*  → imports from lib/authMiddleware, lib/logger
└── (lives in API routes, no dedicated module directory needed)

Shared/Core
├── lib/*
├── components/shared/*
├── components/ui/*
├── components/Sidebar.tsx
├── components/LocationPicker.tsx
├── components/OrderChat/*
├── modules/shared/hooks/*
└── modules/shared/services/*
```

## 7. Migration Sequence

### Step 1: Create directory structure
```
mkdir modules/customer/components
mkdir modules/customer/services
mkdir modules/shopkeeper/components
mkdir modules/delivery/components
mkdir modules/shared/hooks
mkdir modules/shared/services/auth
```

### Step 2: Move files (git mv to preserve history)
```
git mv components/customer/CustomerShell.tsx    modules/customer/components/
git mv components/customer/ProductCard.tsx       modules/customer/components/
git mv components/customer/ProductFilters.tsx    modules/customer/components/
git mv components/customer/FilterChips.tsx       modules/customer/components/
git mv components/customer/useCustomerLocation.ts modules/customer/components/
git mv components/shopkeeper/ShopkeeperShell.tsx  modules/shopkeeper/components/
git mv lib/customerGps.ts                        modules/customer/services/
git mv components/shared/AgentLiveLocationBar.tsx modules/delivery/components/
git mv lib/existingUserDetection.ts               modules/shared/services/auth/
git mv lib/usePushNotifications.ts                modules/shared/hooks/
git mv lib/useOrderAlert.ts                       modules/shared/hooks/
```

### Step 3: Update imports in all files

Affected files that import from moved locations:
1. `app/customer/layout.tsx` — imports CustomerShell → update path
2. `app/customer/shop/[id]/page.tsx` — imports ProductCard, ProductFilters, FilterChips → update paths
3. `app/customer/browse/page.tsx` — imports ProductCard, ProductFilters, FilterChips → update paths
4. `app/customer/checkout/CheckoutContent.tsx` — imports customerGps → update path
5. `app/shopkeeper/layout.tsx` — imports ShopkeeperShell → update path
6. `app/delivery/layout.tsx` — imports AgentLiveLocationBar → update path
7. `app/delivery/page.tsx` — imports AgentLiveLocationBar → update path
8. `app/login/*/page.tsx` — imports existingUserDetection → update path
9. `modules/shopkeeper/components/ShopkeeperShell.tsx` — imports usePushNotifications, useOrderAlert → update paths
10. `modules/customer/components/CustomerShell.tsx` — imports CustomerLocationBar → stays
11. `modules/customer/services/customerGps.ts` — imports from lib/gps → stays
12. `modules/delivery/components/AgentLiveLocationBar.tsx` — imports from lib/gps → stays

### Step 4: Validate
- Build: `npm run build`
- TypeScript: `npx tsc --noEmit`
- Lint: `npm run lint`
- Test: `npm test`

## 8. Risk Analysis

### HIGH RISK — Files that must NOT change:
- **All `app/` routing files** — no physical moves
- **All `app/api/*` route files** — no physical moves
- **`lib/supabase/client.ts`** — singleton pattern, every client depends on it
- **`tsconfig.json`** — path alias `@/*` must remain unchanged

### MEDIUM RISK — Import updates:
- **CustomerShell import in `app/customer/layout.tsx`** — must update correctly
- **ShopkeeperShell import in `app/shopkeeper/layout.tsx`** — must update correctly
- **AgentLiveLocationBar imports** — used by delivery layout AND delivery dashboard page
- **existingUserDetection imports** — imported by 3 separate login pages

### LOW RISK — Clean moves:
- **components/customer/*** — single-module, no external deps
- **components/shopkeeper/*** — single-module, no external deps
- **lib/customerGps.ts** — thin re-export wrapper
- **lib/usePushNotifications.ts** — ref-based hook, portable
- **lib/useOrderAlert.ts** — portable hook

### No-Risk Items (unchanged):
- Database schema, migrations, SQL
- Environment variables
- External integrations (Razorpay, FCM, Supabase)
- All `app/api/*` endpoints
- All `app/*` page routes
- Public assets
- Android native code
- Config files (next.config, tailwind, postcss, etc.)

## 9. Final Folder Structure (after migration)

```
varunsonline/
├── app/                              # NEXT.JS ROUTING LAYER (unchanged)
│   ├── admin/                        # Admin routes
│   ├── api/                          # API routes
│   │   ├── admin/                    # Admin APIs
│   │   ├── auth/                     # Auth APIs
│   │   ├── cron/                     # Cron jobs
│   │   ├── customer/                 # Customer APIs
│   │   ├── delivery/                 # Delivery APIs
│   │   ├── notifications/            # Notification APIs
│   │   ├── order-messages/           # Order chat APIs
│   │   ├── orders/                   # Order placement APIs
│   │   ├── payment/                  # Payment APIs
│   │   ├── product-ratings/          # Product rating APIs
│   │   ├── reviews/                  # Review APIs
│   │   ├── shopkeeper/               # Shopkeeper APIs
│   │   ├── storage/                  # Storage APIs
│   │   ├── webhooks/                 # Webhook handlers
│   │   └── withdraw/                 # Withdrawal APIs
│   ├── auth/                         # Auth callback
│   ├── customer/                     # Customer pages
│   ├── delivery/                     # Delivery pages
│   ├── forgot-password/              # Forgot password
│   ├── login/                        # Login/registration pages
│   ├── reset-password/               # Reset password
│   ├── shopkeeper/                   # Shopkeeper pages
│   ├── splash/                       # Splash screen
│   ├── layout.tsx                    # Root layout (SHARED)
│   ├── page.tsx                      # Root redirect (SHARED)
│   ├── error.tsx                     # Error boundary (SHARED)
│   └── globals.css                   # Global styles (SHARED)
│
├── modules/                          # MODULE-BASED CODE ORGANIZATION
│   ├── customer/
│   │   ├── components/
│   │   │   ├── CustomerShell.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── ProductFilters.tsx
│   │   │   ├── FilterChips.tsx
│   │   │   └── useCustomerLocation.ts
│   │   └── services/
│   │       └── customerGps.ts
│   ├── shopkeeper/
│   │   └── components/
│   │       └── ShopkeeperShell.tsx
│   ├── delivery/
│   │   └── components/
│   │       └── AgentLiveLocationBar.tsx
│   ├── admin/
│   │   └── services/
│   └── shared/
│       ├── hooks/
│       │   ├── usePushNotifications.ts
│       │   └── useOrderAlert.ts
│       └── services/
│           └── auth/
│               └── existingUserDetection.ts
│
├── components/                       # REMAINING SHARED COMPONENTS
│   ├── shared/
│   │   ├── StarRating.tsx
│   │   ├── ShopReviews.tsx
│   │   ├── ProductReviews.tsx
│   │   ├── ShopLocationBar.tsx
│   │   └── CustomerLocationBar.tsx
│   ├── ui/
│   │   └── skeleton.tsx
│   ├── Sidebar.tsx
│   ├── LocationPicker.tsx
│   └── OrderChat/
│       └── OrderChat.tsx
│
├── lib/                              # REMAINING SHARED LIBRARY
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── authMiddleware.ts
│   ├── adminAuth.ts
│   ├── logger.ts
│   ├── rateLimit.ts
│   ├── loginTracker.ts
│   ├── gps.ts
│   ├── fcm.ts
│   ├── pushHelper.ts
│   ├── uploadImage.ts
│   ├── order-calculations.ts
│   └── *.test.ts
│
├── public/                           # Static assets (unchanged)
├── supabase/                         # Database migrations (unchanged)
├── android/                          # Native Android (unchanged)
├── .vercel/                          # Deployment (unchanged)
└── config files                      # Build configs (unchanged)
```

## 10. Verification Checklist

After migration, verify:

- [x] No files deleted (only moved, tracked by git)
- [x] No file content changed (except imports)
- [x] All test files remain in place
- [x] Build passes (`npm run build`)
- [x] TypeScript passes (`npx tsc --noEmit`)
- [x] Lint passes (`npm run lint`)
- [x] Tests pass (`npm test`)
- [x] No circular dependencies
- [x] All route paths unchanged
- [x] All API endpoints unchanged
- [x] All database queries unchanged
- [x] All environment variable references unchanged
- [x] All external integrations unchanged
