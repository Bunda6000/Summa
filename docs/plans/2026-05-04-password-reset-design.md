# Password Reset — Design

**Date:** 2026-05-04
**Scope:** Web only (mobile deep-link wiring deferred)
**Approach:** Extend `AuthScreen` view state + `useAuthStore` (Approach A)

---

## User Story

As a user who forgot my password, I want to reset it via email so I can regain access without contacting support.

---

## Architecture

The feature extends the existing auth layer without introducing new patterns:

- All logic lives in `useAuthStore` (Zustand), which wraps Supabase calls
- `AuthScreen` gains two new rendering conditions (`resetError`, `recoveryMode`) and one new view (`'forgot-password'`)
- Three new form components follow the existing `AuthForms.module.css` pattern

---

## State & Data Flow

### New state in `useAuthStore`

| Field | Type | Initial | Purpose |
|---|---|---|---|
| `recoveryMode` | `boolean` | `false` | Set `true` when Supabase fires `PASSWORD_RECOVERY` via `onAuthStateChange` |
| `resetError` | `string \| null` | `null` | Expired/invalid reset token detected from URL params on page load |

### New actions

**`requestPasswordReset(email: string): Promise<void>`**
- Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })`
- Always resolves with generic `info`: `"If an account with that email exists, a reset link has been sent."`
- Never surfaces a Supabase error to the user (satisfies no-email-leak requirement)
- Writes `sessionStorage.setItem('summa_reset_pending', '1')` so the app can distinguish a reset-expired error from a verification-expired error on return

**`updatePassword(password: string): Promise<void>`**
- Calls `supabase.auth.updateUser({ password })`
- On success: clears `recoveryMode`
- On error: surfaces error message to user

**`clearResetError(): void`**
- Clears `resetError` (used by back-to-sign-in navigation in `ResetErrorPanel`)

### `initAuth` changes

**`onAuthStateChange` handler** — add `PASSWORD_RECOVERY` branch:
```typescript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    set({ recoveryMode: true });
  }
  set({ session });
});
```

**URL param detection** — extend existing `otp_expired` check:
```
if error_code === 'otp_expired' AND sessionStorage has 'summa_reset_pending'
  → set resetError, clear sessionStorage flag
else if error_code === 'otp_expired' OR 'otp_disabled'
  → set verificationError  (existing behaviour preserved)
```

The `sessionStorage` flag is the only practical way to distinguish a reset-expired link from a verification-expired link — Supabase does not include the original flow type in the error redirect params. Covers the common same-device/browser case; cross-device edge case falls back gracefully to the verification-expired panel.

Both the module-level capture (runs before Supabase erases URL params) and the `initAuth` fallback (for test environments) must include this logic, mirroring the existing `verificationError` dual-detection pattern.

---

## UI Components

### `ForgotPasswordForm`

- Email field + "Send reset link" button
- Calls `requestPasswordReset(email)` on submit
- Shows generic `info` message from store on completion (same message for all emails)
- Shows inline validation error for malformed email (client-side only, before submitting)
- "Back to sign in" link → `onSwitchToSignIn` prop

### `ResetPasswordForm`

- New password field + confirm password field
- Client-side validation: `validatePassword` (existing util) + confirm-match check, before calling store
- Calls `updatePassword(password)` on submit
- On success: `recoveryMode` clears → `AuthScreen` transitions back to sign-in view
- On error: surfaces store error message

### `ResetErrorPanel`

- Displays: "Your password reset link has expired."
- Email field + "Send new reset link" button → calls `requestPasswordReset(email)`
- "Back to sign in" button → calls `clearResetError()` + `onDismiss` prop

### `SignInForm` change

Adds `onForgotPassword` prop (same pattern as existing `onSwitchToSignUp`). A "Forgot password?" link below the password field calls this prop.

### `AuthScreen` changes

`view` union:
```typescript
type View = 'signin' | 'signup' | 'forgot-password'
```

Rendering priority (first match wins):

| Condition | Renders |
|---|---|
| `resetError` | `<ResetErrorPanel />` |
| `recoveryMode` | `<ResetPasswordForm />` |
| `verificationError` | `<VerificationErrorPanel />` *(existing)* |
| `view === 'forgot-password'` | `<ForgotPasswordForm />` |
| `view === 'signin'` | `<SignInForm />` *(existing)* |
| `view === 'signup'` | `<SignUpForm />` *(existing)* |

---

## Testing

### Unit tests — `useAuthStore.test.ts` additions

- `requestPasswordReset` calls `supabase.auth.resetPasswordForEmail` with email + `redirectTo`
- `requestPasswordReset` sets generic `info` message regardless of Supabase response
- `requestPasswordReset` sets `sessionStorage` flag
- `updatePassword` calls `supabase.auth.updateUser({ password })`
- `updatePassword` clears `recoveryMode` on success
- `updatePassword` surfaces error message on failure
- `initAuth`: `otp_expired` + sessionStorage flag → sets `resetError`, clears flag
- `initAuth`: `otp_expired` without flag → sets `verificationError` (existing behaviour preserved)
- `onAuthStateChange` `PASSWORD_RECOVERY` event → sets `recoveryMode: true`

### Component tests — new files

- **`ForgotPasswordForm.test.tsx`**: valid email → generic success shown; invalid email format → inline error; back link calls prop
- **`ResetPasswordForm.test.tsx`**: weak password → validation error; confirm mismatch → error; valid submission → calls `updatePassword`; store error surfaced
- **`ResetErrorPanel.test.tsx`**: expired message shown; email submit calls `requestPasswordReset`; back link calls `onDismiss`
- **`SignInForm.test.tsx` addition**: "Forgot password?" link calls `onForgotPassword` prop

### E2e — `tests/e2e/password-reset.spec.ts`

- Any email → generic success message (no account-existence leak)
- Full happy path: request reset → follow link → set new password → sign in with new password
- Expired token: land with `?error_code=otp_expired` + sessionStorage flag → reset-expired panel shown; user can request new link
- Reused token: after `updatePassword`, recovery session consumed — same link fails with expired/invalid error

---

## Acceptance Criteria Mapping

| Criterion | How satisfied |
|---|---|
| Request reset → single-use email + generic message | `requestPasswordReset` always shows generic `info`; Supabase sends single-use token |
| Valid token + valid password → password updated, token invalidated | `updatePassword` calls `updateUser`; Supabase invalidates session after update |
| Expired token → clear message + can request new link | `resetError` state → `ResetErrorPanel` with resend form |
| No email leak | `requestPasswordReset` never branches on Supabase error; always same `info` message |
