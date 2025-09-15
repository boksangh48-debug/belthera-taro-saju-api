// /api/google-callback.js — Google 로그인 콜백 (Edge)
// 목적: 로그인 성공 시 "Custom GPT 공유 URL"로 즉시 이동
// 사용법: Vercel 환경변수에 CUSTOM_GPT_URL 설정 (예: https://chat.openai.com/g/g-xxxxxxxxxxxxxxxx)
// 보너스: /?signed_in=1 쿼리 + g_signed 쿠키로 성공 표식

export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    // credential 수신(검증/세션은 향후 단계에서 구현)
    let credential = url.searchParams.get('credential');

    if (!credential && req.method === 'POST') {
      const ct = req.headers.get('content-type') || '';
      if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
        const form = await req.formData();
        credential = form.get('credential');
      } else if (ct.includes('application/json')) {
        const body = await req.json().catch(() => ({}));
        credential = body.credential;
      }
    }

    // 성공 표식 쿠키(10분) + 이동 대상
    const gptUrl = (process.env.CUSTOM_GPT_URL || '').trim(); // 예) https://chat.openai.com/g/g-xxxxxxxxxxxxxxxx
    const dest = gptUrl ? appendSigned(gptUrl) : '/?signed_in=1';

    const headers = new Headers({
      'Location': dest,
      // 토큰 자체는 저장하지 않고, 성공 표식만 (보안상 안전)
      'Set-Cookie': 'g_signed=1; Path=/; Max-Age=600; HttpOnly; SameSite=Lax; Secure'
    });

    return new Response(null, { status: 302, headers });
  } catch (e) {
    return new Response('Callback error', { status: 500 });
  }
}

// 공유 URL에 ?signed_in=1 붙여서 상태 표시(파라미터 보존 필요 없으면 단순히 반환)
function appendSigned(base) {
  try {
    const u = new URL(base);
    u.searchParams.set('signed_in', '1');
    return u.toString();
  } catch {
    // base가 상대경로이거나 이상하면 그대로 사용
    return base;
  }
}
