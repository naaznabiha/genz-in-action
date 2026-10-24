# Supabase — database changes and dashboard setup

This folder holds every database change as a plain SQL file you can run by hand in
**Supabase Dashboard → SQL Editor**. No Supabase CLI or Docker is needed.

```
supabase/
├── migrations/   ← schema changes. Run each file ONCE, in filename order.
│   ├── 20261018120000_shared_utilities.sql
│   ├── 20261018120100_profiles.sql
│   ├── 20261018120200_profile_signup_trigger.sql
│   └── 20261018120300_backfill_missing_profiles.sql
└── checks/       ← read-only inspection / test scripts. Safe to run any time.
    ├── 00_preflight_inspect.sql
    ├── 10_verify_phase1.sql
    └── 20_rls_smoke_test.sql
```

**Rules for this folder**

- One change per migration file. Name: `YYYYMMDDHHMMSS_short_description.sql` (Supabase CLI format).
- Never edit a migration that has already been run on a shared database. Add a new file instead.
- Every migration states its dependencies, whether it is safe to re-run, and whether it is destructive.
- `checks/` files never change data. The smoke test makes changes inside a sub-transaction and always rolls them back.

---

## Phase 1: what to run, in order

Open **SQL Editor → New query** for each step. Paste the **whole file**, click **Run**, and check the result
before going on. If a step shows an error, stop. Postgres runs a multi-statement script sent as one
request as a single transaction, so a failing file should leave nothing behind. I confirmed this
against Postgres directly, not against the dashboard SQL Editor, so re-run
`checks/00_preflight_inspect.sql` to confirm the state before retrying.

| # | File | Kind | Depends on | What you should see |
|---|------|------|-----------|---------------------|
| 0 | `checks/00_preflight_inspect.sql` | read-only | — | A table of checks. All `OK`/`INFO`. **If any row says `EXISTS`, stop** and share the `detail` column; something with the same name already exists. |
| 1 | `migrations/20261018120000_shared_utilities.sql` | schema | — | "Success. No rows returned." |
| 2 | `migrations/20261018120100_profiles.sql` | schema | 1 | Success. A notice "policy … does not exist, skipping" is normal on the first run. |
| 3 | `migrations/20261018120200_profile_signup_trigger.sql` | schema | 2 | Success. |
| 4 | `migrations/20261018120300_backfill_missing_profiles.sql` | data (insert-only) | 2 | Success. Creates profiles only for auth users that don't have one. |
| 5 | `checks/10_verify_phase1.sql` | read-only | 1–4 | 15 rows, **all `PASS`**. |
| 6 | *Dashboard steps D1–D5 below* | manual | — | — |
| 7 | Create **two** test accounts in the app | manual | 1–6 | Both reach the Home tab. |
| 8 | `checks/20_rls_smoke_test.sql` | test (rolled back) | 7 | 13 rows, **all `PASS`**. `SKIPPED` means fewer than two accounts exist. |

All migration files are safe to re-run: they use `IF NOT EXISTS` / `CREATE OR REPLACE`, and they only drop
the two policies they recreate. Re-running converges on the same state and never deletes data.

### What the Phase 1 schema contains

- **`public.profiles`**: one row per `auth.users` row. It holds `username` (lowercase, 3–30 of `a-z 0-9 _`,
  case-insensitively unique), `display_name` (1–50), `bio` (≤160), `avatar_url`, `location` (≤80),
  `is_private`, `created_at` (the "Joined" date) and `updated_at` (maintained by a trigger).
- **Privileges.** Signed-out (`anon`) visitors have no table access. Signed-in users can read profiles
  and can update only their own row, and only the editable columns. Nobody can INSERT or DELETE profiles
  through the API.
- **`on_auth_user_created` trigger.** It creates the profile from the `username`/`display_name` the app
  sends at signup. A taken or invalid username rejects the signup. If no username is sent (future
  Google/Apple sign-in), it generates `user_<12 hex>`.
