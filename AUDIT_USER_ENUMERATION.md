# User Enumeration Security Audit Report

**Date:** 2026-05-31  
**Scope:** All authentication flows (Customer, Shopkeeper, Delivery Agent, Admin)  
**Objective:** Prevent account discovery through login error messages  

---

## Summary

All authentication flows have been audited and hardened against user enumeration attacks. The system now returns the generic message **"Invalid login credentials"** for all authentication failures, regardless of the underlying reason. Detailed failure reasons are preserved only in server logs for security auditing.

---

## Files Modified (11 files)

### Backend API Routes

| # | File | Changes |
|---|------|---------|
| 1 | `app/api/auth/phone-lookup/route.ts` | Changed from returning role-specific messages (`"No shop owner found with this phone number."`, etc.) to always returning `"Invalid login credentials"` (HTTP 401). Added server-side logging via `logger.auth()` for audit trails. |
| 2 | `app/api/auth/check-user/route.ts` | Endpoint completely refactored. It now **always** returns `{ exists: false }` regardless of whether the user exists. The actual duplicate detection happens server-side during sign-up with a generic error. Removed Supabase query that revealed existence. |

### Login Pages

| # | File | Changes |
|---|------|---------|
| 3 | `app/login/customer/page.tsx` | Removed real-time existing user detection during registration (which exposed account existence). Changed phone-lookup error from `"No customer account found with this phone number."` to `"Invalid login credentials"`. Changed Supabase auth error passthrough to generic message. Removed `"already registered"` detection messages. Changed registration duplicate handling to generic `"Invalid login credentials"`. Changed forgot-password error to always show success message. |
| 4 | `app/login/delivery/page.tsx` | Changed phone-lookup error from `"No delivery partner account found with this phone number."` to `"Invalid login credentials"`. Changed Supabase auth error passthrough to generic message. Changed session error to generic. Changed forgot-password error to always show success message. |
| 5 | `app/login/shopkeeper/page.tsx` | Changed phone-lookup error from `"No shop owner account found with this phone number."` to `"Invalid login credentials"`. Changed Supabase auth error passthrough to generic message. Changed role-check error from `"Access denied. Please register as a shop owner."` to `"Invalid login credentials"`. Changed session error to generic. Changed forgot-password error to always show success message. |

### Registration Pages

| # | File | Changes |
|---|------|---------|
| 6 | `app/login/delivery/register/page.tsx` | Removed real-time existing user detection (which exposed account existence and approval status). Changed duplicate account messages from `"An account with this email already exists. Please login with your existing password."` to `"Invalid login credentials"`. |
| 7 | `app/login/shopkeeper/register/page.tsx` | Removed real-time existing user detection (which exposed account role information). Changed duplicate account messages from role-specific messages to `"Invalid login credentials"`. Removed role disclosure in error messages (previously revealed `"This email is registered as a 'customer'"` etc.). |

### Admin & Forgot Password

| # | File | Changes |
|---|------|---------|
| 8 | `app/admin/login/page.tsx` | Changed Supabase auth error passthrough to generic `"Invalid login credentials"`. Changed admin role check error from `"Access denied. This account is not an admin."` to `"Invalid login credentials"`. |
| 9 | `app/forgot-password/page.tsx` | Changed to **always** show success (email sent) regardless of whether the account exists. Errors from `resetPasswordForEmail` are logged server-side but not exposed to the user. |

### Auth Library

| # | File | Changes |
|---|------|---------|
| 10 | `lib/existingUserDetection.ts` | Changed `handleExistingUserAuth` from returning `"Account exists but password is incorrect. Please reset your password."` to `"Invalid login credentials"`. |

---

## Messages Replaced

