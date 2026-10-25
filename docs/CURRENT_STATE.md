# Current state

_Last updated: 2026-10-25 (Expo SDK 58 upgrade on top of Phase 6: implemented and verified)_

Phase numbering follows the code comments and `decisions.md`:
**Phase 0** = foundation + UI kit (spec M0) · **Phase 1** = auth slice (spec M1 + M2) ·
**Phase 2** = profile & dashboard (spec M3/M4) · later phases follow spec §15.

## Phase 0: foundation (done)

| Item | Status | Evidence |
|---|---|---|
| Expo SDK 58, RN 0.88, React 19.3, TS strict, Expo Router 58 (SDK 54 until 2026-10-25, D55) | ✅ | `mobile/package.json`, `tsconfig.json` |
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

## Phase 2: profile, dashboard and settings (implemented, database applied, awaiting device testing)

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
**Applied to the Supabase project on 2026-10-21.** Live results: Phase 2 verify 23/23, two-user RLS
smoke test 40/40 (real accounts, rolled back), Phase 1 verify 15/15. (Before it was applied the app
showed raw "column … does not exist" errors; it now shows a readable setup message in that case.)

**Verified by the agent:** typecheck (including generated typed routes), lint, Android bundle; on local
PG16 with stubbed auth/storage, all 12 migrations applied twice, with Phase 2 checks 23/23 and 40/40 PASS and Phase 1
still 15/15 and 13/13. Also checked: scoring maths with a temporary approved version (rolled back), and account
deletion cascading through the append-only ledger. A web build was clicked through in headless
Chromium against a local Supabase-API stand-in executing every request as SQL as the signed-in user:
**59/59 checks**, including photo upload/replace/cleanup, a duplicate-username race rejected by the server,
persistence after reload, toggles, logout and blocked protected routes. This run found and fixed one bug:
image resizing with an implied height failed on web.

**Not verified yet (needs you):** `docs/phase-2-acceptance-tests.md` on the Android phone (gallery picker, crop, upload over mobile
data, restart persistence).

## Phase 3: core social (implemented, audited, database applied live; awaiting device testing)

Decisions taken first (your answers): D24 post fields, D25 no petition/RSVP/take-action buttons,
D26 share = text + app link, D27 Message "coming soon". Proposed for confirmation: D28, D30, D34.

