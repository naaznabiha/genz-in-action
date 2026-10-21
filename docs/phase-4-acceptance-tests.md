# Phase 4 acceptance tests (discovery: search, Explore, hashtag feeds, trending, suggestions)

Run on the Android phone in Expo Go after `supabase/README.md` → Phase 4 (R0–R8; already applied on 2026-10-21).
Use **two or three accounts** (A, B, and ideally C). Before you start, have B and C each publish a post or
two, using hashtags such as `#ClimateNow` and words you can search for. Tick a box only when you have seen
the result yourself.

## Setup
- [ ] `cd mobile && npm install` (no new packages this phase) → no errors.
- [ ] `npm run typecheck` and `npm run lint` pass. `npx expo start` → app opens.

## Search (FR-14) — Home → 🔍
- [ ] The Search screen opens with the keyboard up. With no history it shows "Search GenZ in Action".
- [ ] Type B's **username** (e.g. `bob`, or `@bob`) → B appears first under **People**, with a Follow button.
- [ ] Type one character → "Keep typing — at least 2 characters." Type fast → results appear once you pause (no flicker per key).
- [ ] Type a **word from B's post** → the post appears under **Posts**. The start of a word also works (`river` finds "riverbank"),
      and several words must all match.
- [ ] Type `#clim` → **Hashtags** comes first and shows `#climatenow` with its post count. Tap it → the hashtag feed opens.
- [ ] Tabs **All / People / Posts / Tags**: "See all" opens the matching tab. With more than 20 results, scrolling loads more.
- [ ] Nonsense text → "No results for …". Symbols like `%`, `'`, `|` never cause an error.
- [ ] Press **Search** on the keyboard, go back, reopen Search → the term is under **Recent searches**.
      Tap it → it runs again. ✕ removes one; **Clear all** removes all. Close and reopen the app → recent searches are still there.
- [ ] Sign in as another account on the same phone → that account does not see the first account's recent searches.

## Hashtag feed (FR-13)
- [ ] Tap a highlighted `#tag` inside a post (in the feed, and on the post detail screen) → the hashtag feed opens, not the post.
- [ ] The header shows `#tag` and "N posts". The count equals the posts listed. Pull to refresh works.
- [ ] A tag in a post **title** is also tappable.

## Explore tab (FR-25)
- [ ] Explore shows the search bar (tap → Search screen) and the tabs **Discover / Trending / People**.
- [ ] **Discover**: 8 cause tiles. Tap **Climate** → "Climate Actions" lists only climate posts, newest first. Tap again or **Clear** to close.
- [ ] **Trending**: ranked tags with "N posts". The fire icon is orange for the top 3. Tap a tag → its feed.
      **Top Actions This Week** lists posts from the last 7 days, most liked/commented first.
- [ ] **People**: suggested changemakers. People who share your causes show "N causes in common" and come first.
      You never appear, nor anyone you follow, have requested or have blocked. **Follow** → they leave the list.

## Home
- [ ] **📈 Trending Right Now** shows up to 5 real tags with counts (hidden when there are none). Tap one → its feed.
      **See all →** opens Explore on Trending.
- [ ] **👥 People to Follow** shows real suggestions (same order as Explore → People). **See all →** opens Explore on People.

## Privacy and blocks (must hold everywhere)
- [ ] B switches to a **private** account. A (not following) searches B's username → B is found (with 🔒), but searching
      a word from B's post finds **nothing**, B's tags are not findable, and B's posts don't count in Trending.
- [ ] A requests to follow B; B accepts → A now finds B's posts and tags.
- [ ] C **blocks** A. As A: searching C's username finds nothing; C's posts, tags and trending counts never appear;
      C is not suggested. As C: A is not findable either.
- [ ] Unblock and switch B back to public afterwards.

## Performance
- [ ] With your real data, search results, Explore tabs and hashtag feeds appear in well under a second on mobile data.
      (Tested by the agent with 600+ posts: every database call 6–62 ms including the network hop.)
