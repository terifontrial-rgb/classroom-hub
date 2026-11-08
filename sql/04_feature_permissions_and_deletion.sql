-- 우리반 허브 기능 변경 SQL
-- Supabase Dashboard > SQL Editor에서 실행하세요.
-- 학생 게시물 등록 차단, 교사/관리자 게시물 등록·삭제 허용

-- 기존 이름으로 만들어진 게시물 정책 제거
DROP POLICY IF EXISTS "posts_insert_own_nonimportant_or_staff" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own_or_staff" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own_or_staff" ON public.posts;
DROP POLICY IF EXISTS "posts_staff_insert" ON public.posts;
DROP POLICY IF EXISTS "posts_staff_update" ON public.posts;
DROP POLICY IF EXISTS "posts_staff_delete" ON public.posts;

CREATE POLICY "posts_staff_insert" ON public.posts
FOR INSERT TO authenticated
WITH CHECK (
  author_id = (SELECT auth.uid())
  AND public.is_staff()
);

CREATE POLICY "posts_staff_update" ON public.posts
FOR UPDATE TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

CREATE POLICY "posts_staff_delete" ON public.posts
FOR DELETE TO authenticated
USING (public.is_staff());

-- Auth 사용자 삭제 시 profiles와 해당 사용자의 게시물도 함께 삭제되도록 보장
DO $$
DECLARE fk_name text;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'posts'
    AND con.contype = 'f'
    AND pg_get_constraintdef(con.oid) LIKE 'FOREIGN KEY (author_id)%';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.posts DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 정책 적용 확인용: 학생은 INSERT/UPDATE/DELETE 권한 정책을 통과할 수 없고,
-- 관리자/선생님만 게시물을 등록·수정·삭제할 수 있습니다.
