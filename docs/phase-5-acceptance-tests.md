# Phase 5 acceptance tests (notifications, saved and liked)

Run on the Android phone in Expo Go after `supabase/README.md` → Phase 5 (S0–S6; already applied on 2026-10-24).
Use **two accounts** (A and B), ideally on two phones; a third account (C) lets you see grouped likes.
Tick a box only when you have seen the result yourself.

## Setup
- [ ] `cd mobile && npm install` (no new packages this phase) → no errors.
- [ ] `npm run typecheck` and `npm run lint` pass. `npx expo start` → app opens.
- [ ] A has at least one post. In Settings, A's **Activity Updates** is on.

## Notifications arrive (FR-15)
- [ ] B likes A's post, comments on it, and follows A.
- [ ] On A's phone (app open), the bell badge on Home updates within a few seconds (Realtime). If it doesn't,
      send the app to the background and back: the badge must update then.
- [ ] Open the bell → "NEW (3)". Rows: "B liked your post “…”", "B commented on “…”: “…”", "B started following you".
      Each unread row has a tint and a dot.
- [ ] C also likes the same post → one row "C and 1 other liked your post", and the badge counts it once.
- [ ] A likes their own post → no notification.

## Opening and marking read
- [ ] Tap the like row → the post opens. Back → the row moved under "EARLIER" and the badge dropped by 1.
- [ ] Tap the comment row → the post opens. Tap the follow row → B's profile opens.
- [ ] A switches to a private account; B unfollows and requests to follow → A gets "B asked to follow you" →
      tap → Follow Requests opens. Accept → the request row disappears; B gets "A accepted your follow request" → tap → A's profile.
- [ ] New activity again (B comments) → **Mark all read** → no "NEW", no dots, no badge on Home.
- [ ] Fully close and reopen the app → still nothing unread.
- [ ] A brand-new account sees "All caught up!".

## Privacy
- [ ] A blocks B → B's notifications disappear from A's list and the badge. Unblock afterwards.
- [ ] There is no way in the app for B to see A's notifications (only your own ever appear).

## Saved tab (FR-19)
- [ ] B saves two of A's posts and likes one. Saved tab → **Saved** lists the two (most recent save first);
      **Liked** lists the liked one.
- [ ] Tap the bookmark on a post in Saved → it disappears immediately ("Removed from saved"). Reopen the app → still gone.
- [ ] Unlike a post in Liked → it disappears immediately.
- [ ] With 21+ saved posts, scrolling loads the rest ("That's everything you saved" at the end).
- [ ] An account with nothing saved/liked sees "Nothing saved yet" / "No liked posts yet" with "Explore actions".
- [ ] A goes private and B doesn't follow A → A's posts drop out of B's Saved/Liked; after A approves B again they come back.
