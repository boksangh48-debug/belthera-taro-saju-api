// /api/google-callback.js — Google 로그인 토큰 접수(Edge Function)
// 지금은 "받기 성공"만 처리하고, / 로 돌려보냅니다.
export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const url = new URL(req.url);

    // GIS는 redirect 모드에서 credential을 GET 또는 POST로 전달
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

    if (!credential) {
      return new Response('Missing credential', { status: 400 });
    }

    // ★ 여기서는 검증/세션 없이 성공 플래그만 부여
    const headers = new Headers({
      'Location': '/?signed_in=1',
      'Set-Cookie': 'g_signed=1; Path=/; Max-Age=600; HttpOnly; SameSite=Lax; Secure'
    });
    return new Response(null, { status: 302, headers });
  } catch (e) {
    return new Response('Callback error', { status: 500 });
  }
}
