# UI/UX Eligible Pages — Varun's Online

> Complete list of all pages where UI/UX improvements can be applied.

---

## Phase 1: Auth & Onboarding

| # | Page | Route | File |
|---|------|-------|------|
| 1 | Splash Screen | `/splash` | `app/splash/page.tsx` |
| 2 | Role Selection | `/login` | `app/login/page.tsx` |
| 3 | Customer Login/Register | `/login/customer` | `app/login/customer/page.tsx` |
| 4 | Shopkeeper Login | `/login/shopkeeper` | `app/login/shopkeeper/page.tsx` |
| 5 | Delivery Login | `/login/delivery` | `app/login/delivery/page.tsx` |
| 6 | Shopkeeper Registration | `/login/shopkeeper/register` | `app/login/shopkeeper/register/page.tsx` |
| 7 | Delivery Registration | `/login/delivery/register` | `app/login/delivery/register/page.tsx` |
| 8 | Shop Documents Upload | `/login/shopkeeper/register/documents` | `app/login/shopkeeper/register/documents/page.tsx` |
| 9 | Delivery Documents Upload | `/login/delivery/register/documents` | `app/login/delivery/register/documents/page.tsx` |
| 10 | Login Status | `/login/status` | `app/login/status/page.tsx` |
| 11 | Forgot Password | `/forgot-password` | `app/forgot-password/page.tsx` |
| 12 | Reset Password | `/reset-password` | `app/reset-password/page.tsx` |
| 13 | Admin Login | `/admin/login` | `app/admin/login/page.tsx` |

---

## Phase 2: Admin Pages

| # | Page | Route | File |
|---|------|-------|------|
| 14 | Admin Dashboard | `/admin` | `app/admin/page.tsx` |
| 15 | Admin Orders | `/admin/orders` | `app/admin/orders/page.tsx` |
| 16 | Admin Order Detail | `/admin/orders/[id]` | `app/admin/orders/[id]/page.tsx` |
| 17 | Admin Shops | `/admin/shops` | `app/admin/shops/page.tsx` |
| 18 | Admin Agents | `/admin/agents` | `app/admin/agents/page.tsx` |
| 19 | Admin Customers | `/admin/customers` | `app/admin/customers/page.tsx` |
| 20 | Admin Plans | `/admin/plans` | `app/admin/plans/page.tsx` |
| 21 | Admin Plans Settings | `/admin/plans/settings` | `app/admin/plans/settings/page.tsx` |
| 22 | Admin Settings | `/admin/settings` | `app/admin/settings/page.tsx` |
| 23 | Admin Withdrawals | `/admin/withdrawals` | `app/admin/withdrawals/page.tsx` |
| 24 | Admin Complaints | `/admin/complaints` | `app/admin/complaints/page.tsx` |
| 25 | Admin Coupons | `/admin/coupons` | `app/admin/coupons/page.tsx` |
| 26 | Admin Revenue | `/admin/revenue` | `app/admin/revenue/page.tsx` |
| 27 | Admin COD Settlements | `/admin/cod-settlements` | `app/admin/cod-settlements/page.tsx` |
| 28 | Admin Agent Settlements | `/admin/agent-settlements` | `app/admin/agent-settlements/page.tsx` |

---

## Phase 2: Shopkeeper Pages

| # | Page | Route | File |
|---|------|-------|------|
| 29 | Shopkeeper Dashboard | `/shopkeeper` | `app/shopkeeper/page.tsx` |
| 30 | Shopkeeper Orders | `/shopkeeper/orders` | `app/shopkeeper/orders/page.tsx` |
| 31 | Shopkeeper Order Detail | `/shopkeeper/orders/[id]` | `app/shopkeeper/orders/[id]/page.tsx` |
| 32 | Shopkeeper Products | `/shopkeeper/products` | `app/shopkeeper/products/page.tsx` |
| 33 | Shopkeeper Wallet | `/shopkeeper/wallet` | `app/shopkeeper/wallet/page.tsx` |
| 34 | Shopkeeper Plans | `/shopkeeper/plans` | `app/shopkeeper/plans/page.tsx` |
| 35 | Shopkeeper Profile | `/shopkeeper/profile` | `app/shopkeeper/profile/page.tsx` |
| 36 | Shopkeeper Complete Profile | `/shopkeeper/complete-profile` | `app/shopkeeper/complete-profile/page.tsx` |

---

## Phase 2: Delivery Pages

| # | Page | Route | File |
|---|------|-------|------|
| 37 | Delivery Dashboard | `/delivery` | `app/delivery/page.tsx` |
| 38 | Delivery Orders | `/delivery/orders` | `app/delivery/orders/page.tsx` |
| 39 | Delivery Order Detail | `/delivery/orders/[id]` | `app/delivery/orders/[id]/page.tsx` |
| 40 | Delivery Wallet | `/delivery/wallet` | `app/delivery/wallet/page.tsx` |
| 41 | Delivery Profile | `/delivery/profile` | `app/delivery/profile/page.tsx` |

---

## Phase 2: Customer Pages

| # | Page | Route | File |
|---|------|-------|------|
| 42 | Customer Home | `/customer` | `app/customer/page.tsx` |
| 43 | Shop Detail | `/customer/shop/[id]` | `app/customer/shop/[id]/page.tsx` |
| 44 | Browse / Search | `/customer/browse` | `app/customer/browse/page.tsx` |
| 45 | Cart | `/customer/cart` | `app/customer/cart/page.tsx` |
| 46 | Checkout | `/customer/checkout` | `app/customer/checkout/page.tsx` |
| 47 | Customer Orders | `/customer/orders` | `app/customer/orders/page.tsx` |
| 48 | Customer Order Detail | `/customer/orders/[id]` | `app/customer/orders/[id]/page.tsx` |
| 49 | Customer Profile | `/customer/profile` | `app/customer/profile/page.tsx` |
| 50 | Customer Care | `/customer/care` | `app/customer/care/page.tsx` |

---

## Components

| # | Component | File |
|---|-----------|------|
| 51 | CustomerShell (layout) | `components/customer/CustomerShell.tsx` |
| 52 | ShopkeeperShell (layout) | `components/shopkeeper/ShopkeeperShell.tsx` |
| 53 | ProductCard | `components/customer/ProductCard.tsx` |
| 54 | FilterChips | `components/customer/FilterChips.tsx` |
| 55 | ProductFilters | `components/customer/ProductFilters.tsx` |
| 56 | StarRating | `components/shared/StarRating.tsx` |
| 57 | ProductReviews | `components/shared/ProductReviews.tsx` |
| 58 | ShopReviews | `components/shared/ShopReviews.tsx` |
| 59 | ShopLocationBar | `components/shared/ShopLocationBar.tsx` |
| 60 | CustomerLocationBar | `components/shared/CustomerLocationBar.tsx` |
| 61 | AgentLiveLocationBar | `components/shared/AgentLiveLocationBar.tsx` |
| 62 | OrderChat | `components/OrderChat/OrderChat.tsx` |
| 63 | LocationPicker | `components/LocationPicker.tsx` |
| 64 | Sidebar | `components/Sidebar.tsx` |
| 65 | Skeleton | `components/ui/skeleton.tsx` |

---

## Global Files

| # | File | Description |
|---|------|-------------|
| 66 | `app/globals.css` | Design system, CSS variables, utility classes |
| 67 | `app/layout.tsx` | Root layout, metadata, viewport |

---

**Total: 67 items** (50 pages + 15 components + 2 global files)
