-- =============================================================================
-- 00_preflight_inspect.sql — READ-ONLY. Run BEFORE any Phase 1 migration.
-- =============================================================================
-- Purpose : Show what already exists in your Supabase database that the
--           Phase 1 migrations would touch, so nothing is overwritten blindly.
-- Changes : NONE. This file only runs SELECT statements against catalogs.
-- How     : Supabase Dashboard → SQL Editor → New query → paste → Run.
--
-- Reading the result (one row per check):
--   status = 'OK'      → nothing conflicting; safe to continue.
--   status = 'EXISTS'  → an object with this name already exists. STOP and
--                        compare it with the migration before running it
--                        (send the `detail` column to whoever maintains this repo).
--   status = 'INFO'    → informational only.
-- =============================================================================

with checks as (
  select 1 as ord, 'postgres version' as check_name, 'INFO' as status,
         current_setting('server_version') as detail

  union all
  select 2, 'auth.users row count', 'INFO',
         (select count(*)::text || ' existing auth user(s)' from auth.users)

  union all
  select 3, 'table public.profiles',
         case when to_regclass('public.profiles') is null then 'OK' else 'EXISTS' end,
         coalesce((
           select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod), ', ' order by a.attnum)
           from pg_attribute a
           where a.attrelid = to_regclass('public.profiles') and a.attnum > 0 and not a.attisdropped
         ), 'not present')

  union all
  select 4, 'policies on public.profiles',
         case when exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles')
              then 'EXISTS' else 'OK' end,
         coalesce((select string_agg(policyname || ' (' || cmd || ')', ', ')
                   from pg_policies where schemaname = 'public' and tablename = 'profiles'), 'none')

  union all
  select 5, 'function public.set_updated_at',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                           where n.nspname = 'public' and p.proname = 'set_updated_at')
              then 'EXISTS' else 'OK' end,
         coalesce((select string_agg(pg_get_function_identity_arguments(p.oid), '; ')
                   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'set_updated_at'), 'not present')

  union all
  select 6, 'function public.handle_new_user',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                           where n.nspname = 'public' and p.proname = 'handle_new_user')
              then 'EXISTS' else 'OK' end,
         'If EXISTS: a template (e.g. the Supabase "User Management Starter") may already create profiles on signup.'

  union all
  select 7, 'function public.is_username_available',
         case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                           where n.nspname = 'public' and p.proname = 'is_username_available')
              then 'EXISTS' else 'OK' end,
         ''

  union all
  select 8, 'triggers on auth.users',
         case when exists (select 1 from pg_trigger t
                           where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal)
              then 'EXISTS' else 'OK' end,
         coalesce((select string_agg(t.tgname || ' → ' || t.tgfoid::regproc::text, ', ')
                   from pg_trigger t
                   where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal), 'none')

  union all
  select 9, 'other tables in public schema', 'INFO',
         coalesce((select string_agg(c.relname, ', ' order by c.relname)
                   from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')), 'none')
)
select check_name, status, detail
from checks
order by ord;
