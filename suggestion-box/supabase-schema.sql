-- ==============================================================================
-- 📬 [우리 반 익명 건의함] Supabase 초기 설정 SQL
-- 새로 만든 Supabase 프로젝트의 SQL Editor에 전체 내용을 붙여넣고 [Run]을 누르세요.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. 건의함 게시글 테이블
CREATE TABLE IF NOT EXISTS public.suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT '건의사항',
  nickname text NOT NULL DEFAULT '익명',
  image_paths text[] NOT NULL DEFAULT '{}',
  likes_count integer NOT NULL DEFAULT 0,
  admin_reply text, -- 선생님/반장의 답변이나 피드백(선택)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suggestions_created_idx ON public.suggestions(created_at DESC);

-- 2. RLS(행 단위 보안) 활성화 및 익명(anon) 누구나 작성/조회 허용
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- [조회] 누구나 모든 건의글을 볼 수 있습니다.
DROP POLICY IF EXISTS "anon_select_suggestions" ON public.suggestions;
CREATE POLICY "anon_select_suggestions" ON public.suggestions
FOR SELECT TO anon, authenticated USING (true);

-- [등록] 로그인 없이 누구나 익명으로 글을 올릴 수 있습니다.
DROP POLICY IF EXISTS "anon_insert_suggestions" ON public.suggestions;
CREATE POLICY "anon_insert_suggestions" ON public.suggestions
FOR INSERT TO anon, authenticated WITH CHECK (true);

-- [공감/수정] 공감(하트) 누르기 및 답변 기록을 위해 UPDATE를 허용합니다.
DROP POLICY IF EXISTS "anon_update_suggestions" ON public.suggestions;
CREATE POLICY "anon_update_suggestions" ON public.suggestions
FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. 이미지 저장용 Storage 버킷 (suggestion-images) 자동 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'suggestion-images',
  'suggestion-images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- [스토리지 조회] 누구나 첨부된 사진을 볼 수 있습니다.
DROP POLICY IF EXISTS "suggestion_images_read" ON storage.objects;
CREATE POLICY "suggestion_images_read" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'suggestion-images');

-- [스토리지 업로드] 로그인 없이 누구나 사진을 첨부해 올릴 수 있습니다.
DROP POLICY IF EXISTS "suggestion_images_insert" ON storage.objects;
CREATE POLICY "suggestion_images_insert" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'suggestion-images');

-- 익명(anon) 사용자 권한 부여
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.suggestions TO anon, authenticated;
