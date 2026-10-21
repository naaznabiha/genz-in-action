-- =============================================================================
-- 70_rls_smoke_test_phase3.sql — Two-user social/privacy test. LEAVES NO CHANGES BEHIND.
-- =============================================================================
-- Run AFTER the Phase 3 migrations with at least two accounts. Picks the two
-- oldest profiles (A, B) and impersonates them exactly as the API would
-- (role `authenticated` + JWT sub). Covers: post authorship and column rules,
-- hashtags, double-like, trusted counters, comments, saves, notifications and
-- activity events, private accounts and follow requests, blocking, post-photo
-- storage access, deletion cascades, and signed-out access.
-- Everything runs in a sub-transaction that is ALWAYS rolled back (A's privacy
-- setting is restored too). Every row should be PASS.
-- Note: hosted Supabase forbids SQL deletes on storage tables, so this test
-- never deletes storage objects.
-- =============================================================================

create temp table if not exists phase3_results (ord int, test text, status text, detail text);
truncate phase3_results;

create or replace function pg_temp.rr(o int, t text, ok boolean, d text)
returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('o', o, 't', t, 'ok', coalesce(ok, false), 'd', coalesce(d, '')));
$$;

do $$
declare
  a uuid; b uuid;
  res jsonb := '[]'::jsonb;
  n int; n2 int;
  state text;
  post_a uuid; post_tmp uuid; com_b uuid;
  txt text;
  rel text; canview boolean;
  claims_a text; claims_b text;
