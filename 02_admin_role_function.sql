-- 02. 관리자 전용 역할 변경 함수
-- 01_schema_and_security.sql 실행 후 실행하세요.
create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 계정 권한을 변경할 수 있습니다.';
  end if;

  if new_role not in ('admin', 'teacher', 'student') then
    raise exception '올바르지 않은 권한입니다.';
  end if;

  if target_user_id = (select auth.uid()) and new_role <> 'admin' then
    raise exception '현재 로그인한 관리자 본인의 권한은 변경할 수 없습니다.';
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id;

  if not found then
    raise exception '해당 계정을 찾을 수 없습니다.';
  end if;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, text) from public;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;