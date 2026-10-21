# Current state

_Last updated: 2026-10-21 (Phase 2 implementation)_

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
- (Phase 1 placeholders for Home/Profile were replaced in Phase 2; Log out moved to Settings.)
- Google/Apple buttons are shown **disabled** ("coming soon") until providers are configured (FR-05).

**Database (supabase/)**: see `supabase/README.md` for the run order.
- `profiles` table, case-insensitive unique usernames, column-level privileges, RLS.
- A signup trigger creates the profile. There's a username-availability RPC and a backfill for existing users.
- Tested by the agent on a local PostgreSQL 16 with a stubbed `auth` schema: all migrations applied
  twice (idempotent), all verify checks PASS, all 13 two-user RLS tests PASS, signup trigger accepts
  valid / rejects duplicate and invalid usernames / generates a username when none is given.
  **Live project (checked 2026-10-21, read-only, publishable key):** `profiles` exists and refuses
  signed-out reads (42501), `is_username_available` answers, email confirmation is ON, and only the
  email provider is enabled. So Phase 1 SQL has been applied. The verify/RLS scripts themselves were not run there by the agent.

**Verified by the agent without a live backend:** typecheck, lint, Android bundle, and a web build
clicked through in headless Chromium: onboarding → welcome → signup validation → login → forgot
password → network-error states → legal pages. A faked restored session was used to check session
restore → Home greeting → Profile card → Log out → back to Welcome, and that protected routes are
blocked after logout.

**Not verified yet (needs you):** everything that talks to the real Supabase project, and everything on
a physical Android device. Use `docs/phase-1-acceptance-tests.md`.

## Phase 2: profile, dashboard and settings (implemented, awaiting backend apply + device testing)

**Prerequisite audit (2026-10-21).** Nothing blocking was found. Verified: typecheck, lint and the Android bundle
on the Phase 1 commit; all Phase 1 migrations replayed on local PG16 twice (15/15 verify, 13/13 RLS);
live project has the Phase 1 schema (see above). Not verifiable by the agent: on-device behaviour and
the Phase 1 acceptance checklist (needs your phone and real email).

**App (mobile/)**
- Home: logo + "Welcome back, {display name}", Search / Notifications / Profile actions, "This Week's
  Impact" card (server-derived; "Getting started" while no formula is approved), complete-your-profile
  prompt, honest feed placeholder. Pull to refresh.
- Profile tab: photo, name, @username, tags, bio, location, join date, stats (Actions / Followers /
  Following / Impact), Actions + About tabs with empty states, Edit and Settings buttons.
- Edit Profile (`/settings/edit-profile`): gallery photo (square crop, 512 px JPEG), display name,
  username (live availability + server-side uniqueness), bio ≤160, manual location, up to 5 tags.
  Save is enabled only for a valid change. The save is atomic, and leaving with unsaved edits asks to discard.
- Settings (`/settings`): Edit Profile, Get Verified / Language marked Coming soon, Activity Updates
  switch, Private Account switch, Blocked Users (empty state), Help & FAQ, Terms, Privacy, Log Out with
  a confirmation sheet.
- `/search`, `/notifications`: honest coming-soon screens.
- New deps: `expo-image-picker ~17.0.11`, `expo-image-manipulator ~14.0.8` (D22).

**Database (supabase/)**: 8 new migrations + 3 checks. See `supabase/README.md` → Phase 2.
**Not yet applied to the Supabase project** (review first, per spec Appendix B). Until they are
applied, Phase 2 screens show "The server isn't fully set up yet…" errors instead of data.

**Verified by the agent:** typecheck (including generated typed routes), lint, Android bundle; on local
PG16 with stubbed auth/storage, all 12 migrations applied twice, with Phase 2 checks 23/23 and 40/40 PASS and Phase 1
still 15/15 and 13/13. Also checked: scoring maths with a temporary approved version (rolled back), and account
deletion cascading through the append-only ledger. A web build was clicked through in headless
Chromium against a local Supabase-API stand-in executing every request as SQL as the signed-in user:
**59/59 checks**, including photo upload/replace/cleanup, a duplicate-username race rejected by the server,
persistence after reload, toggles, logout and blocked protected routes. This run found and fixed one bug:
image resizing with an implied height failed on web.

**Not verified yet (needs you):** applying the SQL to the real project, then
`docs/phase-2-acceptance-tests.md` on the Android phone (gallery picker, crop, upload over mobile
data, restart persistence).

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
- Profile tags are editable in Edit Profile (Phase 2). Choosing them **at signup** (spec §5.2) is still deferred.
- Awaiting product decisions: D15 (no Primary Cause/Website), D17 (tag list), D18 (notification
  preferences), D19 (public avatars), and the impact formula (`docs/impact-scoring.md`).
- `profiles.avatar_url` is deprecated (read-only, unused). Drop it in a later deliberate migration.
- Delete Account is not offered yet (needs a privileged Edge Function, spec §6.1).
- Help & FAQ has no support contact (none defined).
- Recording Terms acceptance (`terms_acceptances`) is deferred until legal versions exist (D12).
- `docs/PRODUCT_SPEC.md` and root `AGENTS.md` are empty. The spec lives in `docs/GenZ-in-Action-Spec-v2.0.docx`.
