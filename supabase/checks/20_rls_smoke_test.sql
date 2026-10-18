-- =============================================================================
-- 20_rls_smoke_test.sql — Two-user RLS test. LEAVES NO CHANGES BEHIND.
-- =============================================================================
-- Run AFTER the Phase 1 migrations AND after you have created two test
-- accounts in the app (spec §16: "verify RLS using two different users").
--
-- What it does: picks the two oldest profiles (A and B), impersonates A exactly
-- as the API would (role `authenticated` + JWT `sub` claim), tries allowed and
-- forbidden operations, then impersonates a signed-out visitor (`anon`).
-- All writes happen inside a sub-transaction that is ALWAYS rolled back at the
-- end, so no profile is actually modified. Results are shown as a table.
--
-- Every row should be PASS. A SKIPPED row means fewer than two accounts exist.
-- =============================================================================

create temp table if not exists phase1_rls_results (
  ord int, test text, status text, detail text
);
truncate phase1_rls_results;

do $$
declare
  a          uuid;
  b          uuid;
  b_username text;
  n          int;
  res        jsonb := '[]'::jsonb;
  ok         boolean;
  state      text;

  -- tiny helper inlined as a pattern: res := res || jsonb_build_array(jsonb_build_object(...))
begin
  select p.id into a from public.profiles p order by p.created_at, p.id limit 1;
  select p.id, p.username into b, b_username
    from public.profiles p where p.id <> a order by p.created_at, p.id limit 1;

  if b is null then
    insert into pg_temp.phase1_rls_results
    values (0, 'setup', 'SKIPPED', 'Need at least two accounts. Sign up two test users in the app, then re-run.');
    return;
  end if;

  begin  -- ===== sub-transaction: everything below is rolled back =====

    -- ---------- impersonate user A ----------
    perform set_config('request.jwt.claim.sub', a::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
    set local role authenticated;

    select count(*) into n from public.profiles where id = a;
    res := res || jsonb_build_array(jsonb_build_object('o', 1, 't', 'A can read own profile', 'ok', n = 1, 'd', n || ' row(s)'));

    select count(*) into n from public.profiles where id = b;
    res := res || jsonb_build_array(jsonb_build_object('o', 2, 't', 'A can read B profile (Phase 1 rule)', 'ok', n = 1, 'd', n || ' row(s)'));

    update public.profiles set display_name = 'RLS test (rolled back)' where id = a;
    get diagnostics n = row_count;
    res := res || jsonb_build_array(jsonb_build_object('o', 3, 't', 'A can update own display_name', 'ok', n = 1, 'd', n || ' row(s)'));

    select count(*) into n from public.profiles where id = a and updated_at = now();
    res := res || jsonb_build_array(jsonb_build_object('o', 4, 't', 'updated_at stamped by trigger', 'ok', n = 1, 'd', ''));

    update public.profiles set display_name = 'hacked' where id = b;
    get diagnostics n = row_count;
    res := res || jsonb_build_array(jsonb_build_object('o', 5, 't', 'A cannot update B profile', 'ok', n = 0, 'd', n || ' row(s) changed'));

    state := 'none';
    begin
      insert into public.profiles (id, username, display_name) values (gen_random_uuid(), 'rls_probe_x', 'x');
    exception when others then state := sqlstate;
    end;
    res := res || jsonb_build_array(jsonb_build_object('o', 6, 't', 'A cannot INSERT profiles', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin
      delete from public.profiles where id = a;
    exception when others then state := sqlstate;
    end;
    res := res || jsonb_build_array(jsonb_build_object('o', 7, 't', 'A cannot DELETE profiles', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin
      update public.profiles set created_at = now() - interval '1 year' where id = a;
    exception when others then state := sqlstate;
    end;
    res := res || jsonb_build_array(jsonb_build_object('o', 8, 't', 'A cannot change created_at', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    state := 'none';
    begin
      update public.profiles set username = b_username where id = a;
    exception when others then state := sqlstate;
    end;
    res := res || jsonb_build_array(jsonb_build_object('o', 9, 't', 'A cannot take B username', 'ok', state = '23505', 'd', 'sqlstate ' || state));

    state := 'none';
    begin
      update public.profiles set username = 'Bad Name!' where id = a;
    exception when others then state := sqlstate;
    end;
    res := res || jsonb_build_array(jsonb_build_object('o', 10, 't', 'Invalid username rejected', 'ok', state = '23514', 'd', 'sqlstate ' || state));

    -- ---------- impersonate signed-out visitor ----------
    reset role;
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    set local role anon;

    state := 'none';
    begin
      select count(*) into n from public.profiles;
    exception when others then state := sqlstate;
    end;
    res := res || jsonb_build_array(jsonb_build_object('o', 11, 't', 'anon cannot read profiles', 'ok', state = '42501', 'd', 'sqlstate ' || state));

    ok := public.is_username_available(b_username) = false
          and public.is_username_available(upper(b_username)) = false;
    res := res || jsonb_build_array(jsonb_build_object('o', 12, 't', 'anon RPC: taken username (any case) unavailable', 'ok', ok, 'd', ''));

    ok := public.is_username_available('zz_unused_' || substr(md5(random()::text), 1, 8));
    res := res || jsonb_build_array(jsonb_build_object('o', 13, 't', 'anon RPC: free username available', 'ok', ok, 'd', ''));

    -- Always undo everything above.
    raise exception using errcode = 'GZ001', message = 'rollback rls smoke test';
  exception
    when sqlstate 'GZ001' then
      null;  -- expected: sub-transaction rolled back, role reset
    when others then
      res := res || jsonb_build_array(jsonb_build_object('o', 99, 't', 'unexpected error', 'ok', false, 'd', sqlstate || ' ' || sqlerrm));
  end;

  insert into pg_temp.phase1_rls_results (ord, test, status, detail)
  select (e ->> 'o')::int, e ->> 't',
         case when (e ->> 'ok')::boolean then 'PASS' else 'FAIL' end,
         e ->> 'd'
    from jsonb_array_elements(res) as e;
end;
$$;

select test, status, detail from pg_temp.phase1_rls_results order by ord;
