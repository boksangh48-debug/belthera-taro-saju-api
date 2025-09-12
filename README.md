# Belthera Login Autoinject Patch

## 포함 파일
- /pages/login.html → Google Client ID 자동 삽입 버전
- /pages/callback.html → 로그인 완료 확인 페이지

## 적용 방법
1. 기존 프로젝트에 이 폴더의 파일들을 덮어쓰기
2. login.html 안의 `data-client_id`는 이미 발급받은 값으로 설정되어 있음
3. Vercel에서 Redeploy
