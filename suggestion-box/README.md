# 📬 우리 반 익명 건의함 (Classroom Suggestion Box)

누구나 로그인 없이 자유롭고 안전하게 의견, 건의사항, 칭찬, 사진을 남길 수 있는 독립된 익명 웹앱입니다.

---

## 🌟 특징
1. **완전 익명 및 무로그인**: 로그인이나 회원가입 절차 없이 누구나 접속하여 바로 글과 사진을 등록할 수 있습니다.
2. **다중 사진 첨부 및 확대 뷰어**: 스마트폰 카메라 촬영 및 갤러리 다중 이미지 업로드를 완벽 지원하며, 사진을 터치하면 크게 볼 수 있습니다.
3. **카테고리 & 공감(하트)**: 건의사항, 칭찬·응원, 질문, 자유의견 탭 및 공감 토글 기능을 지원합니다.
4. **선생님/관리자 답변 피드백**: Supabase 테이블에서 `admin_reply` 컬럼을 입력하면 건의글 카드에 답변 상자가 표시됩니다.
5. **우리반 허브와 통일된 감성 UI**: 세이지 그린과 크림 베이지 기반의 차분하고 따뜻한 반응형 디자인입니다.

---

## 🛠️ 1단계: Supabase 설정 방법

1. [Supabase](https://supabase.com)에 로그인한 뒤 **New Project**를 눌러 건의함 전용 새 프로젝트를 만듭니다.
2. 프로젝트가 생성되면 좌측 메뉴의 **SQL Editor**로 이동합니다.
3. 이 폴더의 `supabase-schema.sql` 파일의 내용을 전체 복사하여 붙여넣고 우측 하단 **[Run]** 버튼을 누릅니다.
   - `suggestions` 테이블 자동 생성
   - 누구나 글/사진을 올릴 수 있는 RLS 정책 적용
   - `suggestion-images` 사진 저장용 스토리지 버킷 자동 생성
4. 좌측 메뉴 **Project Settings** > **API**로 이동하여 아래 두 값을 확인합니다:
   - **Project URL**
   - **anon public Key**
5. 이 폴더의 `.env` 파일에 복사한 값을 입력합니다:
   ```env
   VITE_SUPABASE_URL=https://[당신의-프로젝트-ID].supabase.co
   VITE_SUPABASE_ANON_KEY=[당신의-anon-키]
   ```

---

## 💻 2단계: 로컬 테스트 실행

1. 터미널을 열고 `suggestion-box` 폴더로 이동합니다:
   ```bash
   cd suggestion-box
   ```
2. 패키지를 설치합니다:
   ```bash
   npm install
   ```
3. 개발 서버를 실행합니다:
   ```bash
   npm run dev
   ```
4. 브라우저에서 `http://localhost:5174`로 접속하여 건의함 동작을 확인합니다.

---

## 🚀 3단계: Vercel에 무료 배포하기

1. 이 `suggestion-box` 폴더를 GitHub 새 레포지토리에 올리거나, Vercel CLI / Vercel 대시보드에서 프로젝트로 추가합니다.
2. Vercel 프로젝트 생성 시 **Environment Variables**(환경변수)에 아래 2개를 등록합니다:
   - `VITE_SUPABASE_URL` : 당신의 Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` : 당신의 Supabase anon public key
3. **Deploy**를 누르면 몇 분 내로 배포가 완료되고 사이트 주소(예: `https://our-class-suggestions.vercel.app`)가 발급됩니다.

---

## 🔗 4단계: 기존 '우리반 허브' 사이트에 건의함 주소 등록하기

배포된 건의함 사이트 주소를 복사한 뒤:
1. 기존 프로젝트의 `App.jsx` 파일 상단을 엽니다.
2. **`SUGGESTION_BOX_URL`** 변수를 찾아서 배포된 주소로 교체합니다:
   ```javascript
   // classroom-hub-source/App.jsx 약 17번째 줄:
   export const SUGGESTION_BOX_URL = 'https://당신의-건의함-배포주소.vercel.app'
   ```
3. 이제 기존 우리반 허브 사이트 왼쪽 메뉴의 **[건의함 바로가기]**를 클릭하면 해당 사이트로 즉시 이동합니다!
