# Phase 3 acceptance tests (core social: posts, interactions, follows, privacy, blocking)

Run on the Android phone in Expo Go after `supabase/README.md` → Phase 3 (Q0–Q13).
Use **two phones or two accounts** (A and B) that can sign in. Some steps need B to switch to a
private account in Settings. Tick a box only when you have seen the result yourself.

## Setup
- [ ] `cd mobile && npm install` (adds `@react-native-community/datetimepicker`) → no errors.
- [ ] `npm run typecheck` and `npm run lint` pass. `npx expo start` → app opens.

## Create / edit / delete (FR-08, spec §11)
- [ ] A: tap **+** → choose **Event** → pick a category, write a title (10+ chars) and description (30+) with `#climate`.
      The hashtag chip appears under the description.
- [ ] **Add a photo** opens the gallery; the photo previews.
- [ ] **Continue** → the event date picker (Android date then time dialogs) and location → **Preview** → **Publish ⚡**.
- [ ] The post opens. It shows the photo, the date, the location and the highlighted `#climate`. There is no "Edited" label.
- [ ] Home feed shows the post at the top.
- [ ] ••• → **Edit post** → change the title → Continue → Preview → **Save changes** → "Edited" appears.
- [ ] Edit again and press back → "Discard changes?" → Keep editing / Discard both behave.
- [ ] ••• → **Delete post** → confirm → the post disappears from the feed and the profile.
      In Supabase, `post_likes` / `comments` / `post_saves` have no rows for it, and the photo file is gone from Storage → post-media.

## Feed (Home)
- [ ] Brand-new account: "Your feed is empty" with a **Create a post** button. Skeleton cards show while loading.
- [ ] Category chips filter the feed. "No posts in this category" shows for an empty category.
- [ ] Pull to refresh works. With 21+ posts, scrolling to the end loads the next 20 ("You're all caught up" at the end).
- [ ] "Featured Action" appears only after a Take Action post has at least one like. "People to Follow" lists real accounts.

## Interactions from a second account (FR-09)
- [ ] B: like A's post → the heart fills instantly and the count is 1. **Double-tap quickly** → it never becomes 2.
- [ ] B: save it → "Saved". Tap again → "Removed from saved".
- [ ] B: open the post → write a comment → it appears and the count goes up. **Edit** it ("Edited" shows) and **Delete** it (with confirmation).
- [ ] Airplane mode → tap like → the heart flips back and an error message appears. Airplane mode off.
- [ ] Fully close both apps and reopen → like and comment counts are still correct.
- [ ] B cannot see ••• (edit/delete) on A's post, or Edit/Delete on A's comments.
- [ ] Share icon → the phone's share sheet shows the title, an excerpt and a link. On a phone with Expo Go running
      the project, opening that link opens the post. Note: many chat apps do not make `exp://` / `genzinaction://`
      links tappable (they only link `https://`); if so, copy the link into the phone's browser to test it.
      Clickable links for everyone need a web domain (open decision, see `docs/decisions.md`).

## Follow + privacy (FR-10, FR-11, spec §5.6)
- [ ] B: open A's profile (tap the name on a post) → **Follow** → it changes to **Following** immediately; A's Followers count goes up.
- [ ] **Message · Soon** is visible and does nothing.
- [ ] Tap Following → "Unfollow?" → Unfollow → back to Follow.
- [ ] A: Settings → **Private Account** on. B (not following): A's profile shows name, photo and bio, plus "This account is private". No posts. A's posts are gone from B's feed.
- [ ] B: **Follow** → **Requested**. A: Settings → **Follow Requests** shows "1 waiting" → **Accept**. B now sees A's posts.
- [ ] Repeat with **Decline** → B stays without access.
- [ ] B requests again; A switches back to public → B is following automatically (D30).

## Block (FR-20, spec §11)
- [ ] A: B's profile → ••• → **Block @B** → confirm → "You blocked @B". The follows between A and B are gone (both directions).
- [ ] B: A's posts are gone from the feed. Opening A's profile or an old link to A's post shows "not available".
- [ ] A: B's comments on A's posts are hidden.
- [ ] A: Settings → **Blocked Users** lists B → **Unblock** → confirm → empty list. Follows are not restored.

## Security (spec §12, "even through the API")
- [ ] `supabase/checks/50_verify_phase3.sql` → 20/20 PASS. (Already run on the live project 2026-10-21: 20/20.)
- [ ] `supabase/checks/70_rls_smoke_test_phase3.sql` → 52/52 PASS. (Already run on the live project 2026-10-21: 52/52.) This covers: no posting as someone else, no counter tampering,
      double-like ignored, private posts / comments / photos / hashtag text hidden from non-followers in tables and RPCs,
      no follow without approval, block rules (including: nobody can query whether two other people blocked each other),
      cascade on delete, and no access when signed out.
- [ ] Phase 1 and 2 checks (`10`, `20`, `30`, `40`) still all PASS.

## Regression
- [ ] Phase 2 checklist: edit profile, photo, settings toggles and log out still work.