- **`is_username_available(text)` RPC.** An exact, case-insensitive availability check the signup form
  can call while signed out.

---

## Phase 2: what to run, in order

**Status: APPLIED to the Supabase project on 2026-10-21** (via the SQL Editor, all eight files in
one transaction, in the order below). On the live project afterwards: preflight clean beforehand (no
conflicting objects, 2 users / 2 profiles), `30_verify_phase2.sql` **23/23 PASS**,
`40_rls_smoke_test_phase2.sql` **40/40 PASS** (on the two real accounts, rolled back), and
`10_verify_phase1.sql` **15/15 PASS**. For a fresh project, run:

| # | File | Kind | Depends on | What you should see |
|---|------|------|-----------|---------------------|
| P0 | `checks/05_preflight_phase2.sql` | read-only | Phase 1 | Row 0 `OK`; every other row `OK`. **If a row says `EXISTS`** and you did not run a Phase 2 file before, stop and compare. |
| P1 | `migrations/20261021100000_profile_tags.sql` | schema + seed | Phase 1 | Success (notices "policy … does not exist, skipping" are normal). |
| P2 | `migrations/20261021100100_user_settings.sql` | schema + insert-only backfill | Phase 1 | Success. |
| P3 | `migrations/20261021100200_avatars_storage.sql` | storage bucket + policies | — | Success. If it fails with *must be owner of table objects*, see the note below. |
| P4 | `migrations/20261021100300_profile_avatar_path.sql` | schema (adds a column) | P3 | Success. |
| P5 | `migrations/20261021100400_update_my_profile_rpc.sql` | function | P1, P4 | Success. |
| P6 | `migrations/20261021100500_activity_ledger.sql` | schema | Phase 1 | Success. |
| P7 | `migrations/20261021100600_badges.sql` | schema | Phase 1 | Success. |
| P8 | `migrations/20261021100700_impact_stats.sql` | schema + function | P6 | Success. |
| P9 | `checks/30_verify_phase2.sql` | read-only | P1–P8 | 23 rows, **all `PASS`**. |
| P10 | `checks/40_rls_smoke_test_phase2.sql` | test (rolled back) | P9 + two accounts | 40 rows, **all `PASS`**. |
| P11 | `checks/10_verify_phase1.sql` and `checks/20_rls_smoke_test.sql` | read-only / test | — | Still all `PASS` (no Phase 1 regression). |

All Phase 2 files are safe to re-run and none deletes data. **Order matters on re-runs:** re-running a
Phase 1 file re-applies Phase 1 column grants, so afterwards re-run the Phase 2 files in order
(check 24 in `30_verify_phase2.sql` catches this).

**Storage policy note (P3).** Supabase lets the SQL Editor create policies on `storage.objects`, but
if your project refuses, create the bucket and the three policies in *Dashboard → Storage*:
bucket `avatars`, **Public**, size limit **5 MB**, allowed MIME types `image/jpeg, image/png`; then
under *Policies* add INSERT / SELECT / DELETE policies for `authenticated` using the expressions in
the migration file. Add **no UPDATE policy**. Then run `30_verify_phase2.sql`.

### What the Phase 2 schema contains

- **Tags** — `profile_tags` catalogue (8 seed tags from the prototype categories, decision D17) and
  `user_profile_tags`. Max five per user is enforced by a trigger, not just the app.
- **`user_settings`** — one row per profile (trigger + backfill), own-row read/update only.
  Holds only `notify_activity` (decision D18). Private Account stays `profiles.is_private`.
- **Avatars** — public bucket `avatars`, JPEG/PNG, 5 MB. Uploads only to `<your user id>/avatar-<digits>.jpg|png`;
  no one can overwrite or delete another user's file. `profiles.avatar_path` must point at an existing
  file in your own folder (decision D20); the old `avatar_url` column is no longer writable.
