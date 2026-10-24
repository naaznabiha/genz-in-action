-- =============================================================================
-- 96_rls_smoke_test_phase5.sql — Two-user notifications / saved / liked test. LEAVES NO CHANGES BEHIND.
-- =============================================================================
-- Run AFTER the Phase 5 migrations with at least two accounts (a third one, if
-- it exists, is used to check grouped likes). Picks the oldest profiles (A, B,
-- C) and impersonates them exactly as the API would (role `authenticated` +
-- JWT sub). B likes, comments on, follows and requests to follow A; A reads,
-- opens and marks notifications; B tries to read or change A's rows; B's
-- Saved/Liked lists are checked. Everything runs in a sub-transaction that is
-- ALWAYS rolled back (your real notifications keep their read state).
-- Every row should be PASS (SKIPPED only when a third account doesn't exist).
-- =============================================================================

create temp table if not exists phase5_results (ord int, test text, status text, detail text);
truncate phase5_results;

create or replace function pg_temp.rr5(o int, t text, ok boolean, d text)
returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('o', o, 't', t, 'ok', ok, 'd', coalesce(d, '')));
$$;

do $$
declare
  a uuid; b uuid; c uuid;
  res jsonb := '[]'::jsonb;
  pa uuid; pa2 uuid;
  n int; n2 int; base int;
  state text; txt text; k text;
  claims_a text; claims_b text; claims_c text;
