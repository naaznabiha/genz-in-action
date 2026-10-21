-- =============================================================================
-- 40_rls_smoke_test_phase2.sql — Two-user security test. LEAVES NO CHANGES BEHIND.
-- =============================================================================
-- Run AFTER the Phase 2 migrations, with at least two accounts signed up.
-- Picks the two oldest profiles (A and B), impersonates A exactly as the API
-- would (role `authenticated` + JWT `sub`), tries allowed and forbidden
-- operations on settings, tags, profile RPC, avatars storage, the activity
-- ledger, badges and impact stats, then repeats key checks as `anon`.
-- Everything runs inside a sub-transaction that is ALWAYS rolled back.
--
-- Storage note: this test exercises the storage.objects RLS policies directly
-- in SQL. The bucket's 5 MB / JPEG-PNG limits are enforced by the Storage API
-- and are checked by 30_verify_phase2.sql (bucket config) and the manual
-- upload test in docs/phase-2-acceptance-tests.md.
--
-- Every row should be PASS. SKIPPED means fewer than two accounts exist.
-- =============================================================================

create temp table if not exists phase2_rls_results (ord int, test text, status text, detail text);
truncate phase2_rls_results;

do $$
declare
  a          uuid;
  b          uuid;
  a_username text;
  a_name     text;
  b_username text;
  n          int;
  res        jsonb := '[]'::jsonb;
  state      text;
  ok         boolean;
  a_path     text;
  b_path     text;
  r          record;