- **`update_my_profile(...)`** — saves Edit Profile atomically, as the calling user (SECURITY INVOKER).
- **Activity ledger** — `activity_event_types` (empty) and append-only `activity_events`. Only
  `record_activity_event()` can append, and only trusted triggers / `service_role` may call it.
  No events are seeded.
- **Badges** — `badges` / `user_badges`, read-only for the app, empty.
- **Impact** — `impact_scoring_versions` / `impact_event_weights` (empty, hidden from the API) and
  `get_my_impact_summary()`. With no approved formula it returns `pending_approval` and no points;
  streak and rank are always null. See `docs/impact-scoring.md`.

### Testing method used before handing these files over

Hosted Supabase blocks direct SQL `DELETE` on storage tables ("Use the Storage API instead"), so
check 26/34 in the smoke test accept that block; own-file deletion is exercised through the Storage
API by the app (Edit Profile replace/remove photo).

Same as Phase 1: a local PostgreSQL 16 with stubbed `auth` and `storage` schemas, Supabase's API
roles and default grants. All 12 migrations applied twice. Phase 1 checks 15/15 and 13/13, Phase 2 checks
23/23 and 40/40 PASS. The app's web build was also clicked through end to end (59/59 checks) against a local
stand-in for the Supabase API that runs every request as SQL, as the signed-in user, on that database.
The real project must still be verified with the steps above and `docs/phase-2-acceptance-tests.md`.

---

## Phase 3: what to run, in order

**Status: APPLIED to the Supabase project on 2026-10-21** (SQL Editor, all ten files in one transaction,
in the order below, after a clean preflight; the exact text was checksum-verified against the locally tested
script). Live results afterwards: `50_verify_phase3.sql` **20/20**, `70_rls_smoke_test_phase3.sql` **52/52**
(your two real accounts, rolled back, nothing left behind), and no regressions: Phase 1 **15/15 + 13/13**,
Phase 2 **23/23 + 40/40**.

Before applying, a second audit fixed four things in these (never-applied) files: `is_blocked_between` is
no longer callable through the API (anyone could ask whether two other people had blocked each other);
hashtag text is readable only through posts you may see (tags typed only in a private account's posts
leaked); "not found" errors use PostgREST's `PT404` (clean HTTP 404 instead of 500); and a full-text index
on post title + body was added (spec §15 M7: search indexes are created with their tables).

Ten migrations, run in filename order after Phase 2. All are safe to re-run; none deletes data.

| # | File | Kind | What you should see |
|---|------|------|---------------------|
| Q0 | `checks/45_preflight_phase3.sql` | read-only | Row 0 `OK`; every table / bucket / function row `OK`. |
| Q1 | `migrations/20261021120000_social_graph_tables.sql` | schema | Success (notices "does not exist, skipping" are normal). |
| Q2 | `migrations/20261021120100_visibility_helpers.sql` | functions + 3 policies replaced | Success. |
| Q3 | `migrations/20261021120200_posts.sql` | schema | Success. |
| Q4 | `migrations/20261021120300_post_media.sql` | schema + private bucket + storage policies | Success. |
| Q5 | `migrations/20261021120400_hashtags.sql` | schema | Success. |
| Q6 | `migrations/20261021120500_post_interactions.sql` | schema | Success. |
| Q7 | `migrations/20261021120600_notifications.sql` | schema | Success. |
| Q8 | `migrations/20261021120700_social_triggers.sql` | event types + triggers | Success. |
| Q9 | `migrations/20261021120800_post_rpcs.sql` | functions | Success. |
| Q10 | `migrations/20261021121000_follow_block_rpcs.sql` | functions + trigger | Success. |
| Q11 | `checks/50_verify_phase3.sql` | read-only | 20 rows, **all `PASS`**. |
| Q12 | `checks/70_rls_smoke_test_phase3.sql` | test (rolled back) | 52 rows, **all `PASS`** (needs two accounts). |
| Q13 | Phase 1 + 2 checks (`10`, `20`, `30`, `40`) | read-only / tests | Still all `PASS`. |

