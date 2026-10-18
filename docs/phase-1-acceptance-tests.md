# Phase 1 acceptance tests (spec M1 + M2)

Run these on the Android development phone in Expo Go, after `supabase/README.md` steps 0–6.
Use **two different email addresses** (A and B) that can receive mail (see README step D5).
Tick each box only when you have seen the expected result yourself.

## Setup
- [ ] `cd mobile && npm install` (adds `@tanstack/react-query`) → no errors.
- [ ] `npm run typecheck` and `npm run lint` pass.
- [ ] `npx expo start` → app opens in Expo Go, no red screen.

## Onboarding / welcome (FR-01, FR-02)
- [ ] Fresh install (or clear Expo Go app data): onboarding slide 1 shows. **Continue** advances, dots update.
- [ ] Last slide shows **Let's Go**. Tapping it opens Welcome.
- [ ] Clear data again, tap **Skip** on slide 1 → Welcome.
- [ ] Close and reopen the app → Welcome shows directly, not onboarding.
- [ ] Welcome: **Terms of Service** and **Privacy Policy** links open the (draft) pages, and back returns.

## Sign up + verification (FR-03, §6.1)
- [ ] Submit an empty form → an error on every field.
- [ ] Username field lowercases input and strips symbols. After a pause it shows "@name is available".
- [ ] Weak password (e.g. `password`) → red strength bar and a "Password needs: …" error on submit.
- [ ] Valid signup with email A → "Check your email" code screen. The email arrives **with a 6-digit code**.
- [ ] Enter a wrong code → "That code is invalid or expired", boxes clear.
- [ ] **Resend code** is disabled for 60 s, then sends a new email.
- [ ] Enter the correct code → toast "Email verified — welcome!" → Home shows **"Hi, {first name}"**.
- [ ] Supabase Table Editor → `profiles` has A's row with the chosen username and display name.
- [ ] Sign up B choosing **A's username in UPPER case** → "@… is already taken" and submit is blocked.
- [ ] Sign up again with **A's email** → "An account with this email already exists".

## Login / logout / session (FR-03, §5.3, §5.4)
- [ ] Profile tab shows A's name, @username, email and join month.
- [ ] **Log out** → Welcome. Pressing Android back does not return to the app.
- [ ] Log in with the wrong password → "Email or password is incorrect."
- [ ] Log in correctly → Home.
- [ ] Fully close Expo Go and reopen → still signed in (session restore). No login screen flashes.
- [ ] Airplane mode → log out → you still end up on Welcome. Airplane mode off.
- [ ] Sign up C but **don't** enter the code. Go back and log in as C → app sends a new code and opens
      the verify screen (never the app).
- [ ] Revoked session: sign in as test user C (after verifying C), then delete C in Supabase →
      Authentication → Users. When the access token next refreshes (≤1 h, or force it by closing and
      reopening the app after it expires), the app returns to Welcome without a broken screen.

## Password reset (FR-04, D5)
- [ ] Login → **Forgot password?** → enter A's email → code screen. The email has a 6-digit code.
- [ ] Wrong code → error. Correct code → **Set a new password**. It does **not** jump into the app.
- [ ] Checklist ticks green as rules are met. **Update Password** stays disabled until all four pass.
- [ ] Reusing the old password → "Choose a password you have not used before." (if Supabase rejects it).
- [ ] Update → **Password updated** → **Continue to app** → Home.
- [ ] On a second device or emulator signed in as A before the reset: that session is signed out
      within its token lifetime (≤1 h), or on next refresh.
- [ ] Repeat the reset, but press back on "Set a new password" → you're signed out and on Login.
- [ ] Log in with the **new** password works. The old one fails.

## Security (spec §12, §16)
- [ ] Run `supabase/checks/20_rls_smoke_test.sql` with A and B created → all 13 rows PASS.
- [ ] Run `supabase/checks/10_verify_phase1.sql` → all 15 rows PASS.
- [ ] `git status` shows `mobile/.env` is **not** listed (still ignored).

## Providers (FR-05)
- [ ] Google and Apple buttons are visibly disabled with "coming soon". Tapping does nothing.
