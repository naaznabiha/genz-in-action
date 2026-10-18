# Decision log

| # | Date | Decision | Status |
| --- | --- | --- | --- |
| D1 | 2026-10-18 | Stay on **Expo SDK 54** for Phases 0–2 so the app runs in store Expo Go on Android. Schedule a deliberate SDK upgrade checkpoint before Phase 6 (communities). | Agreed |
| D2 | 2026-10-18 | Git repo at the project root; Figma Make web prototype moved to `design-reference/`; Expo app stays in `mobile/`. No Git LFS. | Agreed |
| D3 | 2026-10-18 | App identity (provisional, change before first store build): name **GenZ in Action**, slug `genz-in-action`, scheme `genzinaction`, Android package / iOS bundle ID `com.genzinaction.app`. | Provisional |
| D4 | 2026-10-18 | Dark-only UI (`userInterfaceStyle: "dark"`), matching the prototype. | Agreed |
| D5 | 2026-10-18 | Password reset uses a 6-digit email code (`type: recovery`) rather than a deep link, so it works in Expo Go. | Implemented in Phase 1 — confirm |
| D6 | 2026-10-18 | Design system: Plus Jakarta Sans 700/800 (display) + Inter 400–700 (body) via `@expo-google-fonts`, imported per weight so only 6 font files ship. Prototype `font-black` (900) maps to Jakarta 800. Icons are the prototype SVG paths via `react-native-svg`. | Agreed |
| D7 | 2026-10-18 | TanStack Query is added with the first real server query (Phase 1/2), not before, so no unused dependency is installed. | Agreed |
| D8 | 2026-10-18 | App icon / adaptive icon / splash generated from the logo mark (hi-res Gemini artwork + background-removed alpha). Replace with designer-supplied exports before store release if available. | Provisional |
| D9 | 2026-10-18 | Supabase session persisted in **AsyncStorage** on native (Supabase's documented React Native approach; SecureStore's ~2 KB value limit is too small for a session). Revisit an encrypted-storage wrapper in M11 hardening. Onboarding flag also in AsyncStorage (non-sensitive). | Proposed — please confirm |
| D10 | 2026-10-18 | Signup email verification also uses a 6-digit code (`verifyOtp type: email`), consistent with D5. Requires `{{ .Token }}` in the Supabase "Confirm signup" template. | Proposed — please confirm |
| D11 | 2026-10-18 | `profiles` stores identity fields only. Follower counts, impact points, tags and badges are derived from their own tables in later phases (spec §10, §13), so the unused pre-Phase-1 `Profile` fields (`cause`, `website`, `*_count`, `impact_points`, `is_verified`) were removed. | Proposed — please confirm |
| D12 | 2026-10-18 | Signup shows a Terms/Privacy acknowledgement with links to draft pages. Storing a versioned `terms_acceptances` record is deferred until legal provides versioned documents (spec §18). | Proposed — please confirm |
| D13 | 2026-10-18 | Database changes are plain SQL files in `supabase/migrations/` (CLI-compatible names), run manually in the SQL Editor; read-only checks in `supabase/checks/`. See `supabase/README.md`. | Proposed — please confirm |
| D14 | 2026-10-18 | Username rules: stored lowercase, 3–30 chars `a-z 0-9 _`, case-insensitive unique index, enforced in the database and the signup trigger; availability via `is_username_available` RPC. | Proposed — please confirm |

## Open decisions

Resolved in Phase 1: Supabase setup (D13), session storage (D9). Still open: profile tags vs "Primary Cause", post model fields, petition/RSVP/"Take action" scope, prototype-only features (Menu, Projects Hub, Meetings, Resources, Member Directory, DMs), impact scoring.
