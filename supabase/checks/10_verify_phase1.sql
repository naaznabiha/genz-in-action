-- =============================================================================
-- 10_verify_phase1.sql — READ-ONLY. Run AFTER the four Phase 1 migrations.
-- =============================================================================
-- Every row should show status = 'PASS'. Any 'FAIL' row names what is wrong.
-- Changes: NONE.
-- =============================================================================

with checks as (
  select 1 as ord, 'profiles table exists' as check_name,
         to_regclass('public.profiles') is not null as ok,
         '' as detail

  union all
  select 2, 'RLS enabled on profiles',
         coalesce((select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.profiles')), false),
         ''

  union all
  select 3, 'policy profiles_select_authenticated',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                  and policyname = 'profiles_select_authenticated' and cmd = 'SELECT'),
         ''

  union all
  select 4, 'policy profiles_update_own',
         exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                  and policyname = 'profiles_update_own' and cmd = 'UPDATE'),
         ''

  union all
  select 5, 'no INSERT/DELETE policies on profiles',
         not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
                      and cmd in ('INSERT', 'DELETE', 'ALL')),
         coalesce((select string_agg(policyname || ' (' || cmd || ')', ', ') from pg_policies
                    where schemaname = 'public' and tablename = 'profiles'), '')

  union all
  select 6, 'anon has no table privileges on profiles',
         not (has_table_privilege('anon', 'public.profiles', 'SELECT')
              or has_table_privilege('anon', 'public.profiles', 'INSERT')
              or has_table_privilege('anon', 'public.profiles', 'UPDATE')
              or has_table_privilege('anon', 'public.profiles', 'DELETE')),
         ''

  union all
  select 7, 'authenticated: SELECT yes, INSERT/DELETE no',
         has_table_privilege('authenticated', 'public.profiles', 'SELECT')
         and not has_table_privilege('authenticated', 'public.profiles', 'INSERT')
         and not has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
         ''

  union all
  select 8, 'authenticated cannot update id/created_at/updated_at',
         not has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE')
         and not has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE')
         and not has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'UPDATE')
         and has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE'),
         ''

  union all
  select 9, 'case-insensitive username index',
         to_regclass('public.profiles_username_lower_key') is not null,
         ''

  union all
  select 10, 'trigger on_auth_user_created on auth.users',
         exists (select 1 from pg_trigger t where t.tgrelid = 'auth.users'::regclass
                  and t.tgname = 'on_auth_user_created' and t.tgenabled <> 'D'),
         ''

  union all
  select 11, 'trigger profiles_set_updated_at',
         exists (select 1 from pg_trigger t where t.tgrelid = to_regclass('public.profiles')
                  and t.tgname = 'profiles_set_updated_at'),
         ''

  union all
  select 12, 'handle_new_user not callable by API roles',
         not has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
         and not has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'),
         ''

  union all
  select 13, 'is_username_available callable by anon',
         has_function_privilege('anon', 'public.is_username_available(text)', 'EXECUTE'),
         ''

  union all
  select 14, 'is_username_available rejects bad format',
         public.is_username_available('ab') = false
         and public.is_username_available('Has Space') = false
         and public.is_username_available('a%') = false,
         ''

  union all
  select 15, 'every auth user has a profile',
         not exists (select 1 from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)),
         (select count(*)::text || ' user(s) without profile' from auth.users u
           where not exists (select 1 from public.profiles p where p.id = u.id))
)
select check_name,
       case when ok then 'PASS' else 'FAIL' end as status,
       detail
from checks
order by ord;
