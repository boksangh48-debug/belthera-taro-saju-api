# Belthera · 타로·사주 API — DESIGN-LOCK
Build: v14 — 2025-09-12 01:22:34 KST

## Deploy (Vercel)
1) GitHub 업로드 → Vercel Import
2) Settings → Build & Output Settings
   - Framework Preset = **Other**
   - Output Directory = **.**
3) Env 4개 입력 → Deploy
   - OPENAI_API_KEY / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / PUBLIC_BASE_URL
4) 확인
   - `/` 홈 열림, `/pages/secure-gate.html` 다크 UI
   - `/pages/login.html` Google 로그인 (Client ID 주입됨)
