# Phase 6 acceptance tests (communities)

Run on Android phones in Expo Go after `supabase/README.md` → Phase 6 (C0–C10; already applied on 2026-10-24).
Use **three accounts**: **A** (owner), **B** (member → admin), **C** (stays a non-member); ideally A and B on two
phones so you can watch the discussion update live. Tick a box only when you have seen the result yourself.

## Setup
- [ ] `cd mobile && npm install` (adds `expo-document-picker`, `expo-file-system`, `expo-clipboard`, all SDK 54) → no errors.
- [ ] `npm run typecheck` and `npm run lint` pass. `npx expo start` → app opens in Expo Go (SDK 54).
- [ ] Each account has **Activity Updates** on (Settings).

## Create (A)
- [ ] Explore → **Communities** tab: "Create a community", "Your communities", "Discover".
- [ ] Create a **public** community with an image, name and description → its page opens, chips **PUBLIC** and **OWNER**.
- [ ] Create a **private** community → **PRIVATE · INVITE ONLY** chip.
- [ ] A name of 2 characters is refused ("Names are 3–60 characters").

## Public: join instantly (B)
- [ ] B sees both communities under Discover with their chips and member counts.
- [ ] B opens the public one → can read Discussion and Content before joining; the composer says "Join to post".
- [ ] **Join community** → button becomes **Member**; B appears in Members; the community is under "Your communities".

## Private: invite only (C and B)
- [ ] C opens the private community → sees name/description and **Members only**; no Join button.
- [ ] Opening its Discussion, Content or Members shows "Members only". (A shared link to it behaves the same.)
- [ ] A → Members → **Invite people** → search B → **Invite** → "Invited"; B is under "Pending invites" with Cancel.
- [ ] B's bell shows "A invited you to join …" with **Accept / Decline**; Explore → Communities shows the invitation too.
- [ ] Before accepting, B's view of the private community still says Members only.
- [ ] B taps **Accept** → the community opens; B can read and post. A gets "B accepted your invite to …".
- [ ] Try once more with Decline (A invites C, C declines) → A gets "C declined your invite to …"; C is still not a member.
- [ ] A invites C, then cancels → C's invite notification disappears.

## Live discussion (A and B, two phones)
- [ ] Both open the same Discussion. B sends a message → it appears on A's phone **within a few seconds without
      refreshing** (green "Live" in the header). A replies → appears on B's phone.
- [ ] Attach a **photo** (resized automatically) and a **PDF** (≤10 MB) → both show; tapping the PDF opens it.
      A PDF over 10 MB is refused with a message.
- [ ] Older messages load when scrolling up (50 per page).
- [ ] Chat messages create **no notifications**.

## Pins and stars
- [ ] B (member) long-presses A's message → Star, Copy text — **no** "Pin for everyone", no Delete.
- [ ] B stars it → "★ Starred"; the header and the community page show B's starred count; **Starred** lists it,
      "Show in discussion" jumps back to it highlighted.
- [ ] On A's phone the message shows **no** star (stars are private).
- [ ] A long-presses → **Pin for everyone** → the pinned banner appears for A, and for B (live or after reopening).
- [ ] A makes B an admin (Members → ••• → Make admin) → B gets "A made you an admin of …" and can now pin and
      delete others' messages.

## Content
- [ ] B → Content → **Add content**: title + text + a photo (or PDF) → it opens; A gets "B added “…” to …".
- [ ] Filters All / Posts / Photos / Documents / Text show the right items.
- [ ] B leaves the community (Members → Leave community) → the content stays, shown "No longer a member".
- [ ] A (owner/admin) can delete B's content; B, as author, could also delete it while a member.

## Posts to a community (audience)
- [ ] A → Create → Details → **Who is this post for?** → choose the private community → preview says only its
      members will see it → Publish. The post shows "in <community>"; tapping it opens the community.
- [ ] A member sees it in Home; **C does not** (not in Home, search, hashtags or A's profile).
- [ ] A post to the **public** community: members see it in Home; C can still open it from search or A's profile, but it isn't in C's Home.
- [ ] It appears under Content → **Posts**. Editing the post keeps its audience.

## Roles, leaving, deleting
- [ ] As admin, B can remove a member but not A (the owner) or another admin.
- [ ] Someone removed from the public community can't rejoin by themselves ("an admin can invite you back"); an invite works.
- [ ] A taps **Leave community** → "Choose a new owner first" → picks B → **Make … the owner** → B gets "made you the owner"; A is now an admin.
- [ ] Create a community with only yourself in it → **Member** → "Delete …?" → it's gone from Discover.

## Privacy and blocks
- [ ] A blocks C (or C blocks A): in shared communities neither sees the other's messages, content or membership; A can't invite C.
- [ ] Signed out, nothing about communities is reachable.
