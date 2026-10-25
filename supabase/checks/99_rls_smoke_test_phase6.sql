-- =============================================================================
-- 99_rls_smoke_test_phase6.sql — Two-user communities test. LEAVES NO CHANGES BEHIND.
-- =============================================================================
-- Run AFTER the Phase 6 migrations with at least two accounts. Picks the two
-- oldest profiles: A (creates and owns the communities) and B, who goes
-- through every case in turn — non-member, invited, member, admin, removed,
-- blocked, and finally owner after a transfer. Impersonates them exactly as
-- the API would (role `authenticated` + JWT sub). Everything runs in a
-- sub-transaction that is ALWAYS rolled back. Every row should be PASS.
-- =============================================================================

create temp table if not exists phase6_results (ord int, test text, status text, detail text);
truncate phase6_results;

create or replace function pg_temp.rr6(o int, t text, ok boolean, d text)
returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('o', o, 't', t, 'ok', coalesce(ok, false), 'd', coalesce(d, '')));
$$;

do $$
declare
  a uuid; b uuid;
  res jsonb := '[]'::jsonb;
  pub uuid; priv uuid; inv uuid; inv2 uuid;
  ma uuid; mb uuid; mpriv uuid; ct uuid; cp uuid; pp uuid;
  n int; n2 int; state text; txt text; ok boolean;
  claims_a text; claims_b text;