begin
  select p.id into a from public.profiles p order by p.created_at, p.id limit 1;
  select p.id into b from public.profiles p where p.id <> a order by p.created_at, p.id limit 1;
  select p.id into c from public.profiles p where p.id not in (a, b) order by p.created_at, p.id limit 1;
  if b is null then
    insert into pg_temp.phase5_results values (0, 'setup', 'SKIPPED', 'Need at least two accounts.');
    return;
  end if;
  claims_a := json_build_object('sub', a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', b, 'role', 'authenticated')::text;
  claims_c := json_build_object('sub', c, 'role', 'authenticated')::text;

  begin  -- ===== everything below is rolled back =====
    update public.profiles set is_private = false where id in (a, b);
    delete from public.blocks where blocker_id in (a, b) or blocked_id in (a, b);
    delete from public.follows where (follower_id = a and following_id = b) or (follower_id = b and following_id = a);
    delete from public.follow_requests where (requester_id = a and target_id = b) or (requester_id = b and target_id = a);
    update public.user_settings set notify_activity = true where user_id in (a, b);
    update public.notifications set read_at = now() where recipient_id in (a, b) and read_at is null;  -- clean slate (rolled back)

    -- ===== A posts twice and likes their own post =====
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    pa := public.create_post('action', 'climate', 'Notification check post', 'Checking that likes and comments notify the author.', null, null, null, null, null);
    pa2 := public.create_post('story', 'arts', 'Second notification post', 'A second post for the saved and liked lists check.', null, null, null, null, null);
    insert into public.post_likes (post_id, user_id) values (pa, a);
    select public.get_unread_notification_count() into base;
    res := res || pg_temp.rr5(1, 'Liking your own post creates no notification', base = 0, base || ' unread');
    reset role;

    -- ===== B: like, comment, follow =====
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    insert into public.post_likes (post_id, user_id) values (pa, b);
    insert into public.comments (post_id, author_id, body) values (pa, b, 'Count me in for this one!');
    perform public.follow_user(a);
    insert into public.post_saves (post_id, user_id) values (pa2, b);
    insert into public.post_saves (post_id, user_id) values (pa, b);
    reset role;
    -- same transaction = same timestamp; make the pa2 save one minute older so "newest first" is testable
    update public.post_saves set created_at = created_at - interval '1 minute' where post_id = pa2 and user_id = b;

    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.get_notifications() g where g.type = 'like' and g.actor_id = b and g.post_id = pa and g.unread;
    res := res || pg_temp.rr5(2, 'B''s like notifies A (opens the liked post)', n = 1, n || ' item(s)');
    select count(*) into n from public.get_notifications() g
     where g.type = 'comment' and g.actor_id = b and g.post_id = pa and g.comment_excerpt = 'Count me in for this one!' and g.unread;
    res := res || pg_temp.rr5(3, 'B''s comment notifies A (opens the post, shows the comment)', n = 1, n || ' item(s)');
    select count(*) into n from public.get_notifications() g where g.type = 'follow' and g.actor_id = b and g.target_id = b;
    res := res || pg_temp.rr5(4, 'B''s follow notifies A (opens B''s profile)', n = 1, n || ' item(s)');
    select public.get_unread_notification_count() into n;
    res := res || pg_temp.rr5(5, 'Unread count = 3 (like, comment, follow)', n = 3, n || ' unread');
    reset role;

    -- ===== grouped likes (needs a third account) =====
    if c is not null then
      delete from public.blocks where blocker_id = c or blocked_id = c;
      update public.profiles set is_private = false where id = c;
      perform set_config('request.jwt.claims', claims_c, true);
      set local role authenticated;
      insert into public.post_likes (post_id, user_id) values (pa, c);
      reset role;
      perform set_config('request.jwt.claims', claims_a, true);
      set local role authenticated;
      select count(*), max(g.actor_count), bool_and(g.actor_id = c) into n, n2, state
        from public.get_notifications() g where g.type = 'like' and g.post_id = pa;
      select public.get_unread_notification_count() into base;
      res := res || pg_temp.rr5(6, 'Two likes on one post = ONE item ("C and 1 other"), counted once', n = 1 and n2 = 2 and state = 'true' and base = 3,
                                n || ' item(s), ' || n2 || ' people, unread ' || base);
      reset role;
    else
      res := res || pg_temp.rr5(6, 'Two likes on one post = ONE item (needs a third account)', null, 'skipped: only two accounts');
    end if;

    -- ===== A opens items =====
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select g.key into k from public.get_notifications() g where g.type = 'like' and g.post_id = pa;
    n := public.mark_notification_read(k);
    select count(*) into n2 from public.get_notifications() g where g.key = k and not g.unread;
    res := res || pg_temp.rr5(7, 'Opening an item marks it read (all likes in the group)', n >= 1 and n2 = 1 and public.get_unread_notification_count() = 2,
                              n || ' row(s) marked, unread now ' || public.get_unread_notification_count());
    n := public.mark_notification_read('like:not-a-uuid') + public.mark_notification_read('nonsense');
    res := res || pg_temp.rr5(8, 'Malformed keys change nothing', n = 0, n || ' row(s)');
    reset role;

    -- ===== isolation: B against A's rows =====
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    select count(*) into n from public.notifications where recipient_id = a;
    select count(*) into n2 from public.get_notifications() g where g.actor_id = b;   -- B sees none "from" B (they're A's)
    res := res || pg_temp.rr5(10, 'B cannot read A''s notifications', n = 0 and n2 = 0, n || ' / ' || n2);
    update public.notifications set read_at = null where recipient_id = a;
    get diagnostics n = row_count;
    n := n + public.mark_notification_read(k) + public.mark_all_notifications_read();
    reset role;
    select count(*) into n2 from public.notifications where recipient_id = a and type = 'comment' and actor_id = b and read_at is null;
    res := res || pg_temp.rr5(11, 'B cannot mark or unmark A''s notifications', n = 0 and n2 = 1, n || ' row(s) changed by B; A''s comment still unread: ' || n2);
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    state := 'none';
    begin insert into public.notifications (recipient_id, actor_id, type, target_type, target_id) values (a, b, 'like', 'post', pa2);
    exception when others then state := sqlstate; end;
    txt := 'none';
    begin delete from public.notifications where recipient_id = a;
    exception when others then txt := sqlstate; end;
    res := res || pg_temp.rr5(12, 'Nobody can create or delete notifications through the API', state = '42501' and txt = '42501', 'insert ' || state || ', delete ' || txt);
    state := 'none';
    begin perform public.create_notification(a, b, 'like', 'post', pa2);
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr5(13, 'The trusted writer is not callable', state = '42501', 'sqlstate ' || state);

    -- ===== B: Saved / Liked =====
    select count(*) into n from public.get_my_post_list('saved') l where l.id in (pa, pa2) and l.saved_by_me;
    select l.id into k from public.get_my_post_list('saved', p_limit => 1) l;
    res := res || pg_temp.rr5(20, 'Saved lists exactly the saved posts, newest save first', n = 2 and k = pa::text, n || ' post(s), first = ' || coalesce(k, '-'));
    select count(*) into n from public.get_my_post_list('liked') l where l.id = pa and l.liked_by_me;
    select count(*) into n2 from public.get_my_post_list('liked') l where l.id = pa2;
    res := res || pg_temp.rr5(21, 'Liked lists exactly the liked posts', n = 1 and n2 = 0, n || ' / ' || n2);
    delete from public.post_saves where post_id = pa and user_id = b;
    select count(*) into n from public.get_my_post_list('saved') l where l.id = pa;
    res := res || pg_temp.rr5(22, 'Unsaving removes the post from Saved', n = 0, n || ' row(s)');
    state := 'none';
    begin perform * from public.get_my_post_list('everything'); exception when others then state := sqlstate; end;
    res := res || pg_temp.rr5(23, 'Unknown list name rejected', state = '22023', 'sqlstate ' || state);
    reset role;

    -- ===== private + follow request + accepted =====
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    update public.profiles set is_private = true where id = a;
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    perform public.unfollow_user(a);
    select count(*) into n from public.get_my_post_list('saved') l where l.id = pa2;
    select count(*) into n2 from public.get_my_post_list('liked') l where l.id = pa;
    res := res || pg_temp.rr5(24, 'Posts that become invisible drop out of Saved and Liked', n = 0 and n2 = 0, n || ' / ' || n2);
    txt := public.follow_user(a);
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.get_notifications() g where g.type = 'follow_request' and g.actor_id = b and g.unread;
    res := res || pg_temp.rr5(30, 'B''s follow request notifies A', txt = 'requested' and n = 1, txt || ', ' || n || ' item(s)');
    perform public.accept_follow_request(b);
    select count(*) into n from public.get_notifications() g where g.type = 'follow_request' and g.actor_id = b;
    res := res || pg_temp.rr5(31, 'Handled request leaves the list', n = 0, n || ' item(s)');
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    select count(*) into n from public.get_notifications() g where g.type = 'follow_accepted' and g.actor_id = a and g.unread;
    select count(*) into n2 from public.get_my_post_list('saved') l where l.id = pa2;
    res := res || pg_temp.rr5(32, 'Accepted request notifies B; saved post visible again', n = 1 and n2 = 1, n || ' / ' || n2);
    reset role;

    -- ===== blocks =====
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select public.get_unread_notification_count() into base;
    perform public.block_user(b);
    select count(*) into n from public.get_notifications() g where g.actor_id = b;
    select public.get_unread_notification_count() into n2;
    res := res || pg_temp.rr5(40, 'Blocking hides that person''s notifications and their unread count', n = 0 and n2 < base, n || ' item(s), unread ' || base || ' → ' || n2);
    perform public.unblock_user(b);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    perform public.block_user(a);
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.get_notifications() g where g.actor_id = b;
    res := res || pg_temp.rr5(41, 'Being blocked hides the blocker''s notifications too', n = 0, n || ' item(s)');
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    perform public.unblock_user(a);
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    update public.profiles set is_private = false where id = a;
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    insert into public.post_likes (post_id, user_id) values (pa2, b);
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.get_notifications() g where g.type = 'like' and g.post_id = pa2 and g.actor_id = b;
    res := res || pg_temp.rr5(42, 'After unblocking, new activity notifies again', n = 1, n || ' item(s)');

    -- ===== mark all =====
    n := public.mark_all_notifications_read();
    select public.get_unread_notification_count() into n2;
    select count(*) into base from public.get_notifications() g where g.unread;
    res := res || pg_temp.rr5(50, 'Mark all read clears every unread item', n >= 1 and n2 = 0 and base = 0, n || ' row(s) marked, unread ' || n2);
    reset role;
    select count(*) into n from public.notifications where recipient_id = a and read_at is null;
    res := res || pg_temp.rr5(51, 'Mark all read is stored in the database', n = 0, n || ' unread row(s)');

    -- ===== signed out =====
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    set local role anon;
    txt := '';
    begin perform * from public.get_notifications(); txt := txt || 'get_notifications '; exception when others then null; end;
    begin perform public.get_unread_notification_count(); txt := txt || 'count '; exception when others then null; end;
    begin perform public.mark_all_notifications_read(); txt := txt || 'mark_all '; exception when others then null; end;
    begin perform * from public.get_my_post_list('saved'); txt := txt || 'saved '; exception when others then null; end;
    res := res || pg_temp.rr5(60, 'Signed-out users cannot read or mark notifications or lists', txt = '', txt);

    raise exception using errcode = 'GZ005', message = 'rollback phase 5 smoke test';
  exception
    when sqlstate 'GZ005' then null;
    when others then
      res := res || pg_temp.rr5(99, 'unexpected error', false, sqlstate || ' ' || sqlerrm);
  end;

  insert into pg_temp.phase5_results (ord, test, status, detail)
  select (e ->> 'o')::int, e ->> 't',
         case when e -> 'ok' = 'null'::jsonb then 'SKIPPED' when (e ->> 'ok')::boolean then 'PASS' else 'FAIL' end,
         e ->> 'd'
    from jsonb_array_elements(res) e;
end;
$$;

select test, status, detail from pg_temp.phase5_results order by ord;
