# Impact scoring: what is built and what is not

_Phase 2, 2026-10-21. Spec §13 and §18 ("Impact scoring" is an open product decision)._

## The boundary

| Built in Phase 2 (plumbing only) | Not built: needs product approval |
|---|---|
| `activity_events`: append-only ledger. Rows can't be updated, deleted or truncated, except when the user's whole profile is deleted. | Which actions qualify and their weights. Phase 3 records `post_created`, `post_liked`, `comment_created`, `user_followed` (D32), but none carry points. |
| `record_activity_event()`: the only write path. Not callable by the app (`anon`/`authenticated`). Only trusted triggers/functions and `service_role` can call it. It has an optional dedupe key so a retried trigger can't double-count. | Points per action (`impact_event_weights` is **empty**). |
| `impact_scoring_versions` + `impact_event_weights`: versioned config, hidden from the API, writable only by migrations. | Week start day and time zone (stored per version, and no version exists yet). |
| `get_my_impact_summary()`: for the caller only, computed at read time. It sums the weights of the latest **approved** version over that version's week. | Streak cadence: the function always returns `streak = null`. |
| `total_actions`: a plain count of the caller's ledger rows (not a score). | Ranking population and formula: the function always returns `rank = null`. Rankings must not ship before approval. |
| Nothing is stored on `profiles`, so there is no client-editable score anywhere. | Anti-gaming rules (e.g. like/unlike farming, daily caps). |

**What the app shows today:** the Home card says **"Getting started"** with no points, streak or rank.
The profile **Impact** stat shows `0` when the user has no recorded actions. It shows `—` if actions
exist but no formula is approved. Followers/Following show `0` because following doesn't exist yet.
No prototype numbers (+240 pts, 5-day streak, Rank #142, x/5 goals) are reproduced.

## How to switch it on later (no app release needed for the formula itself)

1. **Phase 3**, in each feature's migration: insert the event type (e.g. `post_created`). Then add an
   `AFTER INSERT` trigger on the source table that calls
   `public.record_activity_event(new.author_id, 'post_created', 'posts', new.id::text, 'posts:' || new.id)`.
2. **When the formula is approved:** one migration inserts
   `impact_scoring_versions (version 1, status 'approved', week_starts_on, time_zone, approved_at, approved_by)`
   plus its `impact_event_weights` rows. Scores are computed at read time, so past events are scored
   under the new version automatically, and the old ledger is never rewritten.
3. **Streak / rank:** extend the version table with the approved cadence and population, then
   implement them in `get_my_impact_summary()` (and a separate leaderboard function if needed).
   Until then both stay `null`, and the app hides them.

## Decisions needed from the product owner

- Qualifying actions (posts? likes given? comments? shares? community joins?) and their weights.
- Week definition: start day and time zone (per user, or one global zone).
- Streak cadence (daily or weekly) and what breaks a streak.
- Ranking population (global, by country, by tag?) and whether private accounts are ranked.
- Anti-gaming rules.
