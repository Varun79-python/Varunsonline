# UI/UX Improvement Priority Plan

> Working order for UI/UX improvements across Varun's Online.
> Each page analyzed → problems explained → approved → implemented.

---

## Phase 1: Auth & Onboarding (High Impact)

| Order | Page | Route | Est. Effort | Status |
|-------|------|-------|-------------|--------|
| 1 | **Splash Screen** | `/splash/page.tsx` | Small | ⏳ |
| 2 | **Role Selection** | `/login/page.tsx` | Small | ⏳ |
| 3 | **Customer Login/Register** | `/login/customer/page.tsx` | Medium | ⏳ |
| 4 | **Shopkeeper Login** | `/login/shopkeeper/page.tsx` | Small | ⏳ |
| 5 | **Delivery Login** | `/login/delivery/page.tsx` | Small | ⏳ |
| 6 | **Shopkeeper Registration** | `/login/shopkeeper/register/page.tsx` | Medium | ⏳ |
| 7 | **Delivery Registration** | `/login/delivery/register/page.tsx` | Medium | ⏳ |
| 8 | **Shop Documents Upload** | `/login/shopkeeper/register/documents/page.tsx` | Medium | ⏳ |
| 9 | **Delivery Documents Upload** | `/login/delivery/register/documents/page.tsx` | Medium | ⏳ |
| 10 | **Login Status** | `/login/status/page.tsx` | Small | ⏳ |
| 11 | **Forgot Password** | `/forgot-password/page.tsx` | Small | ⏳ |
| 12 | **Reset Password** | `/reset-password/page.tsx` | Small | ⏳ |
| 13 | **Admin Login** | `/admin/login/page.tsx` | Small | ⏳ |

## Phase 2: Back-Office Pages (Review Needed)

| Order | Page | Route | Est. Effort | Status |
|-------|------|-------|-------------|--------|
| 14 | **Admin Shops** | `/admin/shops/page.tsx` | Medium | ⏳ |
| 15 | **Admin Agents** | `/admin/agents/page.tsx` | Medium | ⏳ |
| 16 | **Admin Customers** | `/admin/customers/page.tsx` | Medium | ⏳ |
| 17 | **Admin Orders Detail** | `/admin/orders/[id]/page.tsx` | Medium | ⏳ |
| 18 | **Admin Plans** | `/admin/plans/page.tsx` | Small | ⏳ |
| 19 | **Admin Settings** | `/admin/settings/page.tsx` | Small | ⏳ |
| 20 | **Admin Withdrawals** | `/admin/withdrawals/page.tsx` | Medium | ⏳ |
| 21 | **Admin Complaints** | `/admin/complaints/page.tsx` | Medium | ⏳ |
| 22 | **Admin Coupons** | `/admin/coupons/page.tsx` | Medium | ⏳ |
| 23 | **Admin Revenue** | `/admin/revenue/page.tsx` | Small | ⏳ |
| 24 | **Admin COD Settlements** | `/admin/cod-settlements/page.tsx` | Medium | ⏳ |
| 25 | **Admin Agent Settlements** | `/admin/agent-settlements/page.tsx` | Medium | ⏳ |
| 26 | **Shopkeeper Orders** | `/shopkeeper/orders/page.tsx` | Medium | ⏳ |
| 27 | **Shopkeeper Order Detail** | `/shopkeeper/orders/[id]/page.tsx` | Medium | ⏳ |
| 28 | **Shopkeeper Products** | `/shopkeeper/products/page.tsx` | Medium | ⏳ |
| 29 | **Shopkeeper Wallet** | `/shopkeeper/wallet/page.tsx` | Small | ⏳ |
| 30 | **Shopkeeper Plans** | `/shopkeeper/plans/page.tsx` | Small | ⏳ |
| 31 | **Shopkeeper Profile** | `/shopkeeper/profile/page.tsx` | Small | ⏳ |
| 32 | **Delivery Orders** | `/delivery/orders/page.tsx` | Medium | ⏳ |
| 33 | **Delivery Order Detail** | `/delivery/orders/[id]/page.tsx` | Medium | ⏳ |
| 34 | **Delivery Wallet** | `/delivery/wallet/page.tsx` | Small | ⏳ |
| 35 | **Delivery Profile** | `/delivery/profile/page.tsx` | Small | ⏳ |
| 36 | **Customer Care** | `/customer/care/page.tsx` | Small | ⏳ |
| 37 | **Customer Order Detail** | `/customer/orders/[id]/page.tsx` | Small | ⏳ |

## Phase 3: Polish & Cross-Cutting Fixes

| Order | Task | Est. Effort | Status |
|-------|------|-------------|--------|
| 38 | Extract CAPTCHA to shared component | Small | ⏳ |
| 39 | Remove duplicate `@keyframes spin` across all files | Small | ⏳ |
| 40 | Extract auth header (back + logo) to shared component | Small | ⏳ |
| 41 | Extract password visibility toggle SVG to shared component | Small | ⏳ |
| 42 | Extract forgot password modal to shared component | Small | ⏳ |
| 43 | Premium design system pass (glass, 3D cards, animations) | Large | ⏳ |

---

## Rules of Engagement

1. **Analyze first** — read the file, list UX problems, propose fixes
2. **Get approval** — user says "go" before any edits
3. **Never touch** — business logic, API routes, DB schema, Supabase queries, auth flows, payment flows, order workflows, delivery workflows, shopkeeper/admin workflows, RLS
4. **Only improve** — UI design, UX flow, layout, typography, spacing, visual hierarchy, mobile responsiveness, animations, accessibility, component consistency
5. **After edits** — verify page still loads and functions correctly
