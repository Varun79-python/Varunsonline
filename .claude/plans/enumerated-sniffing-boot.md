# Shopkeeper Flow Fix: Correct Redirect After Login

## Context

**Problem:** After a shopkeeper logs in, they're being incorrectly redirected to the register page instead of the documents upload page. Additionally, after approval, the dashboard incorrectly shows "No Shop Registered" with a register button, creating a loop.

**Root Causes:**
1. **Login redirect logic flaw** (lines 111-145 in `/app/login/shopkeeper/page.tsx`): The current flow checks documents first, then shop. If docs exist but shop record is missing, it redirects to register page instead of documents page.
2. **Dashboard query error handling** (line 75 in `/app/shopkeeper/page.tsx`): Uses `.single()` without error handling, causing silent failures when query returns no rows.

**Reference:** Swiggy/Zomato flow:
- Login → Check Shop Registration Status
  - Not registered → Show shop registration form
  - Registered, no docs → Show documents upload page
  - Registered, docs submitted → Show verification status (via `/login/status`)
  - Approved → Show dashboard

## Proposed Fix

### 1. Fix Login Page Redirect Logic (PRIMARY)
**File:** `/app/login/shopkeeper/page.tsx` (lines 111-145)

**Current Flow (WRONG):**
```
1. Check if docs exist → if not, redirect to documents page
2. Check if shop exists → if not, redirect to register page ← BUG: Wrong redirect!
3. Check if approved & active → if not, redirect to status page
4. Redirect to dashboard
```

**Problem:** Docs check happens first. If docs exist but shop is missing/not found, it still tries to redirect to register instead of re-directing user to documents page.

**New Flow (CORRECT):**
```
1. Check if shop exists → if not, redirect to /login/shopkeeper/register
2. Check if docs exist → if not, redirect to /login/shopkeeper/register/documents
3. Check if shop.is_approved && shop.is_active → if not, redirect to /login/status
4. Redirect to /shopkeeper (dashboard)
```

**Code Changes:**
- Move shop existence check BEFORE documents check (lines 124-135 move before 111-122)
- Keep approval check after docs check (lines 137-142 unchanged)
- Rewrite lines 111-145 with correct sequencing

### 2. Fix Dashboard Query Error Handling (SECONDARY)
**File:** `/app/shopkeeper/page.tsx` (line 75)

**Current (Missing error check):**
```typescript
const { data: shopData } = await supabase.from('shops').select('*').eq('owner_id', user.id).single()
if (!shopData) { setNoShop(true); setLoading(false); return }
```

**New (With error handling):**
```typescript
const { data: shopData, error: shopError } = await supabase.from('shops').select('*').eq('owner_id', user.id).single()
if (shopError || !shopData) { setNoShop(true); setLoading(false); return }
```

## Critical Files to Modify

1. **`/app/login/shopkeeper/page.tsx`** (lines 111-145)
   - Reorder shop check BEFORE docs check
   - Fix redirect logic to match Swiggy/Zomato pattern

2. **`/app/shopkeeper/page.tsx`** (line 75)
   - Add error handling for `.single()` query

## Files Already Correct (No Changes Needed)

- **`/app/login/status/page.tsx`** - Already handles shopkeeper flow correctly
  - Shows pending approval status
  - Redirects to dashboard when approved
  - Handles document rejection

## Implementation Steps

1. Modify `/app/login/shopkeeper/page.tsx`:
   - Lines 124-135 (shop check) → Move to lines 111-120
   - Lines 111-122 (docs check) → Move to lines 121-135
   - Update redirect URLs to match
   
2. Modify `/app/shopkeeper/page.tsx`:
   - Line 75: Add `error` to destructuring
   - Line 77: Add shopError check to condition

3. Test the flow:
   - New registration → After login, see documents page (not register)
   - After docs upload → Login should show status page (via `/login/status`)
   - After approval → Login should show dashboard
   - Dashboard load → No "No Shop Registered" errors

## Test Scenarios

1. **New user registration flow:**
   - Fill register form → Should redirect to documents upload page after login ✓

2. **After documents uploaded:**
   - Login again → Should redirect to `/login/status` showing "pending approval" ✓

3. **After admin approves:**
   - Login → Should redirect to `/shopkeeper` dashboard ✓
   - Dashboard should display shop data without errors ✓

4. **Edge case - Logged in user revisiting register:**
   - If user already logged in and visits `/login/shopkeeper/register`
   - Register page should properly redirect to documents if needed ✓