begin
  select p.id into a from public.profiles p order by p.created_at, p.id limit 1;
  select p.id into b from public.profiles p where p.id <> a order by p.created_at, p.id limit 1;
  if b is null then
    insert into pg_temp.phase3_results values (0, 'setup', 'SKIPPED', 'Need at least two accounts.');
    return;
  end if;
  claims_a := json_build_object('sub', a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', b, 'role', 'authenticated')::text;

  begin  -- ===== everything below is rolled back =====
    -- Known starting state for the pair (rolled back at the end).
    update public.profiles set is_private = false where id in (a, b);
    delete from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a);
    delete from public.follows where (follower_id = a and following_id = b) or (follower_id = b and following_id = a);
    delete from public.follow_requests where (requester_id = a and target_id = b) or (requester_id = b and target_id = a);
    update public.user_settings set notify_activity = true where user_id in (a, b);
    insert into storage.objects (bucket_id, name, owner, owner_id) values ('post-media', a || '/post-1700000000001.jpg', a, a::text);
    insert into storage.objects (bucket_id, name, owner, owner_id) values ('post-media', b || '/post-1700000000002.jpg', b, b::text);

    -- ================= A: posts =================
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;

    state := 'none';
    begin
      post_a := public.create_post('action', 'climate', 'Join the river clean-up', 'Bring gloves and friends this Saturday morning. #Climate #GenZ',
                                   'Cairo', null, a || '/post-1700000000001.jpg', 800, 600);
    exception when others then state := sqlstate || ' ' || sqlerrm; end;
    res := res || pg_temp.rr(1, 'A creates a post with photo', state = 'none' and post_a is not null, state);

    select count(*) into n from public.post_hashtags where post_id = post_a;
    res := res || pg_temp.rr(2, 'Hashtags detected from text (#climate, #genz)', n = 2, n || ' tag(s)');

    state := 'none';
    begin perform public.create_post('story', 'climate', 'Short', 'Too short body', null, null, null, null, null);
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(3, 'Title/body minimum lengths enforced', state = '23514', 'sqlstate ' || state);

    state := 'none';
    begin insert into public.posts (author_id, type, category, title, body) values (b, 'story', 'arts', 'Pretending to be B', 'This post claims to be written by someone else.');
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(4, 'A cannot post as B', state = '42501', 'sqlstate ' || state);

    state := 'none';
    begin insert into public.posts (author_id, type, category, title, body, like_count) values (a, 'story', 'arts', 'Inflated like counter', 'Trying to start this post with a thousand likes.', 1000);
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(5, 'A cannot set like_count', state = '42501', 'sqlstate ' || state);

    state := 'none';
    begin perform public.create_post('event', 'climate', 'Photo from B folder', 'Attaching a photo that belongs to another user here.', null, null, b || '/post-1700000000002.jpg', null, null);
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(6, 'A cannot attach B''s photo', state = '22023', 'sqlstate ' || state);

    state := 'none';
    begin insert into storage.objects (bucket_id, name, owner, owner_id) values ('post-media', b || '/post-1700000000003.jpg', a, a::text);
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(7, 'A cannot upload into B''s photo folder', state = '42501', 'sqlstate ' || state);

    -- ================= B: interact with A's public post =================
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;

    select count(*) into n from public.get_posts(p_post_id => post_a);
    res := res || pg_temp.rr(10, 'B sees A''s public post (feed RPC)', n = 1, n || ' row(s)');

    select count(*) into n from storage.objects where bucket_id = 'post-media' and name = a || '/post-1700000000001.jpg';
    res := res || pg_temp.rr(11, 'B can read the photo of a post B can see', n = 1, n || ' object(s)');

    select count(*) into n from storage.objects where bucket_id = 'post-media' and name = b || '/post-1700000000002.jpg';
    -- (photos attached to A's other visible posts are legitimately readable, so only unattached ones count)
    select count(*) into n2 from storage.objects o where o.bucket_id = 'post-media' and o.name like a || '/%' and o.name <> a || '/post-1700000000001.jpg'
       and not exists (select 1 from public.post_media m where m.storage_path = o.name);
    res := res || pg_temp.rr(12, 'Unattached photos stay private to their uploader', n = 1 and n2 = 0, 'own=' || n || ' others_unattached=' || n2);

    insert into public.post_likes (post_id, user_id) values (post_a, b) on conflict do nothing;
    insert into public.post_likes (post_id, user_id) values (post_a, b) on conflict do nothing;
    state := 'none';
    begin insert into public.post_likes (post_id, user_id) values (post_a, b);
    exception when others then state := sqlstate; end;
    select like_count into n from public.posts where id = post_a;
    res := res || pg_temp.rr(13, 'Double like → one like, count 1', n = 1 and state = '23505', 'like_count=' || n || ', 3rd plain insert ' || state);

    state := 'none';
    begin update public.posts set like_count = 999 where id = post_a;
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(14, 'B cannot edit counters', state = '42501', 'sqlstate ' || state);

    update public.posts set title = 'Hijacked title by B' where id = post_a;
    get diagnostics n = row_count;
    delete from public.posts where id = post_a;
    get diagnostics n2 = row_count;
    res := res || pg_temp.rr(15, 'B cannot edit or delete A''s post', n = 0 and n2 = 0, 'updated=' || n || ' deleted=' || n2);

    state := 'none';
    begin perform public.update_post(post_a, 'story', 'arts', 'Hijacked via the RPC', 'B tries to rewrite A''s post through the update RPC.', null, null, null, null, null);
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(16, 'update_post refuses non-authors', state = '42501', 'sqlstate ' || state);

    insert into public.comments (post_id, author_id, body) values (post_a, b, 'Count me in!') returning id into com_b;
    select comment_count into n from public.posts where id = post_a;
    res := res || pg_temp.rr(17, 'Comment counted by trigger', n = 1, 'comment_count=' || n);

    state := 'none';
    begin insert into public.comments (post_id, author_id, body) values (post_a, a, 'Comment pretending to be A');
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(18, 'B cannot comment as A', state = '42501', 'sqlstate ' || state);

    insert into public.post_saves (post_id, user_id) values (post_a, b);

    -- like → unlike → like : one activity event, notification removed on unlike
    delete from public.post_likes where post_id = post_a and user_id = b;
    select like_count into n from public.posts where id = post_a;
    reset role;
    select count(*) into n2 from public.notifications where recipient_id = a and actor_id = b and type = 'like';
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    res := res || pg_temp.rr(19, 'Unlike: count back to 0, like notification removed', n = 0 and n2 = 0, 'like_count=' || n || ', notifs=' || n2);
    insert into public.post_likes (post_id, user_id) values (post_a, b);
    select count(*) into n from public.activity_events where user_id = b and event_type = 'post_liked' and source_id = post_a::text;
    res := res || pg_temp.rr(20, 'Like→unlike→like records ONE activity event', n = 1, n || ' event(s)');

    state := 'none';
    begin perform public.record_activity_event(b, 'post_liked', 'x', 'y');
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(21, 'B cannot write activity events', state = '42501', 'sqlstate ' || state);

    select count(*) into n from public.notifications where recipient_id = a;
    res := res || pg_temp.rr(22, 'B cannot read A''s notifications', n = 0, n || ' row(s)');

    -- ================= A: sees results, cannot see B's private data =================
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;

    select count(*) into n from public.notifications where recipient_id = a and actor_id = b and type in ('like', 'comment');
    res := res || pg_temp.rr(23, 'A got like + comment notifications', n = 2, n || ' notification(s)');

    select count(*) into n from public.post_saves where post_id = post_a;
    res := res || pg_temp.rr(24, 'Saves are private (A cannot see B''s save)', n = 0, n || ' row(s)');

    update public.comments set body = 'Edited by A?' where id = com_b;
    get diagnostics n = row_count;
    res := res || pg_temp.rr(25, 'A cannot edit B''s comment', n = 0, n || ' row(s)');

    state := 'none';
    begin insert into public.notifications (recipient_id, actor_id, type, target_type, target_id) values (b, a, 'like', 'post', post_a);
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(26, 'Nobody can forge notifications', state = '42501', 'sqlstate ' || state);

    -- ================= Private account =================
    update public.profiles set is_private = true where id = a;

    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;

    select count(*) into n from public.posts where id = post_a;
    select count(*) into n2 from public.get_posts(p_author_id => a);
    res := res || pg_temp.rr(30, 'Private: non-follower cannot read posts (table + RPC)', n = 0 and n2 = 0, 'table=' || n || ' rpc=' || n2);

    select count(*) into n from public.comments where post_id = post_a;
    select count(*) into n2 from storage.objects where bucket_id = 'post-media' and name = a || '/post-1700000000001.jpg';
    res := res || pg_temp.rr(31, 'Private: comments and photo hidden too', n = 0 and n2 = 0, 'comments=' || n || ' photo=' || n2);

    select count(*) into n from public.profiles where id = a;
    select s.relationship, s.can_view_content into rel, canview from public.get_profile_summary(a) s;
    res := res || pg_temp.rr(32, 'Private: identity visible, content not', n = 1 and rel = 'none' and canview = false, 'profile=' || n || ' rel=' || coalesce(rel, '-') || ' can_view=' || coalesce(canview::text, '-'));

    state := 'none';
    begin insert into public.post_likes (post_id, user_id) values (post_a, b) on conflict do nothing;
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(33, 'Private: non-follower cannot like', state = '42501', 'sqlstate ' || state);

    state := 'none';
    begin insert into public.follows (follower_id, following_id) values (b, a);
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(34, 'Cannot bypass approval by inserting a follow', state = '42501', 'sqlstate ' || state);

    txt := public.follow_user(a);
    res := res || pg_temp.rr(35, 'Following a private account sends a request', txt = 'requested', txt);

    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.get_my_follow_requests() where requester_id = b;
    select count(*) into n2 from public.notifications where recipient_id = a and actor_id = b and type = 'follow_request';
    res := res || pg_temp.rr(36, 'Owner sees the request (+ notification)', n = 1 and n2 = 1, 'requests=' || n || ' notifs=' || n2);
    perform public.accept_follow_request(b);

    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    select count(*) into n from public.get_posts(p_author_id => a);
    select count(*) into n2 from public.notifications where recipient_id = b and actor_id = a and type = 'follow_accepted';
    res := res || pg_temp.rr(37, 'After approval the follower sees posts (+ accepted notification)', n >= 1 and n2 = 1, 'posts=' || n || ' notifs=' || n2);

    perform public.unfollow_user(a);
    select count(*) into n from public.get_posts(p_author_id => a);
    res := res || pg_temp.rr(38, 'Unfollow removes access again', n = 0, n || ' post(s)');

    txt := public.follow_user(a);   -- pending again
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    perform public.reject_follow_request(b);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    rel := public.relationship_with(a);
    res := res || pg_temp.rr(39, 'Rejected request leaves no follow', rel = 'none', rel);

    txt := public.follow_user(a);   -- pending, then A goes public
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    update public.profiles set is_private = false where id = a;
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    rel := public.relationship_with(a);
    res := res || pg_temp.rr(40, 'Going public accepts pending requests', rel = 'following', rel);

    -- public follow is immediate (A follows B)
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    txt := public.follow_user(b);
    res := res || pg_temp.rr(41, 'Following a public account is immediate', txt = 'following', txt);

    -- ================= Block =================
    perform public.block_user(b);
    reset role;
    select count(*) into n from public.follows where (follower_id = a and following_id = b) or (follower_id = b and following_id = a);
    select count(*) into n2 from public.follow_requests where (requester_id = a and target_id = b) or (requester_id = b and target_id = a);
    res := res || pg_temp.rr(50, 'Block removes follows + requests both ways', n = 0 and n2 = 0, 'follows=' || n || ' requests=' || n2);
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;

    select s.relationship into rel from public.get_profile_summary(b) s;
    select count(*) into n from public.comments where post_id = post_a and author_id = b;
    res := res || pg_temp.rr(51, 'Blocker: sees blocked_by_me, B''s comments hidden', rel = 'blocked_by_me' and n = 0, 'rel=' || coalesce(rel, '-') || ' comments=' || n);

    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;

    select count(*) into n from public.get_profile_summary(a);
    select count(*) into n2 from public.profiles where id = a;
    res := res || pg_temp.rr(52, 'Blocked user cannot find the blocker', n = 0 and n2 = 0, 'summary=' || n || ' profile=' || n2);

    select count(*) into n from public.get_posts(p_author_id => a);
    select count(*) into n2 from public.posts where author_id = a;
    res := res || pg_temp.rr(53, 'Blocked user cannot see blocker''s posts (A is public)', n = 0 and n2 = 0, 'rpc=' || n || ' table=' || n2);

    state := 'none';
    begin insert into public.comments (post_id, author_id, body) values (post_a, b, 'Still here?');
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(54, 'Blocked user cannot comment', state = '42501', 'sqlstate ' || state);

    state := 'none';
    begin perform public.follow_user(a);
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(55, 'Blocked user cannot follow/request', state = 'PT404', 'sqlstate ' || state);

    select count(*) into n from public.blocks;
    res := res || pg_temp.rr(56, 'Blocked user cannot see the block row', n = 0, n || ' row(s)');

    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.get_my_blocked_users() where user_id = b;
    res := res || pg_temp.rr(57, 'Blocker sees B in Blocked users', n = 1, n || ' row(s)');

    perform public.unblock_user(b);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    select count(*) into n from public.get_posts(p_author_id => a);
    rel := public.relationship_with(a);
    res := res || pg_temp.rr(58, 'Unblock restores visibility, not follows', n >= 1 and rel = 'none', 'posts=' || n || ' rel=' || rel);

    -- ================= Private hashtags & block-check privacy (audit fixes) =================
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    update public.profiles set is_private = true where id = a;
    perform public.create_post('story', 'arts', 'Private hashtag check post', 'Only followers should ever see this tag #zzprivtagcheck91',
                               null, null, null, null, null);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    select count(*) into n from public.hashtags where tag = 'zzprivtagcheck91';
    res := res || pg_temp.rr(62, 'Hashtag text from a private account is hidden from non-followers', n = 0, n || ' row(s)');
    state := 'none';
    begin perform public.is_blocked_between(a, b); exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(63, 'Users cannot query blocks between arbitrary people', state = '42501', 'sqlstate ' || state);
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    update public.profiles set is_private = false where id = a;
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    select count(*) into n from public.hashtags where tag = 'zzprivtagcheck91';
    res := res || pg_temp.rr(64, 'Same hashtag visible once the posts are visible', n = 1, n || ' row(s)');

    -- ================= Delete cascade =================
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    delete from public.posts where id = post_a;
    reset role;
    select (select count(*) from public.post_likes where post_id = post_a)
         + (select count(*) from public.post_saves where post_id = post_a)
         + (select count(*) from public.comments where post_id = post_a)
         + (select count(*) from public.post_hashtags where post_id = post_a)
         + (select count(*) from public.post_media where post_id = post_a)
         + (select count(*) from public.notifications where target_id in (post_a, com_b))
      into n;
    select count(*) into n2 from public.activity_events where source_id = post_a::text;
    res := res || pg_temp.rr(60, 'Deleting a post removes likes/saves/comments/tags/photo row/notifications', n = 0, n || ' leftover row(s)');
    res := res || pg_temp.rr(61, 'Activity history is kept (append-only)', n2 >= 1, n2 || ' event(s)');

    -- ================= signed out =================
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    set local role anon;
    state := 'none';
    begin perform * from public.get_posts(); exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(70, 'anon cannot read the feed', state = '42501', 'sqlstate ' || state);
    state := 'none';
    begin perform public.follow_user(a); exception when others then state := sqlstate; end;
    res := res || pg_temp.rr(71, 'anon cannot follow', state = '42501', 'sqlstate ' || state);

    raise exception using errcode = 'GZ003', message = 'rollback phase 3 smoke test';
  exception
    when sqlstate 'GZ003' then null;
    when others then
      res := res || pg_temp.rr(99, 'unexpected error', false, sqlstate || ' ' || sqlerrm);
  end;

  insert into pg_temp.phase3_results (ord, test, status, detail)
  select (e ->> 'o')::int, e ->> 't', case when (e ->> 'ok')::boolean then 'PASS' else 'FAIL' end, e ->> 'd'
    from jsonb_array_elements(res) e;
end;
$$;

select test, status, detail from pg_temp.phase3_results order by ord;