**App (mobile/)**
- **Create (+ tab)**: 4-step wizard (type → content → details → preview). Includes category, title, description,
  an optional photo (resized JPEG), live hashtag preview, location, and event date (native picker; web build
  uses the browser's input). Edit reuses the wizard and guards unsaved changes.
- **Home**: impact card, Featured Action and People to Follow (shown only with real data), category chips,
  infinite feed (20/page, cursor), pull-to-refresh, skeletons, empty/error states.
- **PostCard / Post detail**: photo (private, signed URL), badges, author, Edited label, event
  date/location, highlighted hashtags. Like and save are optimistic and roll back with a message on failure;
  extra taps are ignored while a request is in flight. Share sheet. ••• Edit/Delete on own posts. Flat comments
  with edit/delete of your own.
- **Profiles**: one `ProfileView` for own and others. Real Followers/Following/post counts, the posts list,
  Follow / Requested / Following (confirm to unfollow or cancel), Message · Soon, ••• Block/Unblock, private
  lock state, and a blocked state.
- **Settings**: Follow Requests (count, accept/decline screen) and a real Blocked Users list with unblock.
  Private Account is now enforced.
- New dependency: `@react-native-community/datetimepicker 8.4.4` (SDK 54 version).

**Database (supabase/)**: 10 migrations + 3 checks (`45`, `50`, `70`). See `supabase/README.md` → Phase 3.
**Applied to the Supabase project on 2026-10-21.** Live results: Phase 3 verify 20/20 and two-user smoke test
52/52 (rolled back; nothing left behind), Phase 1 15/15 + 13/13 and Phase 2 23/23 + 40/40 (no regressions).

**Second audit (2026-10-21, before the live apply)** — the first attempt's own tests all passed, so the audit
added independent checks: a line-by-line review of all ten migrations against spec §11/§12/§13.1/§15 and
the Phase 3 brief, 20 hand-written attack probes with four accounts, and an end-to-end run through the
**real PostgREST 12** (the first run used a hand-written API stand-in, which cannot catch PostgREST behaviour).
Defects found and fixed (all in never-applied migrations, so edited in place):
1. **Security**: `is_blocked_between(a, b)` was callable by any signed-in user with any two ids, so anyone could
   learn whether two other people had blocked each other (spec: blocked people "are not told"). Now internal only.
2. **Privacy**: `hashtags` was readable by everyone, so a tag typed only in a private account's posts leaked
   to non-followers. Now readable only through posts the viewer may see.
3. **Robustness**: "user/request not found" raised SQLSTATE P0002, which PostgREST returns as HTTP 500.
   Now `PT404` → clean 404 (the app already showed a readable message; this removes false server errors).
4. **Spec gap**: §15 M7 says search indexes are created when their tables are introduced; added a full-text
   index on post title + body (used by the planner; Phase 4 must query the same expression).
Regression tests for 1, 2 and 4 were added to `50_verify_phase3.sql` (now 20) and `70_rls_smoke_test_phase3.sql` (now 52).

**Verified by the agent (local PG16 with stubbed auth/storage)**
- All 22 migrations applied twice (fresh DB). Phase 3: verify 20/20 and two-user smoke test 52/52.
  Phase 1: 15/15 and 13/13. Phase 2: 23/23 and 40/40.
- Ad-hoc checks: pagination over 45 posts gave pages of 20/20/5 with no duplicates; category filter;
  likes don't mark "Edited" while edits do; event date only on Events; suggestions exclude self.
- Web build, headless Chromium, 4 accounts (public / public / private / blocker), against a local
  Supabase-API stand-in executing each request as SQL as the signed-in user: **60/60 checks**. They cover
  create (event + photo + hashtags), edit with Edited, the feed, the featured card and suggestions,
  double-tap like = 1 like, save, failed like rolled back with a message, comments with edit, counts after
  reload, trigger-created notifications and events, public follow, private request → accept, non-follower
  blocked through the API, block both ways, unblock, deep-link path opens the post, and delete cascades
  including the photo file.
- Phase 2 suite re-run on the Phase 3 app: 59/59 (no regressions). Typecheck (typed routes), lint and the
  Android bundle all pass.
- **Audit re-run through real PostgREST 12** (web build, 4 accounts, storage stand-in enforcing bucket limits +
  storage RLS): **56/56** Phase 3 checks — create event with photo + hashtags, edit → "Edited", feed = ONE
  `get_posts` request + one batch photo-signing request (no per-post requests), 20-per-page cursor paging
  (20+20+5, no duplicates), rapid like taps = 1 like, duplicate like rejected by the primary key, comment +
  edit, save, counts and liked/saved state after reload, failed write rolls back with a message, public follow
  instant, private follow → request → accept, non-follower blocked from private posts/comments/hashtags even
  through the API, block both ways (+ third party cannot discover it), unblock from Settings, `/post/<id>` link
  opens the post, category filter, People to Follow, delete cascade incl. photo file. Phase 2 regression through
  real PostgREST: **23/23**. Featured Action verified via the API (appears once an action post has a like).

**Not verified yet (needs you)**: `docs/phase-3-acceptance-tests.md` on the phone. This covers the native
date picker, the gallery, the share sheet, and opening a shared link from another app. Note: custom-scheme
links (`genzinaction://`, `exp://`) are often not tappable in chat apps; tappable links for everyone need a web
domain (open decision).

## Phase 4: discovery (implemented, database applied live; awaiting device testing)

Decisions (your answers): D39 trending = 7 days, 3 × posts + likes + 2 × comments; D40 suggestions = shared
causes → network → popularity; keep the 8 categories. Also recorded: D41 (how the discovery functions apply
the privacy helpers) and D42 (search behaviour — proposed for confirmation).

**App (mobile/)**
- **Search** (Home 🔍, Explore search bar): one box for people, posts and #hashtags. Typing is debounced
  (300 ms, ≥ 2 characters). The **All** tab groups results into People, Hashtags and Posts (a leading `#`
  or `@` puts that group first). The **People / Posts / Tags** tabs each page 20 at a time. Recent searches
  (10) are kept on the device per account. There are loading, empty and error states.
- **Explore**: Discover (8 cause tiles → that cause's posts, paginated), Trending (ranked tags with counts +
  Top Actions This Week, paginated), People (suggested changemakers with "N causes in common" and Follow,
  paginated). Pull to refresh.
- **Hashtag feed** `/hashtag/<tag>`: header with the visible post count + paginated posts. Every highlighted
  `#tag` in a post's text or title is tappable, as are trending and search results.
- **Home**: "📈 Trending Right Now" (top 5, hidden when empty) and "People to Follow" now use the new
  ranking; both have "See all →" into Explore.
- Discovery post lists share the post cache, so likes/saves/deletes update everywhere. Follow/block refresh
  people lists and tag counts.

**Database (supabase/)**: 5 migrations + 3 checks (`75`, `80`, `90`). See `supabase/README.md` → Phase 4.
**Applied to the Supabase project on 2026-10-21** after a clean preflight, with checksum-verified text.
Live: Phase 4 verify **8/8**, two-user smoke test **28/28** (rolled back, nothing left behind); Phase 3
verify **20/20** and smoke test **52/52** after correcting one Phase 3 test (row 12 wrongly counted the photo
of a real, visible post as "unattached"; the access rule itself was right and is re-verified live).

**Performance finding fixed during the phase**: the first version used RLS for visibility. Postgres then has
to run the privacy check on every row before it may use a full-text index, so search took 230–500 ms at
3,000 posts and grew with the table. The functions now apply the same shared helpers explicitly (D41).
At 3,000 posts every call is ≤ 11 ms in Postgres; through the API with 600+ posts each is 6–62 ms.

**Verified by the agent**
- All 27 migrations applied twice on a fresh local database. Phase 4 checks 8/8 and 28/28 (on a small
  database and on 3,000 posts / 66 accounts). Phases 1–3 checks all still pass (15, 13, 23, 40, 20, 52).
- Probes with private, blocked and followed accounts: private posts and blocked users never appear in
  search, hashtag search/feeds, trending counts, Top Actions or suggestions, in either direction. Trending
  counts equal the visible posts. Suggestions exclude self, followed, requested and blocked. Operator and
  wildcard characters are harmless. Signed-out callers are refused.
- **End-to-end through real PostgREST 12 + the web build: 58/58** — username / post-word / hashtag search,
  one request per typing pause (debounce), grouped results, People tab paging 20 → 25, recent searches
  (saved, survive reload, run again, clear), tapping a `#tag` in a post opens its feed (not the post),
  Home trending and People to Follow, Explore Discover / Trending / People, follow from suggestions, like
  from search results, performance with 600+ posts. Phase 3 suite 56/56 and Phase 2 suite 23/23 still pass.
- Typecheck, lint and the Android bundle export pass.

**Not verified yet (needs you)**: `docs/phase-4-acceptance-tests.md` on the phone.

## Phase 5: notifications, saved and liked (implemented, database applied live; awaiting device testing)

Decisions (your answers): D43 likes grouped per post; D44 push deferred (spec §18). Recorded for
confirmation: D45 (notification behaviour), D46 (Saved tab, no counts on the switch).

**App (mobile/)**
- **Notifications** (Home bell): newest first, 30 per page. Unread items are tinted, have a dot and sit under
  "New (n)"; read ones under "Earlier". Tapping marks read and opens the post (like / comment), the person
  (follow / accepted request) or Follow Requests. "Mark all read". Empty state "All caught up!". Pull to refresh.
- **Bell badge** on Home: the unread count, refreshed whenever the app returns to the foreground and live through
  Supabase Realtime while the app is open.
- **Saved tab** (prototype "Activity"): Saved / Liked switch, each paginated with its own empty state. Unsaving or
  unliking removes the post at once (and restores it if the request fails).
- Community notification types will be wired up in Phase 6; unknown types already render safely.

**Database (supabase/)**: 4 migrations + 3 checks (`92`, `94`, `96`). See `supabase/README.md` → Phase 5.
**Applied to the Supabase project on 2026-10-24** (clean preflight, checksum-verified). Live: verify **8/8**,
smoke test **25/25** + 1 skipped (grouped likes need a third account), rolled back, nothing left behind.

**Found and fixed during the phase**
1. A second "your follow request was accepted" was silently dropped by the Phase 3 de-duplication, so someone who
   re-requested after unfollowing was never told. It now comes back as new (D45).
2. Reading through RLS ran the block check on every notification (215 ms for 3,300). The readers now apply the
   same rule explicitly (D41 pattern): ~30 ms per page, ~25 ms for the badge.

**Verified by the agent**
- All 31 migrations applied twice on fresh databases. Phase 5 checks 8/8 and 26/26 (three accounts) / 25 + 1
  skipped (two accounts). Every earlier check still passes (15, 13, 23, 40, 20, 52, 8, 28). Realtime migration
  tested against a database with the publication (idempotent).
- Probes with four accounts: grouping, unread count, mark read/all, blocks both ways, self-likes, follow request →
  accept, isolation (B cannot read, mark, unmark, forge or delete A's rows), Saved/Liked paging and privacy.
- **End-to-end through real PostgREST 12 + the web build: 42/42** — like/comment/follow/request from other accounts
  notify Alice; badge count; grouped likes; tapping each type opens the right screen and marks it read; badge
  refreshes on returning to the foreground; Mark all read persists after a reload; accepted request notifies
  the requester; Saved / Liked exactly match the database, newest first, 20 → 25 paging, unsave removes a post in
  ~0.1 s and stays gone; empty states. Regressions: Phase 4 58/58, Phase 3 56/56, Phase 2 23/23.
- Typecheck, lint and the Android bundle export pass.

**Not verified yet (needs you)**: `docs/phase-5-acceptance-tests.md` on the phone, including the live Realtime
badge (the local test bench has no Realtime server).

## Phase 6: communities (implemented, database applied live; awaiting device testing)

Designs: 15 boards approved as drawn (https://claude.ai/artifact/EuCAXPxDah17V3Mery6vfh). Decisions (your answers):
D48 roles, D50 uploads, D53 leave/delete, D54 scope (Projects/Meetings/Resources/Directory dropped; posts under a
"Posts" filter; stay on SDK 54 — later superseded by the SDK 58 upgrade, D55). Recorded: D47, D49. For confirmation: D51 (post audience), D52 (notifications).

**App (mobile/)**
- **Explore → Communities** (4th tab): Create a community, Invitations (Accept / Decline inline), Your communities
  with your role, Discover (every community, PUBLIC / PRIVATE · INVITE ONLY, member count), paginated.
- **Create / edit** a community: image, name 3–60, description ≤500, Public / Private (fixed after creation). You're the owner.
- **Community page**: guest (public: read + Join), invited (banner with Accept / Decline + "Members only"),
  member (Member / Share, Discussion, Content, Members, Your starred messages, About). Owner/admins can edit.
- **Discussion**: live via Supabase Realtime, newest at the bottom, 50 per page, day separators, photo/PDF
  attachments, pinned banner, long-press menu (Star, Pin for everyone — owner/admins, Copy, Delete).
- **Starred** (private), **Content** (All / Posts / Photos / Documents / Text, Add content FAB, "No longer a
  member"), **content page** (delete: author, owner, admins), **Members** (roles, Invite people sheet, pending
  invites with Cancel, ••• Make admin / Remove admin / Make owner / Remove, Leave), **hand over ownership**,
  sole-owner delete.
- **Create post → "Who is this post for?"** (Everyone or one of your communities); posts show "in <community>"
  on cards and the post page.
- **Notifications**: invites (inline Accept / Decline), accepted / declined, made admin, made owner, new
  content. The list now reads `get_notification_list`.
- New packages (in Expo Go): `expo-document-picker`, `expo-file-system`, `expo-clipboard` (SDK 58 versions since D55).

**Database (supabase/)**: 8 migrations + 3 checks (`97`, `98`, `99`). See `supabase/README.md` → Phase 6.
**Applied to the Supabase project on 2026-10-24** (clean preflight, one checksum-verified run). Live: verify
**13/13** (Realtime publication included); smoke test **33/33** (a condensed run of `99` covering owner, member, non-member, invited, admin and signed-out cases;
the storage, block, transfer and delete cases ran in the full 46/46 locally), rolled back — no communities left behind.

**Found and fixed during the phase**
1. Changing `get_notifications`' columns would have made the Phase 5 file fail on a re-run ("cannot change
   return type"); the community list is a new function (`get_notification_list`) and Phase 5's stays as it was.
2. `get_community` showed the owner's / inviter's name across a block — now hidden like every other identity.
3. "Communities" didn't fit in the Explore tab row on narrow phones — the tabs now size to their labels.

**Verified by the agent**
- All 39 migrations applied twice on fresh databases; the eight Phase 6 files also as one transaction.
  Phase 6 checks: verify 13/13, smoke 46/46 (owner, admin, member, non-member, invited, removed, blocked and
  signed-out cases), rolled back with nothing left behind. Every earlier check passes; two were updated for
  the Phase 6 rule (`50` #9, `90` #10) and still run on a pre-Phase-6 database.
- Performance at 3,000 posts / 20,000 messages: every reader ≤ 40 ms (README → Phase 6).
- **End-to-end through real PostgREST + the web build, four accounts: 55/55** — create public/private; Discover
  chips; non-member locked out of the private discussion (UI and API); join public instantly; send text and a
  PDF (size recorded by the database); member menu has no Pin; private stars; owner pins, member sees it; invite
  → notification → inline Accept → read and post; inviter notified; audience picker → post "in <community>",
  in the member's Home, not the non-member's, not openable by them; add content → members notified; leave →
  "No longer a member"; owner leave → hand over → new owner notified; sole-owner delete.
  Regressions: Phase 5 42/42, Phase 4 58/58, Phase 3 56/56 (request-count check updated: one batch request per
  page for community labels), Phase 2 23/23.
- Typecheck, lint and the Android bundle export pass (re-verified on SDK 58, below).

**Not verified yet (needs you)**: `docs/phase-6-acceptance-tests.md` on phones — especially **messages
appearing live on two phones** (the local bench has no Realtime server), real photo/PDF picking on Android, and
opening PDFs.

## Expo SDK 58 upgrade (implemented and verified; awaiting device testing)

Why: the store Expo Go moved to SDK 58 and only opens SDK 58 projects, so the SDK 54 app stopped opening.
You chose to upgrade (D55). Done one SDK at a time — 55, 56, 57, 58 — with typecheck, lint, the Android and web
builds and every browser suite at each step. No database change.

**Now**: Expo 58.0.19 · React Native 0.88 · React 19.3 · Expo Router 58 · New Architecture only.

**Code changes**
- SDK 56: Expo Router no longer uses React Navigation — imports moved to `expo-router/react-navigation` and
  `expo-router/js-tabs` (Expo's codemod), and the `@react-navigation/*` packages were removed.
- SDK 56 lint (React's new `set-state-in-effect` rule): the username availability check (Sign up, Edit Profile)
  is now one shared hook, and Explore's "See all" tab switch no longer uses an effect.
- SDK 58: the custom tab bar uses the new `emitter` / `navigateToTab`; the sign-in gate uses
  `Stack.Protected redirectTo` (first launch → onboarding, later → Welcome, signed in → Home) because
  `initialRouteName` was removed; "Discard changes?" (Edit Post, Edit Profile) uses `usePreventRemove`'s new
  `repeat()`; React Native 0.88 type fixes (list empty/footer slots, `TextInput` refs); `@types/react` 19.2.
- `npm install` is clean again (the SDK 58 date picker fixed an optional Windows peer conflict).

**Verified by the agent**
- Each step: typecheck, lint, Android bundle and web build. SDK 55, 56 and 57: all suites passed with no
  further changes.
- SDK 58 — two full runs from a cleared build cache, **246/246**: Phase 2 23/23, Phase 3 56/56,
  Phase 4 58/58, Phase 5 42/42, Phase 6 55/55, and a new SDK 58 suite 12/12 (first launch → onboarding, Skip →
  Welcome, /onboarding and protected pages redirect when they should, signed-in /welcome → Home, "Discard
  changes?" on Edit Post and Edit Profile: Keep editing stays, Discard leaves, nothing saved).
- Expo Router 58 loads each web screen's code the first time it's opened; a few browser checks now wait for
  the navigation instead of checking the URL instantly, and the "unsave is immediate" check now proves it with
  a deliberately slowed server. Phones load as before (Expo: native unchanged).
- `expo-doctor`: 18/20 — the two remaining checks need Expo's servers, which the agent's workspace can't reach.

**Not verified yet (needs you)**: open the app in **Expo Go for SDK 58** on Android, then run
`docs/phase-6-acceptance-tests.md` (live chat on two phones, photo/PDF picking) and spot-check sign up,
log in/out, Edit Profile's "Discard changes?", the tab bar and the date picker on an Event post.

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
- Delete Account is not offered yet (needs a privileged Edge Function, spec §6.1). Accounts with posts or
  comments can't be deleted from the dashboard until then (D31, intentional).
- Phase 3 was one checkpoint, not 3a/3b (D33).
- Push notifications are deferred (D44).
- Communities: link invites and join requests are deferred; privacy can't be changed after creation; content
  can't be edited in the app yet (the database allows authors to edit title/text); no unread counts per community.
- The post cards' "in <community>" label costs one extra batch request per page (readers kept their Phase 4
  columns so earlier files stay re-runnable).
- Trending/suggestion weights are fixed in SQL (D39/D40); tuning means a new migration.
- A signed-out user opening a shared link lands on Welcome and starts at Home after login (D34).
- Help & FAQ has no support contact (none defined).
- Recording Terms acceptance (`terms_acceptances`) is deferred until legal versions exist (D12).
- `docs/PRODUCT_SPEC.md` and root `AGENTS.md` are empty. The spec lives in `docs/GenZ-in-Action-Spec-v2.0.docx`.
