# Phase 2 acceptance tests (spec M3 + M4: profile, dashboard, settings)

Run these on the Android development phone in Expo Go **after** `supabase/README.md` → *Phase 2* steps P0–P11.
Use two accounts, **A** and **B** (from the Phase 1 tests). Tick a box only when you have seen the result yourself.

## Setup
- [ ] `cd mobile && npm install` (adds `expo-image-picker`, `expo-image-manipulator`) → no errors.
- [ ] `npm run typecheck` and `npm run lint` pass.
- [ ] `npx expo start` → app opens in Expo Go, no red screen. Signed-in users land on Home.

## Home dashboard (FR-06, FR-07)
- [ ] Header shows the logo, **"Welcome back,"** and A's real display name.
- [ ] **Search** opens "Search is coming soon"; back returns to Home.
- [ ] **Bell** opens "No notifications yet" (no fake items, no unread badge); back returns.
- [ ] **Avatar** opens the Profile tab.
- [ ] **This Week's Impact** shows **"Getting started"** with no points, streak or rank.
- [ ] With an empty bio/photo/tags, "Complete your profile" appears and opens Edit Profile.
- [ ] Pull down to refresh works without errors.

## Own profile (FR-16, FR-17)
- [ ] Shows photo (or initials), display name, @username, tags, bio, location, "Joined <month year>".
- [ ] Stats: Actions **0**, Followers **0**, Following **0**, Impact **0**.
- [ ] **Actions (0)** tab: "No actions posted yet". **About** tab: "No badges yet", Location, Member since, Account Public/Private.
- [ ] No "Primary Cause" row anywhere (decision D15).

## Edit profile (FR-18, §6.1)
- [ ] Opened from Profile (pencil or **Edit Profile**) and from Settings. **Save** is disabled until something changes.
- [ ] Bio stops at 160 characters and shows the `n/160` counter.
- [ ] Username lowercases input and strips symbols. Typing **B's username in CAPITALS** → "That username is already taken." and Save stays disabled.
- [ ] A free username shows "@… is available".
- [ ] Tags: select 5 → "5/5 selected"; other tags become disabled. Deselect one → enabled again.
- [ ] Location accepts free text (no location permission prompt appears).
- [ ] **Change Photo** opens the phone's gallery (Android photo picker; no permission prompt on Android 13+). Crop square → preview updates → "It uploads when you save".
- [ ] **Save** → spinner → "Profile updated" → back on Profile with all changes and the new photo.
- [ ] The new photo also shows on the Home header and the Settings card.
- [ ] **Fully close Expo Go and reopen** → every change is still there (server-backed).
- [ ] Change the photo again → Supabase *Storage → avatars → A's folder* contains **only one** file.
- [ ] **Remove** photo → Save → initials shown everywhere; the file is gone from storage.
- [ ] Edit something, press back → "Discard changes?" → **Keep editing** stays; **Discard** leaves without saving.
- [ ] Airplane mode → change bio → Save → readable network error, nothing is lost from the form. Airplane mode off → Save works.
- [ ] Server-side uniqueness: on phone A, type a free name and wait for "available". In Table Editor, give **B** that username. Tap Save on A → "That username is already taken. Try another one." A's profile is unchanged.

## Settings (FR-19, FR-20, FR-26)
- [ ] Profile → gear opens Settings with A's photo, name and @username.
- [ ] **Get Verified** and **Language** show a "COMING SOON" pill and do nothing when tapped.
- [ ] No Push / Email / Data Sharing switches (decision D18).
- [ ] Toggle **Activity Updates** off and **Private Account** on → toast for private. Close and reopen the app → both are still set.
      Table Editor: `user_settings.notify_activity = false`, `profiles.is_private = true` for A.
- [ ] **Blocked Users** → "No one is blocked" empty state.
- [ ] **Help & FAQ** opens and its questions expand. **Terms of Service** / **Privacy Policy** open the (draft) pages.
- [ ] **Log Out** → "Log out?" sheet. **Cancel** closes it. **Yes, Log Out** → Welcome screen. Android back does not return to the app.
- [ ] Log in again as A → profile, tags, photo and settings are unchanged.

## Security (spec §12, §16)
- [ ] `supabase/checks/30_verify_phase2.sql` → 23 rows, all PASS.
- [ ] `supabase/checks/40_rls_smoke_test_phase2.sql` → 40 rows, all PASS. This covers: A can't read or change B's settings, add B's tags, upload into or delete from B's avatar folder, overwrite any avatar, use B's file as an avatar, set an external avatar URL, write activity events or scores, or award badges.
- [ ] Phase 1 checks `10_verify_phase1.sql` (15) and `20_rls_smoke_test.sql` (13) still all PASS.
- [ ] Storage limits: in *Storage → avatars*, try uploading a >5 MB file or a `.gif` as a signed-in test user (or check the bucket settings show 5 MB and `image/jpeg, image/png`).

## Regression (Phase 1)
- [ ] Re-run the Phase 1 "Login / logout / session" section of `phase-1-acceptance-tests.md`.