begin
  select p.id, p.username, p.display_name into a, a_username, a_name
    from public.profiles p order by p.created_at, p.id limit 1;
  select p.id, p.username into b, b_username
    from public.profiles p where p.id <> a order by p.created_at, p.id limit 1;

  if b is null then
    insert into pg_temp.phase2_rls_results
    values (0, 'setup', 'SKIPPED', 'Need at least two accounts. Sign up two test users in the app, then re-run.');
    return;
  end if;

  a_path := a::text || '/avatar-1700000000001.jpg';
  b_path := b::text || '/avatar-1700000000002.jpg';

  begin  -- ===== sub-transaction: everything below is rolled back =====

    -- ---------- setup as the database owner (rolled back) ----------
    insert into storage.objects (bucket_id, name, owner, owner_id) values ('avatars', b_path, b, b::text);
    insert into public.activity_event_types (id, label) values ('zz_smoke_test', 'Smoke test (rolled back)');
    perform public.record_activity_event(b, 'zz_smoke_test', 'smoke', '1');

    -- ---------- impersonate user A ----------
    perform set_config('request.jwt.claim.sub', a::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;

    -- settings
    select count(*) into n from public.user_settings where user_id = a;
    res := res || jsonb_build_array(jsonb_build_object('o', 1, 't', 'A reads own settings', 'ok', n = 1, 'd', n || ' row(s)'));

    select count(*) into n from public.user_settings where user_id = b;
    res := res || jsonb_build_array(jsonb_build_object('o', 2, 't', 'A cannot read B settings', 'ok', n = 0, 'd', n || ' row(s)'));

    update public.user_settings set notify_activity = false where user_id = a;
    get diagnostics n = row_count;
    res := res || jsonb_build_array(jsonb_build_object('o', 3, 't', 'A updates own notify_activity', 'ok', n = 1, 'd', n || ' row(s)'));

    update public.user_settings set notify_activity = false where user_id = b;
    get diagnostics n = row_count;
    res := res || jsonb_build_array(jsonb_build_object('o', 4, 't', 'A cannot update B settings', 'ok', n = 0, 'd', n || ' row(s) changed'));

    state := 'none';
    begin delete from public.user_settings where user_id = a; exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 5, 't', 'A cannot DELETE settings', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    -- profile RPC + tags
    state := 'none';
    begin
      perform public.update_my_profile(a_name, a_username, 'Smoke test bio', 'Cairo', null, array['climate', 'arts']);
    exception when others then state := sqlstate || ' ' || sqlerrm;
    end;
    select count(*) into n from public.user_profile_tags where user_id = a;
    res := res || jsonb_build_array(jsonb_build_object('o', 10, 't', 'A saves profile + 2 tags via RPC', 'ok', state = 'none' and n = 2, 'd', state || ', ' || n || ' tag(s)'));

    state := 'none';
    begin perform public.update_my_profile(a_name, upper(b_username), null, null, null, null);
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 11, 't', 'Duplicate username (other case) rejected', 'ok', state = '23505', 'd', 'sqlstate ' || state));

    state := 'none';
    begin perform public.update_my_profile(a_name, a_username, null, null, null,
                    array['climate', 'equality', 'mental-health', 'education', 'housing', 'community']);
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 12, 't', 'RPC rejects 6 tags', 'ok', state = '22023', 'd', 'sqlstate ' || state));

    state := 'none';
    begin perform public.update_my_profile(a_name, a_username, repeat('x', 161), null, null, null);
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 13, 't', 'Bio over 160 chars rejected', 'ok', state = '23514', 'd', 'sqlstate ' || state));

    state := 'none';
    begin
      insert into public.user_profile_tags (user_id, tag_id)
      select a, t from unnest(array['equality', 'mental-health', 'education', 'housing']) t;  -- 2 + 4 = 6
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 14, 't', 'Direct insert of 6th tag rejected', 'ok', state = '22023', 'd', 'sqlstate ' || state));

    state := 'none';
    begin insert into public.user_profile_tags (user_id, tag_id) values (b, 'tech');
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 15, 't', 'A cannot add tags to B', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin insert into public.profile_tags (id, label) values ('zz-hack', 'Hack');
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 16, 't', 'A cannot edit tag catalogue', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    -- avatars storage (RLS on storage.objects)
    state := 'none';
    begin insert into storage.objects (bucket_id, name, owner, owner_id) values ('avatars', a_path, a, a::text);
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 20, 't', 'A uploads to own avatars folder', 'ok', state = 'none', 'd', 'sqlstate ' || state));

    state := 'none';
    begin insert into storage.objects (bucket_id, name, owner, owner_id) values ('avatars', b::text || '/avatar-1700000000009.jpg', a, a::text);
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 21, 't', 'A cannot upload into B folder', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin insert into storage.objects (bucket_id, name, owner, owner_id) values ('avatars', a::text || '/../' || b::text || '/avatar-1700000000010.jpg', a, a::text);
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 22, 't', 'Path traversal / nested path rejected', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin insert into storage.objects (bucket_id, name, owner, owner_id) values ('avatars', a::text || '/evil.svg', a, a::text);
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 23, 't', 'Bad file name/extension rejected', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    update storage.objects set name = name where bucket_id = 'avatars' and name = b_path;
    get diagnostics n = row_count;
    res := res || jsonb_build_array(jsonb_build_object('o', 24, 't', 'A cannot overwrite B avatar', 'ok', n = 0, 'd', n || ' row(s) changed'));

    update storage.objects set metadata = '{}'::jsonb where bucket_id = 'avatars' and name = a_path;
    get diagnostics n = row_count;
    res := res || jsonb_build_array(jsonb_build_object('o', 25, 't', 'Nobody overwrites avatars (own included)', 'ok', n = 0, 'd', n || ' row(s) changed'));

    -- Hosted Supabase also blocks every direct SQL delete on storage tables
    -- ("Use the Storage API instead", 42501); either outcome means B's file survives.
    state := 'none';
    n := 0;
    begin
      delete from storage.objects where bucket_id = 'avatars' and name = b_path;
      get diagnostics n = row_count;
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 26, 't', 'A cannot delete B avatar', 'ok', n = 0, 'd', n || ' row(s) deleted, sqlstate ' || state));

    select count(*) into n from storage.objects where bucket_id = 'avatars' and name = b_path;
    res := res || jsonb_build_array(jsonb_build_object('o', 27, 't', 'A cannot list B avatar folder', 'ok', n = 0, 'd', n || ' row(s)'));

    -- avatar_path guard
    state := 'none';
    begin perform public.update_my_profile(a_name, a_username, null, null, a_path, null);
    exception when others then state := sqlstate || ' ' || sqlerrm; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 30, 't', 'A sets avatar_path to own uploaded file', 'ok', state = 'none', 'd', state));

    state := 'none';
    begin perform public.update_my_profile(a_name, a_username, null, null, b_path, null);
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 31, 't', 'A cannot use B file as avatar', 'ok', state in ('22023', '23514'), 'd', 'sqlstate ' || state));

    state := 'none';
    begin perform public.update_my_profile(a_name, a_username, null, null, a::text || '/avatar-1700000000099.png', null);
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 32, 't', 'Avatar path to missing file rejected', 'ok', state = '22023', 'd', 'sqlstate ' || state));

    state := 'none';
    begin update public.profiles set avatar_url = 'https://evil.example/x.png' where id = a;
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 33, 't', 'avatar_url no longer writable', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    -- Own-file delete: allowed by policy. On hosted Supabase direct SQL deletes are
    -- blocked for everyone (42501), so this is verified via the Storage API in the app tests.
    state := 'none';
    n := 0;
    begin
      delete from storage.objects where bucket_id = 'avatars' and name = a_path;
      get diagnostics n = row_count;
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 34, 't', 'A deletes own avatar file (policy allows)', 'ok', n = 1 or state = '42501',
             'd', case when state = '42501' then 'direct SQL delete blocked by Supabase; use Storage API test' else n || ' row(s) deleted' end));

    -- activity ledger
    state := 'none';
    begin insert into public.activity_events (user_id, event_type, source_table, source_id) values (a, 'zz_smoke_test', 'x', '1');
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 40, 't', 'A cannot insert activity events', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin perform public.record_activity_event(a, 'zz_smoke_test', 'x', '2');
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 41, 't', 'A cannot call record_activity_event', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    select count(*) into n from public.activity_events where user_id = b;
    res := res || jsonb_build_array(jsonb_build_object('o', 42, 't', 'A cannot read B activity events', 'ok', n = 0, 'd', n || ' row(s)'));

    state := 'none';
    begin update public.activity_events set occurred_at = now() where user_id = a;
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 43, 't', 'A cannot update activity events', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    -- impact
    select * into r from public.get_my_impact_summary();
    res := res || jsonb_build_array(jsonb_build_object('o', 50, 't', 'Impact summary: no approved formula → no points',
             'ok', r.formula_status = 'pending_approval' and r.impact_points is null and r.rank is null and r.streak is null,
             'd', r.formula_status || ', total_actions=' || r.total_actions));

    state := 'none';
    begin select count(*) into n from public.impact_scoring_versions;
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 51, 't', 'A cannot read scoring config', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin insert into public.impact_event_weights (version, event_type, points) values (1, 'zz_smoke_test', 999);
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 52, 't', 'A cannot write scoring weights', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    -- badges
    state := 'none';
    begin insert into public.badges (id, name) values ('zz_fake', 'Fake');
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 60, 't', 'A cannot create badges', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin insert into public.user_badges (user_id, badge_id) values (a, 'zz_fake');
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 61, 't', 'A cannot award self a badge', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    -- ---------- back to owner: ledger is append-only even for trusted code ----------
    reset role;
    state := 'none';
    begin update public.activity_events set occurred_at = now() where user_id = b;
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 70, 't', 'Ledger rejects UPDATE even by owner', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin delete from public.activity_events where user_id = b;
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 71, 't', 'Ledger rejects DELETE even by owner', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    -- ---------- impersonate signed-out visitor ----------
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    set local role anon;

    state := 'none';
    begin select count(*) into n from public.user_settings; exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 80, 't', 'anon cannot read settings', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin perform public.update_my_profile('x', 'xxx', null, null, null, null); exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 81, 't', 'anon cannot call update_my_profile', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin perform * from public.get_my_impact_summary(); exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 82, 't', 'anon cannot read impact summary', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin insert into storage.objects (bucket_id, name) values ('avatars', a::text || '/avatar-1700000000011.jpg');
    exception when others then state := sqlstate; end;
    res := res || jsonb_build_array(jsonb_build_object('o', 83, 't', 'anon cannot upload avatars', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    -- Always undo everything above.
    raise exception using errcode = 'GZ002', message = 'rollback phase 2 smoke test';
  exception
    when sqlstate 'GZ002' then
      null;  -- expected: sub-transaction rolled back, role reset
    when others then
      res := res || jsonb_build_array(jsonb_build_object('o', 99, 't', 'unexpected error', 'ok', false, 'd', sqlstate || ' ' || sqlerrm));
  end;

  insert into pg_temp.phase2_rls_results (ord, test, status, detail)
  select (e ->> 'o')::int, e ->> 't',
         case when (e ->> 'ok')::boolean then 'PASS' else 'FAIL' end,
         e ->> 'd'
    from jsonb_array_elements(res) as e;
end;
$$;

select test, status, detail from pg_temp.phase2_rls_results order by ord;
