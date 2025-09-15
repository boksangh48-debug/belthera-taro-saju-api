// /api/reading.js — Tarot·Saju 리포트 생성 API (Edge)
// 호출: POST /api/reading  { name,birth_date,calendar_type,time,gender,city,question }
// 반환: { ok:true, sections:[{title, body}], meta:{qleft:5} }
export const config = { runtime: 'edge' };

function sysPrompt(){
  return `You are Belthera Tarot & Saju engine.
- Output in Korean.
- Return ONLY 11 sections as JSON array of {title, body}.
- Each section body must be 4~6 full sentences (구체적·실행가능·중복금지).
- Sections (fixed order):
  1 평생총운, 2 대운흐름, 3 전성기, 4 주의시기, 5 조언,
  6 능력운, 7 재물운, 8 애정운, 9 건강운, 10 소울타로카드, 11 정리
- No headings outside, no markdown, no disclaimers.`;
}

export default async function handler(req){
  try{
    if(req.method!=='POST') return new Response('Use POST', {status:405});
    const b = await req.json().catch(()=> ({}));
    const {
      name='고객', birth_date='', calendar_type='양력',
      time='모름', gender='미상', city='', question=''
    } = b || {};

    const userPrompt = `입력:
- 이름: ${name}
- 생년월일: ${birth_date} (${calendar_type})
- 태어난 시간: ${time}
- 성별: ${gender}
- 태어난 도시: ${city}
- 주요 질문/의도: ${question}

요청:
- 위 정보를 바탕으로 11개 섹션(JSON)으로만 답하세요.
- 각 섹션은 { "title": "<제목>", "body": "<4~6문장>" } 형태.`;

    const apiKey = process.env.OPENAI_API_KEY;
    if(!apiKey) return new Response('Missing OPENAI_API_KEY', {status:500});

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
    // 모델 응답은 {"sections":[...]} 형태여야 함
    let parsed;
    try { parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}'); }
    catch { parsed = {}; }

    const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
    // 최초 리포트 생성 시, 추가 질문 5회 남음(qleft=5) 쿠키 부여
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Set-Cookie': 'qleft=5; Path=/; Max-Age=86400; SameSite=Lax; Secure'
    });
    return new Response(JSON.stringify({ ok:true, sections, meta:{ qleft:5 } }), { headers });
  }catch(e){
    return new Response('reading error', {status:500});
  }
}
