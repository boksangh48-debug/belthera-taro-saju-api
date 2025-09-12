# Belthera · Tarot & Saju API — FULL FIXED
Build: v14 — 2025-09-12 01:10:52 KST

## Deploy (Vercel)
1) GitHub 업로드 → Vercel Import
2) Project Settings → Build & Output Settings
   - **Framework Preset = Other**
   - **Output Directory = .**  (루트)
3) ENV 4개 입력 → Deploy
   - OPENAI_API_KEY
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - PUBLIC_BASE_URL = https://belthera-taro-saju-api.vercel.app
   - (선택) REPORT_SIGNATURE

확인:
- /api/env → { ok: true, env: true }
- / → 루트 index.html 열림
- /pages/login.html → Google 로그인
- 인앱에서는 /pages/secure-gate.html 안내
