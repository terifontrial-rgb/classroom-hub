# 우리반 허브

React 18 + Vite + Supabase + Vercel Serverless Functions로 구성된 학급 관리 웹앱입니다.

## 포함 기능
- 홈, 급식, 시간표, 일정/D-Day, 게시판, 계정 관리
- Gemini 3.8 Flash로 하루/주간/월간 급식표 이미지 인식
- 인식 결과를 확인·수정한 뒤 날짜별 급식 데이터로 저장
- 교사/관리자만 게시물 등록·삭제
- 교사는 학생 계정만 조회·삭제, 관리자는 학생·교사 계정 조회·삭제
- 계정 삭제 시 Auth 사용자, 프로필, 작성 게시물 연쇄 삭제
- D-Day 기존 UI 및 동작 유지

## 로컬 실행
1. Node.js LTS를 설치합니다.
2. 프로젝트 폴더에서 `npm install` 실행
3. `.env.example`을 복사해 `.env`로 저장하고 Supabase URL/Publishable Key를 입력
4. `npm run dev` 실행

## 서버 환경변수 (Vercel)
Vercel 프로젝트 Settings → Environment Variables에 아래 값을 등록합니다.
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (또는 `SUPABASE_SERVICE_ROLE_KEY`)
- `GEMINI_API_KEY`

`SUPABASE_SECRET_KEY`와 `GEMINI_API_KEY`는 절대로 `VITE_` 접두사를 붙이지 말고 클라이언트 코드에 넣지 마세요.

## Supabase SQL 실행
기존 데이터베이스에는 기존 파일을 다시 실행할 필요가 없습니다. 새 권한 변경만 적용하려면 `sql/04_feature_permissions_and_deletion.sql`을 Supabase SQL Editor에서 실행하세요. 최초 구축 DB라면 기존 `01_schema_and_security.sql`, `02_admin_role_function.sql` 등을 먼저 실행한 뒤 04번을 실행합니다.

## 회원가입 차단
로그인 화면의 공개 회원가입 버튼은 제거되어 있습니다. 기존 Supabase Auth 공개 가입 API까지 막으려면 Supabase Dashboard → Authentication → Sign In / Providers 또는 Auth 설정에서 새 사용자 가입(Signups)을 비활성화하세요. 계정은 교사/관리자용 서버 API를 통해 발급해야 합니다.

## API
- `GET /api/list-users`: 관리자 전체 계정, 교사는 학생 계정만 반환
- `POST /api/delete-user`: 역할을 서버에서 재검증한 뒤 계정 삭제
- `POST /api/recognize-meals`: 로그인한 교사/관리자만 Gemini 이미지 인식 요청 가능

계정 삭제는 Supabase Auth Admin API를 서버에서 호출합니다. DB의 FK `ON DELETE CASCADE`로 profiles와 작성 게시물이 함께 삭제됩니다.