**Order on re-runs:** `20261021120100_visibility_helpers.sql` replaces the profile / tag / badge read
policies with block-aware ones. If you ever re-run a Phase 1 or Phase 2 file, re-run the Phase 3
files afterwards (check 9 in `50_verify_phase3.sql` catches this).

### What the Phase 3 schema contains

- **Social graph**: `follows`, `follow_requests`, `blocks`. Written only by `follow_user`, `unfollow_user`,
  `accept_follow_request`, `reject_follow_request`, `block_user`, `unblock_user` (spec §11 rules
  enforced inside). Blocks are visible only to the blocker.
- **Shared visibility helpers** used by every policy: own content, or not blocked and (public or
  followed). Private accounts' identity stays visible; their content does not (D29).
- **Posts**: column-level grants (no client-written counters/timestamps), "Edited" via a content-only
  `updated_at` trigger, author `ON DELETE RESTRICT` (D31).
- **Post photos**: private `post-media` bucket, own-folder uploads, no overwrites, readable only with
  the post; `post_media` row must point at an existing file in the author's folder.
- **Hashtags** detected from title/body by trigger. A hashtag's text is visible only through a post the viewer may see.
- **Search index**: full-text GIN index on `to_tsvector('simple', title || ' ' || body)` for Phase 4 search.
- **Likes / saves / comments** with trusted counters (`like_count`, `comment_count`) kept by triggers;
  one like per user per post (primary key).
- **Notifications** (like / comment / follow / follow_request / follow_accepted) and **activity events**
  (`post_created`, `post_liked`, `comment_created`, `user_followed`) created only by triggers (D32).
- **RPCs**: `create_post`, `update_post`, `get_posts` (feed / user / single / featured; one request per
  page with authors, counters, liked/saved), `get_profile_summary`, `get_my_follow_requests`,
  `get_my_blocked_users`, `get_suggested_people`.

## Phase 4: what to run, in order

**Status: APPLIED to the Supabase project on 2026-10-21** (SQL Editor, all five files in one run after a clean
preflight; the exact text was checksum-verified against the locally tested script). Live results afterwards:
`80_verify_phase4.sql` **8/8**, `90_rls_smoke_test_phase4.sql` **28/28** (your two real accounts, rolled back,
nothing left behind), and Phase 3 regressions: `50` **20/20**, `70` **52/52** (one test corrected first, see below).

Five migrations, run in filename order after Phase 3. All are safe to re-run; none changes or deletes data.

| # | File | Kind | What you should see |
|---|------|------|---------------------|
| R0 | `checks/75_preflight_phase4.sql` | read-only | Rows 1–5 `OK`; Phase 4 names `OK` (or `EXISTS` on a re-run); Postgres ≥ 12. |
| R1 | `migrations/20261021140000_search_indexes.sql` | 3 indexes | Success. |
| R2 | `migrations/20261021140100_query_posts.sql` | functions (`get_posts` replaced, same contract) | Success. |
| R3 | `migrations/20261021140200_search_rpcs.sql` | functions | Success. |
| R4 | `migrations/20261021140300_trending.sql` | function | Success. |
| R5 | `migrations/20261021140400_suggestions.sql` | functions (`get_suggested_people` replaced, same contract) | Success. |
| R6 | `checks/80_verify_phase4.sql` | read-only | 8 rows, **all `PASS`**. |
| R7 | `checks/90_rls_smoke_test_phase4.sql` | test (rolled back) | 28 rows, **all `PASS`** (needs two accounts). |
| R8 | Phase 3 checks (`50`, `70`) | read-only / test | Still all `PASS`. |

### What the Phase 4 schema contains

- **Indexes** (spec §13.1 / §15 M7, no separate search service): full-text GIN on profile
  `username || ' ' || display_name`, `lower(username)` and `hashtags.tag` prefix indexes, plus the Phase 3
  post title + body index. All use the `simple` text configuration.
