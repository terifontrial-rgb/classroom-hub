# 우리반 허브 (Classroom Hub)

교실의 급식, 수동 시간표, 월간 일정/D-DAY, 자유게시판, 계정 권한을 관리하는 반응형 웹앱입니다.

## 사용 기술
- React 18 + Vite
- Supabase Auth / PostgreSQL / Storage / Row Level Security
- Lucide React 아이콘
- 반응형 CSS
- 기본 PWA manifest (홈 화면 추가용 기반)

## 1. 준비할 프로그램
1. Node.js LTS: https://nodejs.org/
2. Visual Studio Code: https://code.visualstudio.com/
3. Supabase 계정 및 프로젝트: https://supabase.com/

## 2. Supabase SQL 실행 순서
Supabase 프로젝트의 SQL Editor에서 다음 파일을 순서대로 실행합니다.

1. `supabase/sql/01_schema_and_security.sql`
2. `supabase/sql/02_admin_role_function.sql`

그다음 사이트에서 최초 관리자 계정으로 회원가입하고, 로그인한 뒤:

3. `supabase/sql/03_set_first_admin.sql`의 이메일 두 곳을 실제 Google 이메일로 바꾸고 실행합니다.

최초 관리자가 된 뒤에는 사이트의 **계정 권한** 메뉴에서 이미 가입한 사용자를 선생님/관리자/학생으로 변경할 수 있습니다.
선생님은 급식·시간표·일정·중요 공지를 관리할 수 있지만 계정 권한 변경 메뉴에는 접근할 수 없습니다.

## 3. 환경변수 설정
프로젝트 최상위 폴더에서 `.env.example`을 복사해 `.env`로 이름을 바꿉니다.

Supabase 대시보드의 Project Settings → API에서:
- Project URL → `VITE_SUPABASE_URL`
- Publishable key → `VITE_SUPABASE_PUBLISHABLE_KEY`

주의:
- 브라우저용 Publishable Key만 사용하세요.
- `service_role` 또는 Secret API Key는 절대로 `VITE_` 환경변수에 넣거나 브라우저 코드에 넣지 마세요.
- `.env`는 GitHub 등에 공개하지 마세요.

## 4. 로컬 실행
VS Code에서 이 폴더를 연 다음 터미널에서 실행합니다.

```bash
npm install
npm run dev
```

터미널에 표시되는 주소(보통 `http://localhost:5173`)를 브라우저에서 엽니다.

## 5. Supabase 인증 URL 설정
Supabase → Authentication → URL Configuration에서:
- Site URL: 로컬 개발 중에는 `http://localhost:5173`
- Redirect URLs: `http://localhost:5173/**`

실제 배포 후에는 배포 도메인도 Redirect URLs에 추가하고 Site URL을 운영 도메인으로 변경하세요.

## 6. 계정과 권한
- 회원가입한 모든 계정은 기본 `student`입니다.
- 최초 관리자: SQL 파일 `03_set_first_admin.sql`에서 이메일을 지정합니다.
- 관리자: 모든 교실 콘텐츠와 계정 권한을 관리할 수 있습니다.
- 선생님: 급식/시간표/일정/중요 공지 등 콘텐츠 관리 가능. 계정 권한 변경은 불가합니다.
- 학생: 데이터 열람 가능, 자유게시판 일반 게시물 작성 가능.
- 중요 공지 작성 권한은 관리자/선생님에게만 있습니다.

## 7. 기능
- 홈: 오늘 급식, 오늘 시간표, 다가오는 D-DAY, 예정 일정, 중요 공지
- 급식: 날짜별 제목/안내와 이미지 최대 3개 등록
- 시간표: 월~금 요일별 수동 시간표, 교시별 과목/교실/담당 교사
- 일정: 월간 달력, 일정 설명, 선택적 D-DAY 표시
- 자유게시판: 학생 일반 글 작성, 교사/관리자 중요 공지 상단 고정
- 계정 권한: 관리자 전용 역할 변경

## 8. 모바일 및 홈 화면 추가
화면 크기에 따라 레이아웃이 바뀌도록 반응형으로 구성했습니다. `manifest.webmanifest`도 포함되어 있어 HTTPS로 배포한 뒤 모바일 브라우저 메뉴에서 **홈 화면에 추가**를 선택하면 앱 아이콘처럼 실행할 수 있습니다.

현재 버전은 기본 PWA manifest만 포함합니다. 오프라인 캐시, 푸시 알림, 앱스토어 배포는 구현되어 있지 않습니다.

## 9. 현재 버전의 범위 및 참고
- 컴시간 알리미 API는 연결하지 않았습니다. 요청대로 시간표는 수동 입력입니다.
- 급식 이미지는 Storage의 공개 버킷 URL을 사용합니다. 급식 이미지는 공개 정보로 취급하세요.
- 한 반에서 사용하는 단일 공간을 전제로 합니다. 여러 반/학급을 운영하려면 `class_id`와 학급별 접근 정책을 추가해야 합니다.
- 날짜/시간은 브라우저의 현지 날짜 기준으로 표시합니다.
- 실제 운영 전에는 배포 도메인에서 회원가입, 로그인, 역할 변경, RLS, 파일 업로드를 꼭 테스트하세요.