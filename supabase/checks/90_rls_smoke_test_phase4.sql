-- =============================================================================
-- 90_rls_smoke_test_phase4.sql — Two-user discovery/privacy test. LEAVES NO CHANGES BEHIND.
-- =============================================================================
-- Run AFTER the Phase 4 migrations with at least two accounts. Picks the two
-- oldest profiles (A, B) and impersonates them exactly as the API would
-- (role `authenticated` + JWT sub). B writes two posts with a random tag and
-- word, A likes/comments; then A searches while B is public, private,
-- followed, and finally blocks A. Also compares the search functions with
-- what the RLS policies themselves allow (they must agree exactly).
-- Everything runs in a sub-transaction that is ALWAYS rolled back. Every row
-- should be PASS.
-- =============================================================================

create temp table if not exists phase4_results (ord int, test text, status text, detail text);
truncate phase4_results;

create or replace function pg_temp.rr4(o int, t text, ok boolean, d text)
returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('o', o, 't', t, 'ok', coalesce(ok, false), 'd', coalesce(d, '')));
$$;

do $$
declare
  a uuid; b uuid; a_name text; b_name text;
  res jsonb := '[]'::jsonb;
  tok text := 'zq' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  word text;
  p1 uuid; p2 uuid;
  n int; n2 int; ok boolean;
  state text; rel text; txt text;
  ids uuid[]; ids2 uuid[];
  r record;
  k bigint; kid uuid; seen uuid[] := '{}'; pages int;
  claims_a text; claims_b text;