- **`query_posts`**: one keyset page (never OFFSET) of posts for the feed, a profile, a category, a hashtag,
  a text search, Featured Action or **Top Actions This Week** (likes + 2 × comments, last 7 days).
  `get_posts` is now a wrapper with the same columns.
- **`search_profiles`** (exact @username → username starts with → name words), **`search_hashtags`**
  (tags starting with the text, with visible post counts), **`get_hashtag`** (hashtag feed header),
  **`follower_count`**. All paginated with keyset cursors.
- **`get_trending_hashtags`**: the documented rule (D39) — last 7 days, 3 × posts + likes + 2 × comments,
  counting only posts the viewer may see.
- **`get_people_suggestions`**: shared causes → network → popularity (D40); never yourself, people you follow
  or requested, or blocks either way. `get_suggested_people` (Home) now uses it.
- **Privacy**: every function applies the shared Phase 3 helpers (`can_view_author_content`,
  `can_see_profile`) explicitly — the same rule as the RLS policies (D41). They run as SECURITY DEFINER so
  the indexes are used before the visibility check; at 3,000 posts every call takes ≤ 11 ms in Postgres.
  `90_rls_smoke_test_phase4.sql` compares their output with what the RLS policies allow.

**Corrected test (Phase 3 `70`, row 12):** "Unattached photos stay private" counted every other object in the
first account's folder, so on your live data it also counted the photo of that account's real, visible post
(which other users are meant to see). The check now counts only photos not attached to any post. Verified live:
the other account sees its own photo, the photo of the visible post, and no unattached photo.

## Phase 5: what to run, in order

**Status: APPLIED to the Supabase project on 2026-10-24** (SQL Editor, all four files in one run after a clean
preflight; checksum-verified against the locally tested text). Live results: `94_verify_phase5.sql` **8/8**,
`96_rls_smoke_test_phase5.sql` **25/25** + 1 skipped (grouped likes need a third account; covered locally),
rolled back — your real notification kept its unread state and nothing was left behind.

Four migrations, run in filename order after Phase 4. All are safe to re-run; none deletes data.

