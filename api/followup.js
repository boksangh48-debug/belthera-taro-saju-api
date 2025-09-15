// /api/followup.js — 섹션별 추가 질문 (커스텀 기반, 5회 제한)
export const config = { runtime: 'edge' };

function getCookie(req, name){
  const c = req.headers.get('cookie') || '';
  const m = c.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='));
  return m ? decodeURIComponent(m.split('=')[1]) : '';
}
async function loadCustom(origin){
  try{
    const r = await fetch(`${origin}/configs/custom.json`, { cache:'no-store' });
    if(!r.ok) throw new Error('no custom');
    return await r.json();
  }catch{
    return { followup:{ limit_per_report:5, sentences_min:5, sentences_max:7 } };
  }
}
function buildSys(custom){
  return `You are Belthera Tarot & Saju engine.
- Output in Korean only.
- Return JSON object: {"title":"<원제목>", "answer":"<${custom.followup.sentences_min}~${custom.followup.sentences_max}문장>"}.
- No extra fields, no markdown, no codeblocks.`;
}

export default async function handler(req){
  try{
    if(req.method!=='POST') return new Response('Use POST', {status:405});
    const origin = new URL(req.url).origin;
    const custom = await loadCustom(origin);

    // 질문 한도 체크
    let qleft = parseInt(getCookie(req,'qleft') || `${custom.followup.limit_per_report}`, 10);
    if(Number.isNaN(qleft)) qleft = custom.followup.limit_per_report;
    if(qleft <= 0){
      return new Response(JSON.stringify({ ok:false, message:`추가 질문 한도를 초과했습니다(${custom.followup.limit_per_report}회).` }), {
        status: 429, headers:{'Content-Type':'application/json'}
      });
    }

    const { sectionTitle='', question='', profile={} } = await req.json().catch(()=> ({}));
    const p = profile || {};
    const profileText = `이름:${p.name||'고객'}, 생년월일:${p.birth_date||''}(${p.calendar_type||'양력'}), 시간:${p.time||'모름'}, 성별:${p.gender||'미상'}, 도시:${p.city||''}`;

    const user = `대상 섹션 제목: ${sectionTitle}
사용자 프로필: ${profileText}
추가 질문: ${question}
요청: 위 섹션을 보강하는 ${custom.followup.sentences_min}~${custom.followup.sentences_max}문장 답변(JSON)으로만 반환.`;

    const apiKey = process.env.OPENAI_API_KEY;
    if(!apiKey) return new Response('Missing OPENAI_API_KEY', {status:500});

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${apiKey}`, 'Content-Type':'application/json' },
      body: JSON.stringify({
        model:'gpt-4o-mini',
        temperature:0.7,
        messages:[ {role:'system', content: buildSys(custom)}, {role:'user', content: user} ],
        response_format:{ type:'json_object' }
      })
    });

    if(!r.ok){
      const t = await r.text();
      return new Response(`OpenAI error: ${t}`, {status:500});
    }
    const data = await r.json();
    let parsed={}; try { parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}'); } catch {}
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