begin
  word := tok || 'word';
  select p.id, p.username into a, a_name from public.profiles p order by p.created_at, p.id limit 1;
  select p.id, p.username into b, b_name from public.profiles p where p.id <> a order by p.created_at, p.id limit 1;
  if b is null then
    insert into pg_temp.phase4_results values (0, 'setup', 'SKIPPED', 'Need at least two accounts.');
    return;
  end if;
  claims_a := json_build_object('sub', a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', b, 'role', 'authenticated')::text;

  begin  -- ===== everything below is rolled back =====
    update public.profiles set is_private = false where id in (a, b);
    delete from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a);
    delete from public.follows where (follower_id = a and following_id = b) or (follower_id = b and following_id = a);
    delete from public.follow_requests where (requester_id = a and target_id = b) or (requester_id = b and target_id = a);

    -- ===== B posts twice with a unique tag + word =====
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    p1 := public.create_post('action', 'climate', 'Discovery check post one',
            'Testing discovery with ' || word || ' and friends #' || tok, null, null, null, null, null);
    p2 := public.create_post('story', 'arts', 'Discovery check post two',
            'A second note mentioning ' || word || ' again here #' || upper(tok), null, null, null, null, null);
    reset role;

    -- ===== A (B public, not followed) =====
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    insert into public.post_likes (post_id, user_id) values (p1, a);
    insert into public.comments (post_id, author_id, body) values (p1, a, 'Looks great, count me in');

    select count(*) into n from public.search_profiles(b_name) s where s.id = b and s.match_rank = 0;
    res := res || pg_temp.rr4(1, 'Search by exact username finds the person first', n = 1, b_name);
    select count(*) into n from public.search_profiles('@' || upper(left(b_name, greatest(length(b_name) - 1, 1))), 50) s where s.id = b;
    res := res || pg_temp.rr4(2, 'Search by the start of a username (any case, leading @) finds them', n = 1, '');

    select array_agg(q.id order by q.id) into ids from public.query_posts(p_query => upper(word)) q;
    res := res || pg_temp.rr4(3, 'Search by a word in a post finds exactly those posts', ids = (select array_agg(x order by x) from unnest(array[p1, p2]) x), coalesce(array_length(ids, 1), 0) || ' post(s)');
    select count(*) into n from public.query_posts(p_query => left(word, 6) || ' discov');
    res := res || pg_temp.rr4(4, 'Search matches word starts, all words required', n = 2, n || ' post(s)');

    select s.post_count into n from public.search_hashtags('#' || upper(tok)) s where s.tag = tok;
    res := res || pg_temp.rr4(5, 'Hashtag search finds the tag with its post count', n = 2, coalesce(n, 0) || ' post(s)');
    select h.post_count into n from public.get_hashtag('#' || tok) h;
    select count(*) into n2 from public.query_posts(p_hashtag => upper(tok));
    res := res || pg_temp.rr4(6, 'Hashtag feed shows the tag''s posts (header count matches)', n = 2 and n2 = 2, coalesce(n, 0) || ' / ' || n2);

    -- trending: every returned count equals what RLS lets A see
    ok := true; txt := '';
    for r in select * from public.get_trending_hashtags(30) loop
      select count(*), coalesce(sum(p.like_count), 0), coalesce(sum(p.comment_count), 0) into n, n2, k
        from public.posts p join public.post_hashtags ph on ph.post_id = p.id join public.hashtags h on h.id = ph.hashtag_id
       where h.tag = r.tag and p.created_at > now() - interval '7 days';
      if n <> r.post_count or n2 <> r.like_count or k <> r.comment_count or r.score <> 3 * n + n2 + 2 * k then
        ok := false; txt := txt || r.tag || ' ';
      end if;
    end loop;
    res := res || pg_temp.rr4(7, 'Trending counts match the posts (posts, likes, comments, score)', ok, txt);
    select t.score into n from public.get_trending_hashtags(30) t where t.tag = tok;
    select count(*) into n2 from public.get_trending_hashtags(30);
    res := res || pg_temp.rr4(8, 'New tag is trending with score 3×2 posts + 1 like + 2×1 comment = 9',
                              n = 9 or (n is null and n2 = 30), coalesce(n::text, 'not in a full top 30'));

    -- top posts this week: ordered by likes + 2×comments
    ok := true; n := null;
    for r in select q.score from public.query_posts(p_mode => 'top_week', p_limit => 50) q loop
      if n is not null and r.score > n then ok := false; end if;
      n := r.score;
    end loop;
    res := res || pg_temp.rr4(9, 'Top posts this week are ordered by likes + 2×comments', ok, '');

    -- query_posts agrees with the posts RLS policy (newest 50)
    select array_agg(q.id order by q.created_at desc, q.id desc) into ids from public.query_posts(p_limit => 50) q;
    if to_regclass('public.community_members') is null then
      select array_agg(x.id order by x.created_at desc, x.id desc) into ids2
        from (select p.id, p.created_at from public.posts p order by p.created_at desc, p.id desc limit 50) x;
    else
      -- Phase 6 (D51): the general feed also leaves out community posts from
      -- communities you aren't an active member of (they stay readable elsewhere).
      execute $q$
        select array_agg(x.id order by x.created_at desc, x.id desc)
          from (select p.id, p.created_at from public.posts p
                 where p.community_id is null or p.author_id = (select auth.uid())
                    or exists (select 1 from public.community_members m where m.community_id = p.community_id
                                and m.user_id = (select auth.uid()) and m.status = 'active')
                 order by p.created_at desc, p.id desc limit 50) x $q$ into ids2;
    end if;
    res := res || pg_temp.rr4(10, 'Feed function returns exactly what the posts policy allows', ids is not distinct from ids2, '');

    -- cursor pagination over the hashtag feed, one post per page
    select q.id, q.created_at into r from public.query_posts(p_hashtag => tok, p_limit => 1) q;
    select array_agg(q.id) into ids from public.query_posts(p_hashtag => tok, p_before_created => r.created_at, p_before_id => r.id, p_limit => 1) q;
    select count(*) into n from public.query_posts(p_hashtag => tok, p_before_created => (select q.created_at from public.posts q where q.id = ids[1]), p_before_id => ids[1], p_limit => 1);
    res := res || pg_temp.rr4(11, 'Cursor pagination returns each post once, then stops',
                              ids[1] is not null and ids[1] <> r.id and n = 0, '');

    -- suggestions: walk every page with the keyset cursor
    k := null; kid := null; pages := 0;
    loop
      n := 0;
      for r in select s.id, s.rank_key from public.get_people_suggestions(50, k, kid) s loop
        seen := seen || r.id; k := r.rank_key; kid := r.id; n := n + 1;
      end loop;
      pages := pages + 1;
      exit when n < 50 or pages > 200;
    end loop;
    res := res || pg_temp.rr4(12, 'Suggestions include B, never yourself', b = any(seen) and not a = any(seen), cardinality(seen) || ' suggested');
    res := res || pg_temp.rr4(13, 'Suggestion pages never repeat a person', cardinality(seen) = (select count(distinct x) from unnest(seen) x), '');
    reset role;

    -- ===== B goes private =====
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    update public.profiles set is_private = true where id = b;
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.search_profiles(b_name) s where s.id = b and s.is_private;
    res := res || pg_temp.rr4(20, 'Private account still findable by name (identity is public)', n = 1, '');
    select count(*) into n from public.query_posts(p_query => word);
    select count(*) into n2 from public.query_posts(p_hashtag => tok);
    res := res || pg_temp.rr4(21, 'Private account''s posts never appear in search or hashtag feeds', n = 0 and n2 = 0, n || ' / ' || n2);
    select count(*) into n from public.search_hashtags(tok);
    select count(*) into n2 from public.get_hashtag(tok);
    res := res || pg_temp.rr4(22, 'Tags used only by a private account are not findable', n = 0 and n2 = 0, n || ' / ' || n2);
    select count(*) into n from public.get_trending_hashtags(30) t where t.tag = tok;
    select count(*) into n2 from public.query_posts(p_mode => 'top_week', p_limit => 50) q where q.id in (p1, p2);
    res := res || pg_temp.rr4(23, 'Private posts never shape Trending or Top posts', n = 0 and n2 = 0, n || ' / ' || n2);

    rel := public.follow_user(b);
    select count(*) into n from public.get_people_suggestions(50) s where s.id = b;
    res := res || pg_temp.rr4(24, 'Suggestions exclude people you have requested', rel = 'requested' and n = 0, rel);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    perform public.accept_follow_request(a);
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.query_posts(p_query => word);
    select s.post_count into n2 from public.search_hashtags(tok) s;
    res := res || pg_temp.rr4(25, 'Once approved, the follower finds the posts and tag', n = 2 and n2 = 2, n || ' / ' || coalesce(n2, 0));
    select count(*) into n from public.get_people_suggestions(50) s where s.id = b;
    res := res || pg_temp.rr4(26, 'Suggestions exclude people you follow', n = 0, '');
    reset role;

    -- ===== B blocks A =====
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    update public.profiles set is_private = false where id = b;
    perform public.block_user(a);
    select count(*) into n from public.search_profiles(a_name) s where s.id = a;
    res := res || pg_temp.rr4(30, 'Blocker cannot find the blocked person', n = 0, '');
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.search_profiles(b_name) s where s.id = b;
    res := res || pg_temp.rr4(31, 'Blocked person cannot find the blocker', n = 0, '');
    select count(*) into n from public.query_posts(p_query => word);
    select count(*) into n2 from public.query_posts(p_author_id => b);
    res := res || pg_temp.rr4(32, 'Blocker''s posts never appear in search or on their profile', n = 0 and n2 = 0, n || ' / ' || n2);
    select count(*) into n from public.search_hashtags(tok);
    select count(*) into n2 from public.get_trending_hashtags(30) t where t.tag = tok;
    res := res || pg_temp.rr4(33, 'Blocker''s tags never appear in hashtag search or Trending', n = 0 and n2 = 0, n || ' / ' || n2);
    select count(*) into n from public.get_people_suggestions(50) s where s.id = b;
    res := res || pg_temp.rr4(34, 'Suggestions exclude blocked people (either direction)', n = 0, '');
    select coalesce(sum(public.follower_count(b)), 0) into n;
    res := res || pg_temp.rr4(35, 'Follower count of a blocked person is not revealed', n = 0, n::text);

    -- ===== hostile input =====
    state := 'none';
    begin
      select count(*) into n from public.query_posts(p_query => $q$'):*|!&<-> (( \$q$);
      select count(*) + n into n from public.search_profiles($q$%_\$q$);
      select count(*) + n into n from public.search_hashtags('%');
    exception when others then state := sqlstate;
    end;
    res := res || pg_temp.rr4(40, 'Operators / wildcards in search text are treated as plain text', state = 'none' and n = 0, state || ', ' || coalesce(n, -1) || ' row(s)');

    -- ===== signed out =====
    reset role;
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    set local role anon;
    ok := true; txt := '';
    begin perform * from public.search_profiles('a'); ok := false; txt := txt || 'search_profiles '; exception when others then null; end;
    begin perform * from public.query_posts(); ok := false; txt := txt || 'query_posts '; exception when others then null; end;
    begin perform * from public.search_hashtags('a'); ok := false; txt := txt || 'search_hashtags '; exception when others then null; end;
    begin perform * from public.get_trending_hashtags(); ok := false; txt := txt || 'get_trending_hashtags '; exception when others then null; end;
    begin perform * from public.get_people_suggestions(); ok := false; txt := txt || 'get_people_suggestions '; exception when others then null; end;
    res := res || pg_temp.rr4(50, 'Signed-out users cannot search or explore', ok, txt);

    raise exception using errcode = 'GZ004', message = 'rollback phase 4 smoke test';
  exception
    when sqlstate 'GZ004' then null;
    when others then
      res := res || pg_temp.rr4(99, 'unexpected error', false, sqlstate || ' ' || sqlerrm);
  end;

  insert into pg_temp.phase4_results (ord, test, status, detail)
  select (e ->> 'o')::int, e ->> 't', case when (e ->> 'ok')::boolean then 'PASS' else 'FAIL' end, e ->> 'd'
    from jsonb_array_elements(res) e;
end;
$$;

select test, status, detail from pg_temp.phase4_results order by ord;
