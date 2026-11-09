-- 매일 생성하는 학급 공용 운세 저장 테이블
-- Supabase Dashboard > SQL Editor에서 한 번 실행하세요.

CREATE TABLE IF NOT EXISTS public.daily_fortunes (
  fortune_date date PRIMARY KEY,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_fortunes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_fortunes_read_authenticated" ON public.daily_fortunes;
CREATE POLICY "daily_fortunes_read_authenticated" ON public.daily_fortunes
FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.daily_fortunes FROM anon, authenticated;
GRANT SELECT ON public.daily_fortunes TO authenticated;

-- NEIS의 열량/원산지 안내가 과거 description에 저장된 행은 안내를 비웁니다.
-- 메뉴(title)는 보존하고 설명만 정리합니다.
UPDATE public.meals
SET description = ''
WHERE description IS NOT NULL
  AND description ~* '(kcal|쇠고기|돼지고기|닭고기|오리고기|쌀[[:space:]]*:|배추[[:space:]]*:|고춧가루|낙지[[:space:]]*:|명태[[:space:]]*:|고등어[[:space:]]*:|갈치[[:space:]]*:|꽃게[[:space:]]*:|참조기|다랑어|주꾸미|비고[[:space:]]*:)';

-- 이 SQL을 처음 적용할 때 이미 지나간 급식 행도 한 번 정리합니다.
DELETE FROM public.meals
WHERE meal_date < (now() AT TIME ZONE 'Asia/Seoul')::date;

NOTIFY pgrst, 'reload schema';
