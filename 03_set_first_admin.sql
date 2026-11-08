-- 03. 최초 관리자 지정
-- 먼저 웹사이트에서 관리자 계정으로 회원가입/로그인한 다음 실행하세요.
-- 아래 이메일을 본인이 사용할 Google 이메일 주소로 바꿔서 실행하세요.
update public.profiles
set role = 'admin'
where lower(email) = lower('여기에_관리자로_사용할_Google_이메일_주소');

-- 아래 조회 결과에서 role이 admin인지 확인하세요.
select email, display_name, role
from public.profiles
where lower(email) = lower('여기에_관리자로_사용할_Google_이메일_주소');