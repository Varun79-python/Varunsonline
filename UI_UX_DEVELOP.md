# UI/UX Development Plan — Varun's Online

> **Date:** May 31, 2026
> **Scope:** Planned UI/UX improvements across all interfaces — auth, customer, shopkeeper, delivery, admin
> **Approach:** Component analysis → UX problem identification → Proposed improvements → Approval → Implementation
> **Status:** In progress (Phase 1 active)

> **⚠️ Hard Rule:** No business logic, API routes, database schema, Supabase queries, authentication flows, payment flows, order/delivery/shopkeeper/admin workflows, or RLS permissions will be modified. Only UI design, UX flow, layout, typography, spacing, visual hierarchy, mobile responsiveness, animations, accessibility, and component consistency.

---

## Phase 1: Auth & Onboarding Flow

These pages form the user's first impression of the app. Currently they rely heavily on inline styles, duplicated components (CAPTCHA, password toggle, keyframes), and do not fully utilize the CSS variable system in `globals.css`.

---

### 1.1 Splash Screen (`/splash/page.tsx`)

**File:** `app/splash/page.tsx` (74 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| 100% inline styles | **High** | Entire component uses inline `style={}` — no CSS classes from globals.css |
| Scoped `@keyframes pulse` | **Low** | `pulse` keyframes defined locally despite existing in globals.css |
| No `aria-label` on skip button | **Medium** | Icon-only button not accessible to screen readers |
| No `prefers-reduced-motion` respect | **Low** | Animation does not respect user motion preferences |
| No dark mode consideration | **Low** | Hardcoded white background |
| Hover events on mobile (skip button) | **Medium** | `onMouseEnter`/`onMouseLeave` do nothing on touch devices |
| Image missing width/height attributes | **Low** | Next.js Image already handles this — acceptable |
| No branding fade-in animation | **Low** | Logo appears instantly, no entrance animation |
| Centered layout uses no CSS variables | **Medium** | Colors like `white`, `#94a3b8`, `#e2e8f0` hardcoded |

#### Proposed Improvements
- Use CSS classes (`.fade-in`, `.pulse`) from globals.css
- Replace inline styles with CSS variables (`var(--bg)`, `var(--text-dim)`, `var(--border)`)
- Add entrance animation with staggered timing (logo → skip button)
- Add `aria-label` to skip button
- Add `prefers-reduced-motion` compliant animation
- Replace hover-only effects with touch-friendly alternatives
- Use `env(safe-area-inset-bottom)` for skip button positioning

---

### 1.2 Role Selection Page (`/login/page.tsx`)

**File:** `app/login/page.tsx` (120 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| 100% inline styles | **High** | Entire component uses inline `style={}` |
| Hardcoded color values | **Medium** | `#f97316`, `#fff7ed`, `#22c55e`, `#0ea5e9` etc. hardcoded |
| Manual hover effects | **Low** | `onMouseEnter`/`onMouseLeave` for card lift — no CSS `:hover` |
| No role card entrance animation | **Low** | Cards appear all at once — no staggered reveal |
| Emoji icons lack `aria-hidden` | **Medium** | Screen readers will read "shopping cart" etc. |
| No keyboard navigation optimization | **Low** | Role cards should be `<button>` elements (they are ✅) |
| Card shadow values not from CSS variables | **Medium** | `0 2px 8px rgba(0,0,0,0.04)` should use `var(--shadow)` |
| No `aria-label` on the icon-only back-arrow | **Medium** | Missing on the header back button |
| Font sizing uses `px` not `clamp()` | **Low** | `fontSize: '1.75rem'` should be responsive |

#### Proposed Improvements
- Refactor to use CSS classes (`.card`, `.btn`, `.gap-*`, `.text-*`)
- Use CSS variables for all colors, shadows, radii
- Add staggered fade-in animation for role cards
- Add `aria-label` to interactive elements
- Replace manual hover JS with CSS `:hover` and `:active` pseudo-classes
- Add `role="list"` and `role="listitem"` for accessibility
- Use `.gradient-text` class for heading

---

### 1.3 Customer Login/Register (`/login/customer/page.tsx`)

**File:** `app/login/customer/page.tsx` (320 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| 100% inline styles | **High** | Entire 320-line form uses inline `style={}` |
| CAPTCHA component duplicated | **Medium** | Same `CaptchaDisplay` + `generateCaptcha` in 3 login files |
| Duplicate `@keyframes` (none visible) | **Low** | No keyframes — acceptable |
| Password visibility toggle SVGs duplicated | **Medium** | Same SVG paths repeated in login/register files |
| Forgot password modal duplicated | **Medium** | Same modal pattern in 3 login files |
| No form section grouping | **Medium** | Register fields appear abruptly without visual sections |
| CAPTCHA refresh button has emoji only | **Medium** | `🔄` emoji with no `aria-label` |
| Error state hardcoded colors | **Low** | `#fef2f2`, `#dc2626` instead of `var(--danger-light)`, `var(--danger)` |
| No input focus ring consistent with globals.css | **Low** | Input focus styles are non-existent (browser default) |
| Form width not constrained on desktop | **Medium** | Form stretches full width on large screens |
| Toggle between Login/Register not visually distinct | **Low** | Link-style toggle blends with surrounding text |
| No password strength indicator on register | **Low** | Missing strength bar (exists on reset-password page) |

#### Proposed Improvements
- Refactor to use CSS classes (`.card`, `.input`, `.input-group`, `.input-label`, `.btn`, `.btn-primary`, `.btn-full`, `.btn-lg`)
- Extract CAPTCHA to shared component
- Extract password toggle to shared component
- Extract forgot password modal to shared component
- Group register fields with section headers and visual card separation
- Add `aria-label` to CAPTCHA refresh, password toggle, back button
- Add password strength bar on registration
- Constrain form width with `max-width` on desktop
- Add staggered field entrance animation
- Use CSS variables for all colors
- Add keyboard shortcut: Enter moves to next field

---

### 1.4 Shopkeeper Login (`/login/shopkeeper/page.tsx`)

**File:** `app/login/shopkeeper/page.tsx` (240 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| Same pattern as customer login | **High** | Duplicate inline styles, duplicated CAPTCHA, duplicated forgot password modal |
| Duplicate `CaptchaDisplay` component | **Medium** | Copy-pasted from customer login |
| Duplicate forgot password modal | **Medium** | Same modal code as customer login |
| Duplicate password toggle SVGs | **Low** | Same SVG paths |
| Inline gradient for button | **Low** | `linear-gradient(135deg, #f97316 0%, #ea580c 100%)` hardcoded |
| No visual distinction from customer login | **Low** | Layout identical to customer login — only icon+color differs |
| Hardcoded shadow on button | **Low** | `0 4px 16px rgba(249,115,22,0.3)` should use `var(--shadow-orange)` |
| No `aria-label` on interactive elements | **Medium** | Password toggle, back button, CAPTCHA refresh missing labels |

#### Proposed Improvements
- Refactor to use CSS classes (same pattern as customer login)
- Use shared CAPTCHA component
- Use shared forgot password modal
- Use shared password toggle component
- Add role-specific visual differentiation (e.g., shop icon accent)
- Use CSS variables and utility classes
- Add `aria-labels` throughout

---

### 1.5 Delivery Login (`/login/delivery/page.tsx`)

**File:** `app/login/delivery/page.tsx` (218 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| Same duplicate patterns | **High** | CAPTCHA, forgot password modal, password toggle — all duplicated |
| Green accent color hardcoded | **Low** | `#22c55e`, `#16a34a` used directly |
| Same layout as other logins | **Low** | No distinct visual identity for delivery partner login |
| Login button uses inline gradient | **Low** | `linear-gradient(135deg, #22c55e 0%, #16a34a 100%)` |
| Forgot password button color is green | **Low** | Uses `#22c55e` instead of semantic `var(--text-muted)` with hover |

#### Proposed Improvements
- Same refactoring: shared components, CSS classes, CSS variables
- Add delivery-branded visual elements (icon, accent color)
- Use semantic color tokens

---

### 1.6 Shopkeeper Registration (`/login/shopkeeper/register/page.tsx`)

**File:** `app/login/shopkeeper/register/page.tsx` (350 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| 100% inline styles | **High** | Entire 350-line component uses inline `style={}` |
| Duplicate `@keyframes spin` | **Low** | Defined locally despite being in globals.css |
| Loading spinner uses `border-top-color: #f97316` | **Low** | Should use `var(--primary)` |
| Forgot password — N/A | - | Registration form, no reset modal needed |
| No password strength indicator | **Low** | Missing strength bar |
| Gender selector as select dropdown | **Medium** | Dropdown is less touch-friendly than gender toggle pills (delivery register has better pattern) |
| Terms modal bottom sheet could be polished | **Medium** | Works well but lacks drag handle styling from globals.css |
| No progress indicator for multi-step form | **Medium** | "Step 1: Personal Details" is text-only — no visual step tracker |
| Scoped `<style>` for spin keyframes | **Low** | `@keyframes spin` redefined locally |
| No form validation feedback styling | **Low** | Error appears as text only — no input border highlighting |
| Checkbox + terms link layout not aligned | **Low** | Checkbox and text alignment slightly off |
| No `aria-label` on "View Terms" button | **Medium** | Button has emoji + text so acceptable but could be better |
| Capitalization inconsistent in labels | **Low** | Some uppercase via CSS (`text-transform`), some as-is |

#### Proposed Improvements
- Refactor to use CSS classes (`.card`, `.input`, `.input-group`, `.btn`, `.btn-primary`, `.btn-full`)
- Add visual step progress indicator (Step 1 of 2 with dots)
- Replace gender dropdown with pill toggle (like delivery register pattern)
- Add password strength bar
- Use CSS variables for all colors and shadows
- Add field-level validation feedback (green/red borders)
- Use shared spinner class `.spin` from globals.css
- Improve checkbox + terms text alignment
- Add `aria-labels` to interactive elements

---

### 1.7 Delivery Registration (`/login/delivery/register/page.tsx`)

**File:** `app/login/delivery/register/page.tsx` (375 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| 100% inline styles | **High** | Entire 375-line component uses inline `style={}` |
| Duplicate `@keyframes spin` | **Low** | Defined locally |
| 3 identical card sections | **Medium** | Personal Details, Vehicle Details, Terms — all same card pattern, could be more distinct |
| Gender pill toggle is well done ✅ | - | Keep this pattern, port to other register pages |
| Loading spinner color hardcoded `#22c55e` | **Low** | Should use CSS variable |
| Vehicle number input could have formatting hint | **Low** | Placeholder is good but input format not enforced |
| No password strength indicator | **Low** | Missing |
| Multi-step form has no visual step indicator | **Medium** | "Step 1: Personal Details" text only |
| Label text style inconsistent | **Low** | Some labels `0.8rem`, some `0.82rem` |
| Save button gradient hardcoded `#22c55e` | **Low** | Should use `var(--success)` |
| Terms modal could use globals.css modal classes | **Medium** | Inline modal with bottom-sheet pattern — should use `.modal-overlay`, `.modal` |
| No field grouping visual separation in Personal Details | **Low** | All fields stacked without grouping |

#### Proposed Improvements
- Refactor to CSS classes (`.card`, `.input`, `.btn`, `.btn-success`, `.modal-overlay`, `.modal`)
- Add visual step progress indicator
- Add password strength bar
- Use CSS variables for all colors
- Use shared `.spin` class
- Use globals.css modal classes for terms bottom sheet
- Add `aria-labels` throughout

---

### 1.8 Shop Documents Upload (`/login/shopkeeper/register/documents/page.tsx`)

**File:** `app/login/shopkeeper/register/documents/page.tsx` (427 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| 100% inline styles | **High** | 427 lines, all inline `style={}` |
| Duplicate `@keyframes spin` | **Low** | Defined locally despite being in globals.css |
| No section progress indicator | **Medium** | No visual "Step 2 of 2" tracking |
| GPS capture button good UX ✅ | - | Keep the capture + confirm + verify pattern |
| File upload drop zones could have better states | **Low** | Dashed border, preview, uploading, success — functional but could be polished |
| Loading/error/done states are separate returns | **Medium** | Multiple return paths create code duplication in outer structure |
| No character count for shop name | **Low** | Could show remaining chars |
| Category select placeholder color is hardcoded | **Low** | `#94a3b8` for placeholder |
| Submit button gradient hardcoded | **Low** | `linear-gradient(135deg, #f97316 0%, #ea580c 100%)` |
| Header gradient hardcoded | **Low** | Orange gradient in header could use `.gradient-premium` class |
| Back button in header uses `rgba(255,255,255,0.2)` | **Low** | Should use a CSS class pattern |

#### Proposed Improvements
- Refactor to CSS classes (`.card`, `.input`, `.btn`, `.btn-primary`, `.badge`, `.alert`)
- Add visual step tracker showing "Step 2 of 2: Documents"
- Use CSS variables and utility classes throughout
- Use globals.css `.gradient-premium` for header
- Use shared `.spin` animation
- Consolidate multiple return states into single render with conditional sections
- Add `aria-labels` to all interactive elements
- Improve file upload drop zone visual states
- Use `.alert-*` classes for error/info messages

---

### 1.9 Delivery Documents Upload (`/login/delivery/register/documents/page.tsx`)

**File:** `app/login/delivery/register/documents/page.tsx` (310 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| 100% inline styles | **High** | 310 lines, all inline |
| Duplicate `@keyframes spin` | **Low** | Local definition |
| 5 document cards are repetitive | **Medium** | Each card has identical structure — works but feels repetitive |
| Upload state UI could be more polished | **Low** | Dashed border, uploading indicator work but are basic |
| No progress aggregation | **Low** | No visual indicator of "3 of 5 documents uploaded" |
| Loading/error/done states separate returns | **Medium** | Code duplication |
| Image preview could be cleaner | **Low** | Preview shown below upload zone, could be inline |
| No `aria-label` on document upload areas | **Medium** | Hidden file inputs lack accessible labels |
| Required marker uses bare `<span style="color: #dc2626">` | **Low** | Should use `var(--danger)` |

#### Proposed Improvements
- Refactor to CSS classes
- Add aggregate progress bar ("4 of 5 uploaded")
- Use CSS variables consistently
- Use shared `.spin` animation
- Consolidate state rendering
- Add `aria-label` to upload zones
- Use `.badge`, `.alert`, `.card` classes
- Use `.gradient-premium` for buttons

---

### 1.10 Login Status Page (`/login/status/page.tsx`)

**File:** `app/login/status/page.tsx` (235 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| 100% inline styles | **High** | All styles inline |
| Duplicate `@keyframes spin` and `@keyframes pulse` | **Low** | Defined locally despite being in globals.css |
| Loading state inline spinner | **Low** | Should use `.spin` class |
| Status card centered but no CSS classes | **Medium** | Card uses inline border, shadow, radius |
| Auto-checking pulse dot hardcoded colors | **Low** | `#22c55e`, `#e2e8f0` hardcoded |
| Button gradients hardcoded | **Low** | Orange button gradient, green "Upload Documents" button |
| No subtle status animation variation | **Low** | Pending/approved/rejected could have different entrance animations |
| Status icons (emojis) lack `aria-hidden` | **Medium** | Screen readers will describe emojis |
| No logout confirmation | **Low** | Direct logout without confirmation dialog |
| "Check Now" button reload spinner | **Low** | Could use `.spin` class with button |

#### Proposed Improvements
- Refactor to CSS classes (`.card`, `.badge`, `.btn`, `.btn-primary`, `.btn-success`, `.btn-secondary`)
- Use CSS variables for all colors
- Use `.spin`, `.pulse` from globals.css
- Add status-specific entrance animations (slide-up for pending, scale for approved, shake for rejected)
- Add `aria-hidden` to status emojis
- Add `aria-live="polite"` for auto-checking status region
- Use `.gradient-premium` for primary buttons
- Use `.alert-*` for status message styling

---

### 1.11 Forgot Password (`/forgot-password/page.tsx`)

**File:** `app/forgot-password/page.tsx` (112 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| Mixed inline and CSS class styles | **Medium** | Some CSS variables used, but heavy inline styles remain |
| Container uses inline gradient (none) | **Low** | Background is `var(--bg)` — clean |
| Card uses inline styles for dark theme | **Low** | `border: 1px solid var(--border)`, `box-shadow: 0 8px 40px rgba(0,0,0,0.3)` |
| Button uses inline gradient | **Low** | `className="btn btn-primary"` is good, but emoji in text `📧` |
| Success state has inline styles | **Medium** | Email sent confirmation uses heavy inline styles |
| Back link uses `<a>` instead of Next.js `<Link>` | **Low** | Causes full page navigation |
| No `aria-label` on email input | **Low** | Has `placeholder` but no explicit `aria-label` |
| Loading state uses inline spinner | **Low** | `<span className="spin">` — good, but inline sizing |
| No `prefers-reduced-motion` for spinner | **Low** | `.spin` already respects motion preferences in globals.css ✅ |

#### Proposed Improvements
- Remove remaining inline styles, use CSS classes
- Use Next.js `<Link>` for navigation
- Use `.card`, `.alert-*`, `.btn`, `.btn-primary` consistently
- Add `aria-live="polite"` on success/error states
- Consolidate inline gradient into `.gradient-premium` class if desired

---

### 1.12 Reset Password (`/reset-password/page.tsx`)

**File:** `app/reset-password/page.tsx` (600 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| Well-designed ✅ | **Low** | Password strength bar, clear recovery flow, good visual states |
| Inline styles still present | **Medium** | Though well-organized, still uses inline `style={}` heavily |
| Duplicate `@keyframes spin` | **Low** | Defined locally |
| Password strength bar is good pattern ✅ | - | Could extract to shared component |
| EyeIcon component duplicated | **Low** | Same SVG as other login pages — should be shared |
| Gradient icon box uses inline styles | **Low** | Orange gradient circle in header |
| Success state inline spinner | **Low** | Should use `.spin` |
| Invalid/expired state has inline styles | **Medium** | Card, button, layout all inline |
| Loading state inline | **Medium** | No CSS classes used |
| Form submission button inline gradient | **Low** | Hardcoded `linear-gradient(135deg, #f97316 0%, #ea580c 100%)` |
| `Suspense` fallback inline | **Low** | Full-page spinner uses inline styles |

#### Proposed Improvements
- Refactor to use CSS classes where possible
- Use shared `.spin` class
- Use `.card`, `.btn`, `.btn-primary`, `.btn-full`, `.btn-lg`
- Use CSS variables for all colors
- Extract `EyeIcon` to shared component
- Extract `PasswordStrengthBar` to shared component
- Use `.gradient-premium` for decorative icon box

---

### 1.13 Admin Login (`/admin/login/page.tsx`)

**File:** `app/admin/login/page.tsx` (203 lines)
**Status:** ⏳ Pending

#### UX Issues Observed
| Issue | Severity | Description |
|-------|----------|-------------|
| Uses CSS classes partially ✅ | **Medium** | Better than other logins — uses `.card`, `.input`, `.btn`, `.btn-primary` |
| Remaining inline styles for specialized elements | **Low** | Error banner, password toggle, layout container use inline |
| Loading skeleton is well done ✅ | - | Uses `<Skeleton>` component |
| Error banner uses inline styles | **Medium** | `rgba(239,68,68,0.1)`, `#fca5a5` — should use `.alert-danger` |
| Password toggle SVGs duplicated | **Low** | Same SVG as other login pages |
| Emoji `👑` used in heading without `aria-hidden` | **Low** | Decorative emoji |
| No `aria-label` on password toggle | **Medium** | Icon-only button |
| No CAPTCHA on admin login | **Low** | Different security UX — acceptable |
| "Back to main login" uses `<a>` with `color: var(--text-muted)` | **Low** | Should use Next.js `<Link>` |

#### Proposed Improvements
- Use `.alert-danger` for error banner
- Use shared password toggle component
- Add `aria-hidden` to decorative emoji
- Add `aria-label` to password toggle
- Use Next.js `<Link>` for navigation links
- Use CSS variables for any remaining hardcoded values
- Add keyboard shortcut setup (Enter submits form — already works)

---

## Phase 2: Back-Office Pages

These pages serve shopkeepers, delivery agents, and admins. They have already received some improvements per the audit report, but many sub-pages need review.

---

### 2.1 Admin Shops (`/admin/shops/page.tsx`)

**File:** `app/admin/shops/page.tsx`
**Status:** ⏳ Pending Review

#### Pre-Review Checklist
- [ ] Read and assess current state
- [ ] Identify inline styles vs CSS classes
- [ ] Check for scoped keyframes
- [ ] Check mobile responsiveness
- [ ] Check touch targets
- [ ] Check accessibility (labels, focus states)
- [ ] Check color consistency with design system

---

### 2.2 Admin Agents (`/admin/agents/page.tsx`)

**File:** `app/admin/agents/page.tsx`
**Status:** ⏳ Pending Review

#### Pre-Review Checklist
- [ ] Read and assess current state
- [ ] Identify inline styles vs CSS classes
- [ ] Check for scoped keyframes
- [ ] Check mobile responsiveness
- [ ] Check touch targets
- [ ] Check accessibility
- [ ] Check color consistency

---

### 2.3 Admin Customers (`/admin/customers/page.tsx`)

**File:** `app/admin/customers/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.4 Admin Orders Detail (`/admin/orders/[id]/page.tsx`)

**File:** `app/admin/orders/[id]/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.5 Admin Plans (`/admin/plans/page.tsx`)

**File:** `app/admin/plans/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.6 Admin Plans Settings (`/admin/plans/settings/page.tsx`)

**File:** `app/admin/plans/settings/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.7 Admin Settings (`/admin/settings/page.tsx`)

**File:** `app/admin/settings/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.8 Admin Withdrawals (`/admin/withdrawals/page.tsx`)

**File:** `app/admin/withdrawals/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.9 Admin Complaints (`/admin/complaints/page.tsx`)

**File:** `app/admin/complaints/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.10 Admin Coupons (`/admin/coupons/page.tsx`)

**File:** `app/admin/coupons/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.11 Admin Revenue (`/admin/revenue/page.tsx`)

**File:** `app/admin/revenue/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.12 Admin COD Settlements (`/admin/cod-settlements/page.tsx`)

**File:** `app/admin/cod-settlements/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.13 Admin Agent Settlements (`/admin/agent-settlements/page.tsx`)

**File:** `app/admin/agent-settlements/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.14 Shopkeeper Orders (`/shopkeeper/orders/page.tsx`)

**File:** `app/shopkeeper/orders/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.15 Shopkeeper Order Detail (`/shopkeeper/orders/[id]/page.tsx`)

**File:** `app/shopkeeper/orders/[id]/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.16 Shopkeeper Products (`/shopkeeper/products/page.tsx`)

**File:** `app/shopkeeper/products/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.17 Shopkeeper Wallet (`/shopkeeper/wallet/page.tsx`)

**File:** `app/shopkeeper/wallet/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.18 Shopkeeper Plans (`/shopkeeper/plans/page.tsx`)

**File:** `app/shopkeeper/plans/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.19 Shopkeeper Profile (`/shopkeeper/profile/page.tsx`)

**File:** `app/shopkeeper/profile/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.20 Shopkeeper Complete Profile (`/shopkeeper/complete-profile/page.tsx`)

**File:** `app/shopkeeper/complete-profile/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.21 Delivery Orders (`/delivery/orders/page.tsx`)

**File:** `app/delivery/orders/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.22 Delivery Order Detail (`/delivery/orders/[id]/page.tsx`)

**File:** `app/delivery/orders/[id]/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.23 Delivery Wallet (`/delivery/wallet/page.tsx`)

**File:** `app/delivery/wallet/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.24 Delivery Profile (`/delivery/profile/page.tsx`)

**File:** `app/delivery/profile/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.25 Customer Care (`/customer/care/page.tsx`)

**File:** `app/customer/care/page.tsx`
**Status:** ⏳ Pending Review

---

### 2.26 Customer Order Detail (`/customer/orders/[id]/page.tsx`)

**File:** `app/customer/orders/[id]/page.tsx`
**Status:** ⏳ Pending Review

---

## Phase 3: Cross-Cutting Fixes & Component Extraction

These are shared patterns that appear across multiple pages. They should be extracted into reusable components to ensure consistency and reduce code duplication.

---

### 3.1 Extract CAPTCHA Component

**Current state:** `CaptchaDisplay` + `generateCaptcha` duplicated in 3+ files:
- `app/login/customer/page.tsx`
- `app/login/shopkeeper/page.tsx`
- `app/login/delivery/page.tsx`

**Proposed:** Single shared component at `components/shared/Captcha.tsx`

**Improvements:**
- Single source of truth
- Accessibility: `aria-label` on refresh button, `aria-live` on display
- Configurable length, color scheme
- Better visual styling with CSS classes

---

### 3.2 Extract Password Visibility Toggle

**Current state:** SVG paths for eye/eye-off duplicated in 6+ files

**Proposed:** Single shared component at `components/shared/PasswordToggle.tsx`

**Improvements:**
- Single source of truth
- Consistent `aria-label` ("Show password" / "Hide password")
- Consistent sizing, colors via CSS variables

---

### 3.3 Extract Forgot Password Modal

**Current state:** Same modal implementation in 3 login files

**Proposed:** Single shared component at `components/shared/ForgotPasswordModal.tsx`

**Improvements:**
- Single source of truth
- Uses globals.css `.modal-overlay` and `.modal` classes
- Consistent styling with design system
- Proper focus trapping and Escape key handling

---

### 3.4 Extract Auth Header Pattern

**Current state:** Back button + logo header duplicated across all auth pages

**Proposed:** Single shared component at `components/shared/AuthHeader.tsx`

**Improvements:**
- Single source of truth
- Consistent spacing and sizing
- Proper accessibility
- Configurable back URL

---

### 3.5 Remove Duplicate `@keyframes spin`

**Current state:** `@keyframes spin` defined in 12+ files despite being in `globals.css`

**Action:** Remove all local `@keyframes spin` definitions and use `.spin` class or `animation: spin` reference from globals.css

---

### 3.6 Premium Design System Phase 2

**Current state:** Premium classes exist in globals.css (`.glass-premium`, `.gradient-premium`, `.card-3d`, `.skeleton-premium`, etc.) but are not used anywhere

**Proposed:** Apply premium design system selectively to key pages:
- Splash screen: `.glass-premium` background
- Role selection: `.gradient-premium` accents
- Login pages: subtle glass effects on cards
- Status page: premium skeleton for loading states
- Buttons: `.btn-premium` where appropriate

---

### 3.7 Accessibility Pass

| Pattern | Files Affected | Fix |
|---------|---------------|-----|
| Emoji icons without `aria-hidden` | All pages | Add `aria-hidden="true"` to decorative emojis |
| Icon-only buttons without `aria-label` | All pages | Add descriptive `aria-label` |
| Color-only status indicators | admin, shopkeeper, delivery | Ensure text accompanies color |
| Missing form label associations | Login/register pages | Add `<label htmlFor="...">` or `aria-label` |
| Keyboard focus indicators | All pages | Already handled by `:focus-visible` in globals.css ✅ |

---

## Summary: Page Count by Phase

| Phase | Pages | Status |
|-------|-------|--------|
| Phase 1: Auth & Onboarding | 13 | 🔴 Ready — pending per-page analysis |
| Phase 2: Back-Office | 24 | 🟡 Need initial review |
| Phase 3: Cross-Cutting | 7 tasks | 🟡 Some depend on Phase 1 completion |
| **Total** | **37 pages + 7 tasks** | |

---

## Working Process

For each page, the workflow is:

1. **Analyze** — Read the file, identify UX problems
2. **Explain** — Present findings with severity ratings
3. **Propose** — Suggest specific improvements with rationale
4. **Approve** — User gives go-ahead
5. **Implement** — Apply changes following the hard rules
6. **Verify** — Confirm page loads and functions correctly

---

## Confirmation

**No business logic will be modified.**

The following will NOT be changed:
- ✅ API routes
- ✅ Database schema / Supabase queries
- ✅ Authentication flows
- ✅ Payment flows
- ✅ Order workflows
- ✅ Delivery workflows
- ✅ Shopkeeper workflows
- ✅ Admin workflows
- ✅ Permissions / RLS
- ✅ Backend functionality

All changes are purely UI/UX:
- Layout, spacing, typography refinements
- Color, shadow, border radius harmonization
- Animation and transition improvements
- Mobile responsiveness fixes
- Accessibility enhancements
- Empty/loading/error state improvements
- Component consistency
