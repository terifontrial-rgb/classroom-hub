-- 프로필 이름/사진 변경과 삭제 권한 보강
-- Supabase Dashboard > SQL Editor에서 실행하세요.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path text;

-- 프로필 갱신은 본인 또는 교사/관리자만 가능하며, 변경 가능한 컬럼은 이름과 사진 경로뿐입니다.
DROP POLICY IF EXISTS "profiles_update_self_or_staff" ON public.profiles;
CREATE POLICY "profiles_update_self_or_staff" ON public.profiles
FOR UPDATE TO authenticated
USING (id = (SELECT auth.uid()) OR public.is_staff())
WITH CHECK (id = (SELECT auth.uid()) OR public.is_staff());

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name, avatar_path) ON public.profiles TO authenticated;

-- 아바타 파일은 로그인한 사용자에게 공개하고, 업로드/삭제는 본인 또는 교사/관리자만 허용합니다.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-avatars', 'profile-avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS "profile_avatars_read" ON storage.objects;
CREATE POLICY "profile_avatars_read" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'profile-avatars');
DROP POLICY IF EXISTS "profile_avatars_insert_self_or_staff" ON storage.objects;
CREATE POLICY "profile_avatars_insert_self_or_staff" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'profile-avatars'
  AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR public.is_staff()
  )
);
DROP POLICY IF EXISTS "profile_avatars_update_self_or_staff" ON storage.objects;
CREATE POLICY "profile_avatars_update_self_or_staff" ON storage.objects
FOR UPDATE TO authenticated USING (
  bucket_id = 'profile-avatars' AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.is_staff())
) WITH CHECK (
  bucket_id = 'profile-avatars' AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.is_staff())
);
DROP POLICY IF EXISTS "profile_avatars_delete_self_or_staff" ON storage.objects;
CREATE POLICY "profile_avatars_delete_self_or_staff" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'profile-avatars' AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR public.is_staff())
);

-- 기존 이름의 삭제 정책을 재생성해 staff 삭제 권한을 명확히 보장합니다.
DROP POLICY IF EXISTS "meals_staff_delete" ON public.meals;
CREATE POLICY "meals_staff_delete" ON public.meals
FOR DELETE TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "timetable_staff_delete" ON public.timetable_entries;
CREATE POLICY "timetable_staff_delete" ON public.timetable_entries
FOR DELETE TO authenticated USING (public.is_staff());
GRANT DELETE ON public.meals, public.timetable_entries TO authenticated;
