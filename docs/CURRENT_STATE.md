# Current state

_Last updated: 2026-10-18 (Phase 1 implementation)_

Phase numbering follows the code comments and `decisions.md`:
**Phase 0** = foundation + UI kit (spec M0) · **Phase 1** = auth slice (spec M1 + M2) ·
**Phase 2** = profile & dashboard (spec M3/M4) · later phases follow spec §15.

## Phase 0: foundation (done)

| Item | Status | Evidence |
|---|---|---|
| Expo SDK 54, RN 0.81, TS strict, Expo Router 6 | ✅ | `mobile/package.json`, `tsconfig.json` |
| Five-tab shell + UI kit (tokens, fonts, Button, TextField, Screen, Toast, icons) | ✅ | `mobile/components/ui/*`, `app/dev/ui-kit.tsx` |
| `npm run typecheck`, `npm run lint` | ✅ pass | Re-run 2026-10-18 |
| Android JS bundle (`expo export --platform android`) | ✅ builds | Re-run 2026-10-18 |
| App opens in Expo Go on an Android phone | ⚠️ not re-verified by the agent | Needs a device: run `npx expo start` |
| Git baseline | ✅ | commit `a6f2c21` on `main` |
| `.env` ignored, client-safe key only | ✅ | `git check-ignore mobile/.env` |

## Phase 1: authentication slice (implemented, awaiting device + backend testing)

**Code (mobile/)**
- Root session gate with `Stack.Protected` (`app/_layout.tsx`): signed-out users get the `(auth)` group,
  signed-in users get `(tabs)`. Revoked or expired sessions route back to auth automatically.
- `(auth)` screens: onboarding (Continue/Skip, persisted), welcome, signup (live username availability,
  strength meter), login, verify-email (6-digit code, resend with cooldown), forgot-password,
  reset-code, new-password (checklist, signs out other devices), password-updated.
- Terms / Privacy viewer (`app/legal/[doc].tsx`). It shows **draft placeholder text** until legal supplies
  the final documents.
- TanStack Query added (`lib/query-client.ts`). The profile is loaded with `useMyProfile()`.
- Home shows "Hi, {first name}" and Profile shows an account card with **Log out**. Both are still
  placeholders for Phase 2.
- Google/Apple buttons are shown **disabled** ("coming soon") until providers are configured (FR-05).

**Database (supabase/)**: see `supabase/README.md` for the run order.
- `profiles` table, case-insensitive unique usernames, column-level privileges, RLS.
- A signup trigger creates the profile. There's a username-availability RPC and a backfill for existing users.
- Tested by the agent on a local PostgreSQL 16 with a stubbed `auth` schema: all migrations applied
  twice (idempotent), all verify checks PASS, all 13 two-user RLS tests PASS, signup trigger accepts
  valid / rejects duplicate and invalid usernames / generates a username when none is given.
  **Not yet run on the real Supabase project.**

**Verified by the agent without a live backend:** typecheck, lint, Android bundle, and a web build
clicked through in headless Chromium: onboarding → welcome → signup validation → login → forgot
password → network-error states → legal pages. A faked restored session was used to check session
restore → Home greeting → Profile card → Log out → back to Welcome, and that protected routes are
blocked after logout.

**Not verified yet (needs you):** everything that talks to the real Supabase project, and everything on
a physical Android device. Use `docs/phase-1-acceptance-tests.md`.

## Known gaps / follow-ups

- Two prototype copies exist: `design-reference/` (older, Sep 2026, referenced by `constants/theme.ts`)
  and `reference/figma-prototype/` (newer, includes communities and reset-completion screens). Phase 1
  screens follow the newer one. Decide which one to keep.
- Web only: after a protected-route redirect the browser URL can show `/forgot-password` while the
  correct screen (Welcome/Home) is displayed. This is an Expo Router web quirk; native is unaffected
  as far as the agent could test. Web is not a target platform.
- If the app is closed between entering a valid reset code and setting a new password, the user is
  signed in on next launch (they proved control of the email). They can still change the password
  later in Settings (Phase 2).
- Profile tags at signup (spec §5.2) are deferred to Phase 2 (open decision: tags vs "Primary Cause").
- Recording Terms acceptance (`terms_acceptances`) is deferred until legal versions exist (D12).
- `docs/PRODUCT_SPEC.md` and root `AGENTS.md` are empty. The spec lives in `docs/GenZ-in-Action-Spec-v2.0.docx`.
