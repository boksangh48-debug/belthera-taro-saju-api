# Belthera · Tarot & Saju API (Full)
Build: v14 (Final Adaptive) — 2025-09-11 23:32:31 KST

## Quick Deploy
1) GitHub에 리포 생성 후 본 ZIP 전부 업로드
2) Vercel에서 Import 후 아래 환경변수 4개 입력 → Deploy
- OPENAI_API_KEY
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- PUBLIC_BASE_URL (예: https://<your-domain>.vercel.app)
(선택) REPORT_SIGNATURE

## OAuth
- /pages/login.html → Google Identity Services (redirect)
- Redirect URI: https://<your-domain>.vercel.app/pages/callback.html
- Authorized domain: <your-domain>.vercel.app

## Pages
- / (메인) · /pages/secure-gate.html (보안 게이트) · /pages/login.html (로그인)

## API (Edge)
- GET /api/health · /api/env · /api/reading