| # | File | Kind | What you should see |
|---|------|------|---------------------|
| S0 | `checks/92_preflight_phase5.sql` | read-only | Rows 1–5 `OK`; Phase 5 names `OK` (or `EXISTS` on a re-run); Realtime `OK` or `INFO`. |
| S1 | `migrations/20261024100000_notification_rpcs.sql` | index + functions | Success. |
| S2 | `migrations/20261024100100_notifications_realtime.sql` | adds the table to Realtime | Success (does nothing where Realtime doesn't exist). |
| S3 | `migrations/20261024100200_saved_liked_posts.sql` | function | Success. |
| S4 | `migrations/20261024100300_notification_resurface.sql` | replaces `create_notification` (same signature) | Success. |
| S5 | `checks/94_verify_phase5.sql` | read-only | 8 rows, **all `PASS`**. |
| S6 | `checks/96_rls_smoke_test_phase5.sql` | test (rolled back) | All `PASS` (needs two accounts; a third enables the grouped-likes row). |

**Order on re-runs:** `20261024100300_notification_resurface.sql` replaces the Phase 3 `create_notification`.
If you ever re-run `20261021120600_notifications.sql`, re-run S4 afterwards (check 8 in `94` catches this).

### What the Phase 5 schema contains

- Notifications are still created **only** by the Phase 3 triggers (no self-notifications, nothing across a
  block, Activity Updates respected). The app can read its own rows and set `read_at` — nothing else.
- **`get_notifications`**: your notifications, newest first, 30 per page (keyset cursor). Likes on the same post
  are one item with the number of people (D43). Comment items carry the post to open and a comment excerpt.
- **`get_unread_notification_count`**: the bell badge, counted the same way as the list.
- **`mark_notification_read(key)`** / **`mark_all_notifications_read()`**: your own rows only.
- **`get_my_post_list('saved' | 'liked')`**: the Saved tab, most recently saved/liked first, only posts you can
  still see (deleted, now-private or blocked posts drop out).
- **Realtime**: `notifications` is published so the badge can update instantly; Supabase only delivers a row to
  its recipient (the same read policy).
- **Fix**: an accepted follow request notifies again if it happens a second time (D45).
- The readers apply the shared Phase 3 helpers explicitly (D41): 3,300 notifications → ~30 ms per page.

### Hosted-Supabase note

Direct SQL deletes on storage tables are blocked by Supabase ("Use the Storage API instead"). The app
deletes post photos and avatars through the Storage API; the smoke test never deletes storage rows.

---

## Manual dashboard steps (not done by any SQL file)

These are settings in the Supabase Dashboard. The SQL files cannot change them.

**D1. Email confirmation ON.** *Authentication → Sign In / Providers → Email*: keep **Email** enabled
and turn **Confirm email** ON (spec §6.1). The app handles both settings, but the spec requires
verification.

**D2. Email OTP length = 6.** On the same Email provider panel, set **Email OTP Length** to `6`. The app's
code boxes expect six digits (`EMAIL_CODE_LENGTH` in `mobile/lib/validation.ts`). If you choose another
length, change that constant to match.

**D3. Put the code in the emails** (decision D5: codes instead of links, so it works in Expo Go).
*Authentication → Emails → Templates*:

- **Confirm signup**: replace the body with something like:
  ```html
  <h2>Confirm your GenZ in Action account</h2>
  <p>Enter this code in the app:</p>
  <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
  <p>If you didn't create an account, you can ignore this email.</p>
  ```
- **Reset password**: replace the body with:
  ```html
  <h2>Reset your GenZ in Action password</h2>
  <p>Enter this code in the app:</p>
  <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
  <p>If you didn't ask to reset your password, you can ignore this email.</p>
  ```

If a template still contains only `{{ .ConfirmationURL }}`, users get a link the app can't use.

**D4. Password policy.** *Authentication → Sign In / Providers → Email* (password settings): set
**Minimum password length** to `8`. Set **Password requirements** to at least *Letters and digits*.
The app additionally asks for an uppercase letter and a number. If you pick a stricter server option,
add the matching rule to `passwordChecks()` in `mobile/lib/validation.ts`.

**D5. Email sending for testing.** Supabase's built-in email service is for light testing only. It is
heavily rate-limited and may deliver only to addresses on your Supabase organization's team. Check your
dashboard's notice under *Authentication → Emails*. To test signup with arbitrary addresses, configure
**Custom SMTP** (*Authentication → Emails → SMTP Settings*), for example with Resend or Brevo. You can
also use team-member addresses for your two test accounts.

**Never** put the `service_role` / secret key or the database password in `mobile/.env` or anywhere in the
repo. The app only needs the URL and the publishable (anon) key.

---

## Moving to the Supabase CLI later

The files already follow CLI conventions (`supabase/migrations/<timestamp>_<name>.sql`, no
`BEGIN`/`COMMIT`), so nothing needs renaming. When you adopt the CLI:

1. `supabase init`, which adds `supabase/config.toml` and keeps the existing `migrations/` folder.
2. `supabase link --project-ref <your-ref>`.
3. Tell the CLI these migrations were already applied by hand, so it doesn't run them again:
   ```
   supabase migration repair --status applied 20261018120000 20261018120100 20261018120200 20261018120300
   ```
   (Add the eight Phase 2 `202610211000…`, ten Phase 3 `202610211200…/121000`, five Phase 4 `202610211400…` and four Phase 5 `202610241000…` versions too.)
4. Check `supabase migration list` shows local and remote in sync.
5. From then on, create new migrations with `supabase migration new <name>`.

`checks/` is not read by the CLI. Keep running those scripts manually (or via `psql`).
