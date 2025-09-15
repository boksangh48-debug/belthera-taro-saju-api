// /api/followup.js — 섹션별 추가 질문(5회 제한). 쿠키 qleft로 관리.
// 호출: POST /api/followup { sectionTitle, question, profile:{...원입력들} }
export const config = { runtime: 'edge' };

function getCookie(req, name){
  const c = req.headers.get('cookie') || '';
  const m = c.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));
  return m ? decodeURIComponent(m.split('=')[1]) : '';
}

function sysPrompt(){
  return `You are Belthera Tarot & Saju engine.
- Output in Korean.
- Given section title + user profile + a follow-up question, write a focused expansion of that section.
- Return JSON: { "title": "<원제목>", "answer": "<5~7문장 구체 답변>" } only.`;
}

export default async function handler(req){
  try{
    if(req.method!=='POST') return new Response('Use POST', {status:405});
    const apiKey = process.env.OPENAI_API_KEY;
    if(!apiKey) return new Response('Missing OPENAI_API_KEY', {status:500});

    // 남은 질문 횟수 확인/차감
    let qleft = parseInt(getCookie(req,'qleft') || '5', 10);
    if(Number.isNaN(qleft)) qleft = 5;
    if(qleft <= 0){
      return new Response(JSON.stringify({ ok:false, message:'추가 질문 한도를 초과했습니다(5회).' }), {
        status: 429, headers:{'Content-Type':'application/json'}
      });
    }

    const { sectionTitle='', question='', profile={} } = await req.json().catch(()=> ({}));
    const p = profile || {};
    const profileText = `이름:${p.name||'고객'}, 생년월일:${p.birth_date||''}(${p.calendar_type||'양력'}), 시간:${p.time||'모름'}, 성별:${p.gender||'미상'}, 도시:${p.city||''}`;

    const userPrompt = `대상 섹션 제목: ${sectionTitle}
사용자 프로필: ${profileText}
추가 질문: ${question}
요청: 위 섹션을 보강하는 5~7문장 답변(JSON)으로만 반환.`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${apiKey}`, 'Content-Type':'application/json' },
      body: JSON.stringify({
        model:'gpt-4o-mini',
        temperature:0.7,
        messages:[
          { role:'system', content: sysPrompt() },
          { role:'user',   content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if(!r.ok){
      const t = await r.text();
      return new Response(`OpenAI error: ${t}`, {status:500});
    }
    const data = await r.json();
    let parsed;
    try { parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}'); }
    catch { parsed = {}; }

    // 성공 시 1회 차감(qleft-1)
    const newLeft = Math.max(0, qleft - 1);
    const headers = new Headers({
      'Content-Type':'application/json',
      'Set-Cookie': `qleft=${newLeft}; Path=/; Max-Age=86400; SameSite=Lax; Secure`
    });
    return new Response(JSON.stringify({ ok:true, qleft:newLeft, result:parsed }), { headers });
  }catch(e){
    return new Response('followup error', {status:500});
  }
}
