// /api/google-callback.js  — Google 로그인 토큰 접수용 (Edge Function)
export const config = { runtime: 'edge' };

export default async function handler(req) {
  try {
    const url = new URL(req.url);

    // GIS는 redirect 모드에서 credential을 GET(쿼리) 또는 POST(form)로 보냄
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

    // ★ 여기서는 검증/세션 없이 "받기 성공"만 처리
    // 필요시: Google ID 토큰 검증 → 사용자 식별 → 자체 세션 발급 로직 추가

    // 가벼운 성공 쿠키(표시용)와 함께 메인으로 돌려보내기
    const headers = new Headers({
      'Location': '/?signed_in=1', // 성공 후 돌아갈 위치
      // 토큰 자체는 보안상 저장하지 않고, 표시용 플래그만
      'Set-Cookie': `g_signed=1; Path=/; Max-Age=600; HttpOnly; SameSite=Lax; Secure`
    });

    return new Response(null, { status: 302, headers });
  } catch (e) {
    return new Response('Callback error', { status: 500 });
  }
}
