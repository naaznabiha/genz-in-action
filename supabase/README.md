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
   (Add the eight `20261021…` versions too once you have run the Phase 2 files.)
4. Check `supabase migration list` shows local and remote in sync.
5. From then on, create new migrations with `supabase migration new <name>`.

`checks/` is not read by the CLI. Keep running those scripts manually (or via `psql`).
