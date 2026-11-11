-- 07. 게시물 이미지 첨부 / 수정 지원 및 '일정만' 권한 추가
-- Supabase Dashboard > SQL Editor에서 이 쿼리를 실행하세요.

-- 1. profiles 테이블 role 제약조건에 'schedule_only' 추가
DO $$
DECLARE r_constraint text;
BEGIN
  SELECT con.conname INTO r_constraint
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'profiles'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%role%';

  IF r_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', r_constraint);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'teacher', 'student', 'schedule_only'));

-- 2. 관리자 역할 변경 함수(admin_set_user_role)에 'schedule_only' 허용
CREATE OR REPLACE FUNCTION public.admin_set_user_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자만 계정 권한을 변경할 수 있습니다.';
  END IF;

  IF new_role NOT IN ('admin', 'teacher', 'student', 'schedule_only') THEN
    RAISE EXCEPTION '올바르지 않은 권한입니다.';
  END IF;

  IF target_user_id = (SELECT auth.uid()) AND new_role <> 'admin' THEN
    RAISE EXCEPTION '현재 로그인한 관리자 본인의 권한은 변경할 수 없습니다.';
  END IF;

  UPDATE public.profiles
  SET role = new_role
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '해당 계정을 찾을 수 없습니다.';
  END IF;
END;
$$;

-- 3. 일정 관리 권한 검사 함수 (관리자, 선생님, 일정만)
CREATE OR REPLACE FUNCTION public.can_manage_events()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(public.current_user_role() IN ('admin', 'teacher', 'schedule_only'), false)
$$;

-- 4. events 테이블 RLS 정책: '일정만' 권한 사용자도 일정 추가·수정·삭제 가능하도록 설정
DROP POLICY IF EXISTS "events_staff_insert" ON public.events;
DROP POLICY IF EXISTS "events_manage_insert" ON public.events;
CREATE POLICY "events_manage_insert" ON public.events
FOR INSERT TO authenticated
WITH CHECK (public.can_manage_events());

DROP POLICY IF EXISTS "events_staff_update" ON public.events;
DROP POLICY IF EXISTS "events_manage_update" ON public.events;
CREATE POLICY "events_manage_update" ON public.events
FOR UPDATE TO authenticated
USING (public.can_manage_events())
WITH CHECK (public.can_manage_events());

DROP POLICY IF EXISTS "events_staff_delete" ON public.events;
DROP POLICY IF EXISTS "events_manage_delete" ON public.events;
CREATE POLICY "events_manage_delete" ON public.events
FOR DELETE TO authenticated
USING (public.can_manage_events());

GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;

-- 5. posts 테이블에 이미지 경로 배열(image_paths) 및 수정일(updated_at) 컬럼 추가
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_paths text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 6. posts 테이블 수정(UPDATE) 권한 정책 확인 및 갱신 (선생님/관리자 수정 허용)
DROP POLICY IF EXISTS "posts_staff_update" ON public.posts;
CREATE POLICY "posts_staff_update" ON public.posts
FOR UPDATE TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

GRANT UPDATE ON public.posts TO authenticated;

-- 7. 게시물 이미지 저장용 스토리지 버킷(post-images) 생성 및 정책 설정
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('post-images', 'post-images', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

-- 게시물 이미지는 로그인한 사용자가 모두 열람 가능
DROP POLICY IF EXISTS "post_images_read" ON storage.objects;
CREATE POLICY "post_images_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'post-images');

-- 게시물 이미지 업로드/수정/삭제는 선생님·관리자(is_staff)만 가능
DROP POLICY IF EXISTS "post_images_staff_insert" ON storage.objects;
CREATE POLICY "post_images_staff_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'post-images' AND public.is_staff()
);

DROP POLICY IF EXISTS "post_images_staff_update" ON storage.objects;
CREATE POLICY "post_images_staff_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'post-images' AND public.is_staff()
)
WITH CHECK (
  bucket_id = 'post-images' AND public.is_staff()
);

DROP POLICY IF EXISTS "post_images_staff_delete" ON storage.objects;
CREATE POLICY "post_images_staff_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'post-images' AND public.is_staff()
);