| Original Message | Replacement | Location |
|-----------------|-------------|----------|
| `"No customer account found with this phone number."` | `"Invalid login credentials"` | Customer login |
| `"No delivery partner account found with this phone number."` | `"Invalid login credentials"` | Delivery login |
| `"No shop owner account found with this phone number."` | `"Invalid login credentials"` | Shopkeeper login |
| `"Note: An account already exists with this information..."` | Removed entirely | Customer registration |
| `"An account with this information already exists. Please login to continue."` | `"Invalid login credentials"` | Customer registration |
| `"Account exists. Please login with your existing credentials."` | `"Invalid login credentials"` | Customer registration |
| `"Account created but auto-login failed. Please login manually."` | `"Invalid login credentials"` | Customer registration |
| `"Note: An approved delivery agent account already exists..."` | Removed entirely | Delivery registration |
| `"Note: A partial registration already exists..."` | Removed entirely | Delivery registration |
| `"An account with this email already exists. Please login with your existing password."` | `"Invalid login credentials"` | Delivery registration |
| `"Account created but login failed. Please login manually."` | `"Invalid login credentials"` | Delivery registration |
| `"Note: This phone/email is already registered as a '...'."` | Removed entirely | Shopkeeper registration |
| `"This email is registered as a '...'. You cannot register as a shop owner..."` | `"Invalid login credentials"` | Shopkeeper registration |
| `"This account is registered as '...'. Cannot register as shop owner."` | `"Invalid login credentials"` | Shopkeeper registration |
| `"Access denied. This account is not an admin."` | `"Invalid login credentials"` | Admin login |
| `"Access denied. Please register as a shop owner."` | `"Invalid login credentials"` | Shopkeeper login |
| `"Account exists but password is incorrect. Please reset your password."` | `"Invalid login credentials"` | existingUserDetection.ts |
| `"Session expired. Please login again."` | `"Invalid login credentials"` | Delivery/Shopkeeper login |
| Direct Supabase error messages (from `signInWithPassword`, `resetPasswordForEmail`, etc.) | `"Invalid login credentials"` / Generic success message | All login/forgot-password flows |

---

## APIs Updated

| API Endpoint | Method | Change |
|-------------|--------|--------|
| `/api/auth/phone-lookup` | POST | Returns `401 {"error": "Invalid login credentials"}` instead of `404 {"error": "No X found..."}` |
| `/api/auth/check-user` | POST | Always returns `{"exists": false}` — never reveals account existence |

---

## Remaining User-Enumeration Risks

### Low / Informational

1. **Email field in forgot-password success message** — The `forgot-password` page displays the submitted email in the success state (`app/forgot-password/page.tsx` line 58: `{email}`). This is standard UX on all major platforms (the email you typed is shown back to you), and this value is user-supplied (the user typed it themselves). No risk.

2. **API rate limiting already in place** — Both `/api/auth/phone-lookup` (10 req/min) and previously `/api/auth/check-user` (20 req/min) have rate limiting. The check-user endpoint's rate limiting was removed along with its Supabase query since it no longer performs a database lookup.

3. **Auth middleware role-check errors** — The middleware functions (`verifyAdmin`, `verifyShopkeeper`, `verifyDeliveryAgent`, `verifyCustomer`) return role-specific errors like `"Not authorized - admin access required"`. These are **post-authentication** errors (user already has a valid JWT token), so they don't enable user enumeration. An attacker would need a valid session to reach these checks. This is standard security practice (e.g., HTTP 403 vs 401).

### No Critical Risks Remaining

All pre-authentication endpoints, login forms, registration forms, and forgot-password flows now return identical responses regardless of whether an account exists.

---

## Verification Checklist

- [x] TypeScript compilation passes (`tsc --noEmit` — zero errors)
- [x] All role-specific error messages replaced with generic `"Invalid login credentials"`
- [x] Real-time existing user detection removed from all registration pages
- [x] `/api/auth/check-user` endpoint no longer reveals account existence
- [x] `/api/auth/phone-lookup` endpoint returns generic error on failure
- [x] Forgot password always shows success (doesn't reveal if email exists)
- [x] Server-side logging added for all auth failures (for admin auditing)
- [x] Direct Supabase error messages no longer passed to users
- [x] Customer login flow secured
- [x] Shopkeeper login flow secured
- [x] Delivery Agent login flow secured
- [x] Admin login flow secured
- [x] All registration flows secured