begin
  select p.id into a from public.profiles p order by p.created_at, p.id limit 1;
  select p.id into b from public.profiles p where p.id <> a order by p.created_at, p.id limit 1;
  if b is null then
    insert into pg_temp.phase6_results values (0, 'setup', 'SKIPPED', 'Need at least two accounts.');
    return;
  end if;
  claims_a := json_build_object('sub', a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', b, 'role', 'authenticated')::text;

  begin  -- ===== everything below is rolled back =====
    update public.profiles set is_private = false where id in (a, b);
    delete from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a);
    update public.user_settings set notify_activity = true where user_id in (a, b);

    -- ================= A creates =================
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    pub := public.create_community('Smoke test public community', 'Open to everyone', null, false);
    priv := public.create_community('Smoke test private community', 'Invite only', null, true);
    select g.my_role into txt from public.get_community(pub) g;
    res := res || pg_temp.rr6(1, 'Creating a community makes you its owner', txt = 'owner', coalesce(txt, '-'));
    state := 'none';
    begin perform public.create_community('ab', '', null, false); exception when others then state := sqlstate; end;
    res := res || pg_temp.rr6(2, 'Community names need 3–60 characters', state = '23514', 'sqlstate ' || state);
    insert into public.community_messages (community_id, author_id, body) values (pub, a, 'Welcome to the public one') returning id into ma;
    insert into public.community_messages (community_id, author_id, body) values (priv, a, 'Private hello') returning id into mpriv;
    insert into public.community_content (community_id, author_id, title, body) values (priv, a, 'Private guide', 'Members only text') returning id into ct;
    pp := public.create_community_post(priv, 'story', 'climate', 'Private community post', 'Only members of the private community see this.', null, null, null, null, null);
    cp := public.create_community_post(pub, 'story', 'climate', 'Public community post', 'Anyone can read this, members see it in Home.', null, null, null, null, null);
    state := 'none';
    begin insert into public.communities (owner_id, name) values (a, 'Direct insert'); exception when others then state := sqlstate; end;
    res := res || pg_temp.rr6(3, 'Communities can only be created through the RPC', state = '42501', 'sqlstate ' || state);
    reset role;

    -- ================= B: non-member =================
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    select count(*) into n from public.get_communities('discover') g where g.id in (pub, priv);
    res := res || pg_temp.rr6(10, 'Both communities are listed (identity is public)', n = 2, n || ' listed');
    select g.can_read into ok from public.get_community(pub) g;
    select count(*) into n from public.get_community_messages(pub);
    res := res || pg_temp.rr6(11, 'Non-member can read a PUBLIC community', ok and n >= 1, n || ' message(s)');
    select g.can_read into ok from public.get_community(priv) g;
    select count(*) into n from public.community_messages where community_id = priv;
    select count(*) into n2 from public.community_content where community_id = priv;
    res := res || pg_temp.rr6(12, 'Non-member can NEVER read a private community''s discussion or content', not ok and n = 0 and n2 = 0, 'messages ' || n || ', content ' || n2);
    select count(*) into n from public.get_community_members(priv);
    select coalesce(g.pinned_count, -1) into n2 from public.get_community(priv) g;
    res := res || pg_temp.rr6(13, '…nor its member list or counts', n = 0 and n2 = -1, 'members ' || n || ', pinned ' || n2);
    select count(*) into n from public.posts where id = pp;
    select count(*) into n2 from public.query_posts(p_post_id => pp);
    res := res || pg_temp.rr6(14, '…nor posts shared to it', n = 0 and n2 = 0, n || ' / ' || n2);
    select count(*) into n from public.query_posts(p_post_id => cp);
    select count(*) into n2 from public.query_posts(p_limit => 50) q where q.id = cp;
    res := res || pg_temp.rr6(15, 'A public community''s post is readable, but not in a non-member''s Home feed', n = 1 and n2 = 0, n || ' / ' || n2);
    state := 'none';
    begin insert into public.community_messages (community_id, author_id, body) values (pub, b, 'not a member yet'); exception when others then state := sqlstate; end;
    res := res || pg_temp.rr6(16, 'Non-member cannot post in the discussion', state = '42501', 'sqlstate ' || state);
    state := 'none';
    begin perform public.join_community(priv); exception when others then state := sqlstate || ' ' || sqlerrm; end;
    res := res || pg_temp.rr6(17, 'A private community cannot be joined without an invite', state like 'P0001%GENZ_COMMUNITY_PRIVATE%', state);
    state := 'none';
    begin perform public.create_community_post(priv, 'story', 'climate', 'Sneaky post title', 'Trying to post into a community I am not in.', null, null, null, null, null);
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr6(18, 'Non-member cannot share a post to the community', state = '42501', 'sqlstate ' || state);

    -- ================= B joins the public one =================
    txt := public.join_community(pub);
    insert into public.community_messages (community_id, author_id, body) values (pub, b, 'Hi everyone!') returning id into mb;
    res := res || pg_temp.rr6(20, 'Public community: join instantly, then post', txt = 'member' and mb is not null, txt);
    select count(*) into n from public.query_posts(p_limit => 50) q where q.id = cp;
    res := res || pg_temp.rr6(21, 'Members see the community''s posts in Home', n = 1, n || ' row(s)');
    state := 'none';
    begin insert into public.community_message_pins (message_id) values (ma); exception when others then state := sqlstate; end;
    res := res || pg_temp.rr6(22, 'A member cannot pin', state = '42501', 'sqlstate ' || state);
    insert into public.community_message_stars (message_id) values (ma);
    select count(*) into n from public.get_starred_messages(pub);
    res := res || pg_temp.rr6(23, 'A member can star a message (in their Starred list)', n = 1, n || ' starred');
    delete from public.community_messages where id = ma;
    get diagnostics n = row_count;
    res := res || pg_temp.rr6(24, 'A member cannot delete someone else''s message', n = 0, n || ' deleted');
    state := 'none';
    begin perform public.invite_to_community(pub, a); exception when others then state := sqlstate; end;
    res := res || pg_temp.rr6(25, 'A member cannot invite', state = '42501', 'sqlstate ' || state);
    reset role;

    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.community_message_stars where message_id = ma;
    select coalesce(bool_or(m.starred_by_me), false) into ok from public.get_community_messages(pub) m where m.id = ma;
    res := res || pg_temp.rr6(26, 'Stars are visible only to the person who starred', n = 0 and not ok, n || ' visible to A');

    -- ================= invites =================
    inv := public.invite_to_community(priv, b);
    inv2 := public.invite_to_community(priv, b);
    res := res || pg_temp.rr6(30, 'Inviting twice keeps one pending invite', inv = inv2, '');
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    select count(*) into n from public.get_notification_list() g
     where g.type = 'community_invite' and g.community_id = priv and g.invite_status = 'pending' and g.unread;
    select count(*) into n2 from public.get_my_community_invites() i where i.invite_id = inv;
    res := res || pg_temp.rr6(31, 'The invited person gets a notification and sees the invite', n = 1 and n2 = 1, n || ' / ' || n2);
    select count(*) into n from public.community_messages where community_id = priv;
    select g.pending_invite_id into inv2 from public.get_community(priv) g;
    res := res || pg_temp.rr6(32, 'Invited (not yet accepted) still cannot read', n = 0 and inv2 = inv, n || ' message(s)');
    txt := public.respond_to_invite(inv, true);
    select count(*) into n from public.community_messages where community_id = priv;
    select count(*) into n2 from public.community_content where community_id = priv;
    insert into public.community_messages (community_id, author_id, body) values (priv, b, 'Thanks for the invite');
    res := res || pg_temp.rr6(33, 'After accepting, the member can read and post', txt = 'accepted' and n >= 1 and n2 = 1, 'messages ' || n || ', content ' || n2);
    select count(*) into n from public.query_posts(p_post_id => pp);
    res := res || pg_temp.rr6(34, '…and read posts shared to the community', n = 1, n || ' row(s)');
    perform public.leave_community(priv);
    select count(*) into n from public.community_messages where community_id = priv;
    res := res || pg_temp.rr6(35, 'Leaving a private community removes access', n = 0, n || ' message(s)');
    reset role;

    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.get_notification_list() g where g.type = 'community_invite_accepted' and g.actor_id = b and g.community_id = priv;
    res := res || pg_temp.rr6(36, 'The inviter is told the invite was accepted', n = 1, n || ' item(s)');
    inv := public.invite_to_community(priv, b);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    txt := public.respond_to_invite(inv, false);
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.get_notification_list() g where g.type = 'community_invite_declined' and g.actor_id = b;
    res := res || pg_temp.rr6(37, 'A declined invite is reported to the inviter', txt = 'declined' and n = 1, txt);
    inv := public.invite_to_community(priv, b);
    perform public.cancel_invite(inv);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    select count(*) into n from public.get_notification_list() g where g.type = 'community_invite' and g.target_id = inv;
    state := 'none';
    begin perform public.respond_to_invite(inv, true); exception when others then state := sqlstate; end;
    res := res || pg_temp.rr6(38, 'A cancelled invite disappears and can''t be accepted', n = 0 and state = 'PT404', n || ', ' || state);
    reset role;

    -- ================= admin =================
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    inv := public.invite_to_community(priv, b);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    perform public.respond_to_invite(inv, true);
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    perform public.set_member_role(priv, b, 'admin');
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    select count(*) into n from public.get_notification_list() g where g.type = 'community_role' and g.community_id = priv;
    insert into public.community_message_pins (message_id) values (mpriv);
    res := res || pg_temp.rr6(40, 'Made admin (notified); an admin can pin', n = 1, n || ' notification(s)');
    state := 'none';
    begin perform public.set_member_role(priv, a, 'member'); exception when others then state := sqlstate; end;
    txt := 'none';
    begin perform public.remove_member(priv, a); exception when others then txt := sqlstate; end;
    res := res || pg_temp.rr6(41, 'An admin cannot change roles or remove the owner', state = '42501' and txt = '42501', state || ' / ' || txt);
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.get_pinned_messages(priv) g where g.id = mpriv;
    select coalesce(bool_or(m.pinned), false) into ok from public.get_community_messages(priv) m where m.id = mpriv;
    res := res || pg_temp.rr6(42, 'Pins are seen by all members', n = 1 and ok, n || ' pinned');
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    insert into public.community_content (community_id, author_id, title, body) values (priv, b, 'Admin guide', 'Written by B') returning id into ct;
    delete from public.community_messages where id = mpriv;   -- admins may remove others' messages
    get diagnostics n = row_count;
    res := res || pg_temp.rr6(43, 'An admin can remove others'' messages', n = 1, n || ' deleted');
    perform public.leave_community(priv);
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n from public.get_community_feed(priv) f where f.id = ct and f.author_id = b and not f.author_is_member;
    select count(*) into n2 from public.get_notification_list() g where g.type = 'community_content' and g.target_id = ct;
    res := res || pg_temp.rr6(44, 'Content stays (with its author) after the author leaves; members were notified', n = 1 and n2 = 1, n || ' / ' || n2);
    state := 'none';
    begin perform public.leave_community(priv); exception when others then state := sqlstate || ' ' || sqlerrm; end;
    res := res || pg_temp.rr6(45, 'The owner cannot leave before transferring ownership', state like 'P0001%GENZ_OWNER_MUST_TRANSFER%', state);

    -- ================= transfer + delete =================
    inv := public.invite_to_community(priv, b);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    perform public.respond_to_invite(inv, true);
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    state := 'none';
    begin perform public.delete_community(priv); exception when others then state := sqlstate || ' ' || sqlerrm; end;
    res := res || pg_temp.rr6(50, 'An owner can''t delete a community that has other members', state like 'P0001%GENZ_COMMUNITY_HAS_MEMBERS%', state);
    perform public.transfer_ownership(priv, b);
    select g.my_role into txt from public.get_community(priv) g;
    perform public.leave_community(priv);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    select g.my_role into state from public.get_community(priv) g;
    select count(*) into n from public.get_notification_list() g where g.type = 'community_owner' and g.community_id = priv;
    res := res || pg_temp.rr6(51, 'Ownership transfer: old owner becomes admin and can then leave; new owner notified',
                              txt = 'admin' and state = 'owner' and n = 1, coalesce(txt, '-') || ' → ' || coalesce(state, '-'));
    perform public.delete_community(priv);
    select count(*) into n from public.communities where id = priv;
    reset role;
    select count(*) into n2 from public.posts where id = pp;
    res := res || pg_temp.rr6(52, 'The sole remaining owner can delete it (its posts go with it)', n = 0 and n2 = 0, n || ' / ' || n2);

    -- ================= removed =================
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    perform public.remove_member(pub, b);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    state := 'none';
    begin perform public.join_community(pub); exception when others then state := sqlstate || ' ' || sqlerrm; end;
    res := res || pg_temp.rr6(60, 'Someone removed can''t rejoin a public community by themselves', state like 'P0001%GENZ_COMMUNITY_REMOVED%', state);
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    inv := public.invite_to_community(pub, b);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    txt := public.respond_to_invite(inv, true);
    select g.my_role into state from public.get_community(pub) g;
    res := res || pg_temp.rr6(61, '…but an admin can invite them back', txt = 'accepted' and state = 'member', coalesce(state, '-'));

    -- ================= blocks =================
    perform public.block_user(a);
    select count(*) into n from public.get_community_messages(pub) m where m.author_id = a;
    reset role;
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    select count(*) into n2 from public.get_community_messages(pub) m where m.author_id = b;
    state := 'none';
    begin perform public.invite_to_community(pub, b); exception when others then state := sqlstate; end;
    res := res || pg_temp.rr6(70, 'Blocking hides each person''s messages from the other, and blocks invites',
                              n = 0 and n2 = 0 and state = 'PT404', n || ' / ' || n2 || ' / ' || state);
    select count(*) into n from public.get_community_members(pub) m where m.user_id = b;
    res := res || pg_temp.rr6(71, 'Blocked people are hidden from the member list', n = 0, n || ' row(s)');
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    perform public.unblock_user(a);
    reset role;

    -- ================= community-media storage =================
    perform set_config('request.jwt.claims', claims_a, true);
    set local role authenticated;
    priv := public.create_community('Smoke test media community', '', null, true);
    state := 'none';
    begin insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
          values ('community-media', priv || '/' || a || '/msg-1700000000001.pdf', a, a::text, '{"mimetype":"application/pdf","size":1024}');
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr6(80, 'A member can upload into their own folder', state = 'none', state);
    insert into public.community_messages (community_id, author_id, body, attachment_path, attachment_kind, attachment_name)
    values (priv, a, 'Agenda attached', priv || '/' || a || '/msg-1700000000001.pdf', 'pdf', 'agenda.pdf');
    state := 'none';
    begin insert into public.community_messages (community_id, author_id, body, attachment_path, attachment_kind)
          values (priv, a, 'ghost file', priv || '/' || a || '/msg-1700000000009.pdf', 'pdf');
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr6(81, 'An attachment must really be uploaded first', state = '22023', 'sqlstate ' || state);
    state := 'none';
    begin insert into public.community_messages (community_id, author_id, body, attachment_path, attachment_kind)
          values (priv, a, 'wrong kind', priv || '/' || a || '/msg-1700000000001.pdf', 'image');
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr6(82, 'The declared kind must match the file (PDF is not a photo)', state = '22023', 'sqlstate ' || state);
    reset role;
    perform set_config('request.jwt.claims', claims_b, true);
    set local role authenticated;
    select count(*) into n from storage.objects where bucket_id = 'community-media' and name = priv || '/' || a || '/msg-1700000000001.pdf';
    state := 'none';
    begin insert into storage.objects (bucket_id, name, owner, owner_id, metadata)
          values ('community-media', priv || '/' || b || '/msg-1700000000002.pdf', b, b::text, '{"mimetype":"application/pdf","size":10}');
    exception when others then state := sqlstate; end;
    res := res || pg_temp.rr6(83, 'Non-members can''t read or upload a private community''s files', n = 0 and state = '42501', n || ' / ' || state);
    reset role;

    -- ================= signed out =================
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    set local role anon;
    txt := '';
    begin perform * from public.get_communities(); txt := txt || 'get_communities '; exception when others then null; end;
    begin perform public.create_community('Anon community', '', null, false); txt := txt || 'create '; exception when others then null; end;
    begin perform * from public.community_messages; txt := txt || 'messages '; exception when others then null; end;
    res := res || pg_temp.rr6(90, 'Signed-out users can''t read or create communities', txt = '', txt);

    raise exception using errcode = 'GZ006', message = 'rollback phase 6 smoke test';
  exception
    when sqlstate 'GZ006' then null;
    when others then
      res := res || pg_temp.rr6(99, 'unexpected error', false, sqlstate || ' ' || sqlerrm);
  end;

  insert into pg_temp.phase6_results (ord, test, status, detail)
  select (e ->> 'o')::int, e ->> 't', case when (e ->> 'ok')::boolean then 'PASS' else 'FAIL' end, e ->> 'd'
    from jsonb_array_elements(res) e;
end;
$$;

select test, status, detail from pg_temp.phase6_results order by ord;
