-- 01. 기본 테이블, 역할, RLS, Storage 설정
-- Supabase SQL Editor에서 이 파일을 먼저 실행하세요.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'student' check (role in ('admin','teacher','student')),
  created_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  meal_date date not null unique,
  title text,
  description text,
  image_paths text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 1 and 5),
  period smallint not null check (period between 1 and 12),
  subject text not null,
  room text,
  teacher text,
  created_at timestamptz not null default now(),
  unique (weekday, period)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  title text not null,
  description text,
  is_dday boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  is_important boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists events_date_idx on public.events(event_date);
create index if not exists posts_created_idx on public.posts(created_at desc);

-- 신규 가입 시 학생 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 권한 확인 함수: RLS 정책에서 재귀 호출을 피하기 위해 SECURITY DEFINER 사용
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() in ('admin','teacher'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

-- 프로필은 로그인한 사용자에게 열람 허용, 역할 변경은 전용 RPC만 사용
alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.events enable row level security;
alter table public.posts enable row level security;

drop policy if exists "profiles_read_authenticated" on public.profiles;
create policy "profiles_read_self_or_admin" on public.profiles
for select to authenticated using (id = (select auth.uid()) or public.is_admin());

drop policy if exists "meals_read_authenticated" on public.meals;
create policy "meals_read_authenticated" on public.meals
for select to authenticated using (true);
drop policy if exists "meals_staff_insert" on public.meals;
create policy "meals_staff_insert" on public.meals
for insert to authenticated with check (public.is_staff());
drop policy if exists "meals_staff_update" on public.meals;
create policy "meals_staff_update" on public.meals
for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "meals_staff_delete" on public.meals;
create policy "meals_staff_delete" on public.meals
for delete to authenticated using (public.is_staff());

drop policy if exists "timetable_read_authenticated" on public.timetable_entries;
create policy "timetable_read_authenticated" on public.timetable_entries
for select to authenticated using (true);
drop policy if exists "timetable_staff_insert" on public.timetable_entries;
create policy "timetable_staff_insert" on public.timetable_entries
for insert to authenticated with check (public.is_staff());
drop policy if exists "timetable_staff_update" on public.timetable_entries;
create policy "timetable_staff_update" on public.timetable_entries
for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "timetable_staff_delete" on public.timetable_entries;
create policy "timetable_staff_delete" on public.timetable_entries
for delete to authenticated using (public.is_staff());

drop policy if exists "events_read_authenticated" on public.events;
create policy "events_read_authenticated" on public.events
for select to authenticated using (true);
drop policy if exists "events_staff_insert" on public.events;
create policy "events_staff_insert" on public.events
for insert to authenticated with check (public.is_staff());
drop policy if exists "events_staff_update" on public.events;
create policy "events_staff_update" on public.events
for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "events_staff_delete" on public.events;
create policy "events_staff_delete" on public.events
for delete to authenticated using (public.is_staff());

drop policy if exists "posts_read_authenticated" on public.posts;
create policy "posts_read_authenticated" on public.posts
for select to authenticated using (true);
drop policy if exists "posts_insert_own_nonimportant_or_staff" on public.posts;
create policy "posts_insert_own_nonimportant_or_staff" on public.posts
for insert to authenticated with check (
  author_id = (select auth.uid())
  and (is_important = false or public.is_staff())
);
drop policy if exists "posts_update_own_or_staff" on public.posts;
create policy "posts_update_own_or_staff" on public.posts
for update to authenticated using (
  author_id = (select auth.uid()) or public.is_staff()
) with check (
  (author_id = (select auth.uid()) or public.is_staff())
  and (is_important = false or public.is_staff())
);
drop policy if exists "posts_delete_own_or_staff" on public.posts;
create policy "posts_delete_own_or_staff" on public.posts
for delete to authenticated using (
  author_id = (select auth.uid()) or public.is_staff()
);

-- 급식 이미지 저장소: 읽기는 로그인 사용자, 업로드/삭제는 선생님·관리자
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-images', 'meal-images', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

drop policy if exists "meal_images_read" on storage.objects;
create policy "meal_images_read" on storage.objects
for select to authenticated using (bucket_id = 'meal-images');
drop policy if exists "meal_images_staff_insert" on storage.objects;
create policy "meal_images_staff_insert" on storage.objects
for insert to authenticated with check (bucket_id = 'meal-images' and public.is_staff());
drop policy if exists "meal_images_staff_update" on storage.objects;
create policy "meal_images_staff_update" on storage.objects
for update to authenticated using (bucket_id = 'meal-images' and public.is_staff())
with check (bucket_id = 'meal-images' and public.is_staff());
drop policy if exists "meal_images_staff_delete" on storage.objects;
create policy "meal_images_staff_delete" on storage.objects
for delete to authenticated using (bucket_id = 'meal-images' and public.is_staff());

grant usage on schema public to authenticated;
grant select on public.profiles, public.meals, public.timetable_entries, public.events, public.posts to authenticated;
grant insert, update, delete on public.meals, public.timetable_entries, public.events, public.posts to authenticated;