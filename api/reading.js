// /api/reading.js — SoulPattern GPT 리포트 (11섹션 고정, 보정 포함)
// ✅ 기능:
// 1) 소울넘버 서버 계산 (11/22 마스터 유지, 모든 숫자 합 반복 축약)
// 2) 오늘(KST) + 사용자 입력 기반 SHA-256 해시 → "결정론적 6장 타로카드" (랜덤 금지, 역방향 없음)
// 3) time='모름'이면 리듬 선택 강제
// 4) 모델 응답 검증: 섹션 11개, 각 4~6문장. 틀리면 자동 1회 보정 재시도.

export const config = { runtime: 'edge' };

/* ---------- Soul Number ---------- */
function calcSoulNumber(dateStr = '') {
  const digits = (dateStr.match(/\d/g) || []).map(x => +x);
  if (!digits.length) return 0;
  let sum = digits.reduce((a, b) => a + b, 0);

  const collapseOnce = n => ('' + n).split('').map(Number).reduce((a, b) => a + b, 0);

  while (sum >= 10 && sum !== 11 && sum !== 22) {
    sum = collapseOnce(sum);
  }
  return sum;
}

function soulArcanaMap(n) {
  const map = {
    0:'0 바보', 1:'Ⅰ 마법사', 2:'Ⅱ 여사제', 3:'Ⅲ 여황제', 4:'Ⅳ 황제', 5:'Ⅴ 교황',
    6:'Ⅵ 연인', 7:'Ⅶ 전차', 8:'Ⅷ 힘', 9:'Ⅸ 은둔자', 10:'Ⅹ 운명의 바퀴',
    11:'Ⅺ 정의', 12:'Ⅻ 매달린 사람', 13:'ⅩⅢ 죽음', 14:'ⅩⅣ 절제', 15:'ⅩⅤ 악마',
    16:'ⅩⅥ 탑', 17:'ⅩⅦ 별', 18:'ⅩⅧ 달', 19:'ⅩⅨ 태양', 20:'ⅩⅩ 심판', 21:'ⅩⅩⅠ 세계',
    22:'마스터 22(세계 확장)'
  };
  return map[n] ?? '';
}

/* ---------- Tarot Deck ---------- */
const MAJOR = [
  '0 바보','Ⅰ 마법사','Ⅱ 여사제','Ⅲ 여황제','Ⅳ 황제','Ⅴ 교황',
  'Ⅵ 연인','Ⅶ 전차','Ⅷ 힘','Ⅸ 은둔자','Ⅹ 운명의 바퀴',
  'Ⅺ 정의','Ⅻ 매달린 사람','ⅩⅢ 죽음','ⅩⅣ 절제','ⅩⅤ 악마',
  'ⅩⅥ 탑','ⅩⅦ 별','ⅩⅧ 달','ⅩⅨ 태양','ⅩⅩ 심판','ⅩⅩⅠ 세계'
];

// 오늘 KST (YYYY-MM-DD)
function todayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 결정론적 6장 선택 (SHA-256)
async function pick6Deterministic(seed, deckSize) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(seed));
  const bytes = Array.from(new Uint8Array(hash));

  const picks = new Set();
  let i = 0;
  while (picks.size < 6) {
    const chunk = (bytes[i % bytes.length] << 8) ^ (bytes[(i + 7) % bytes.length] << 4) ^ bytes[(i + 13) % bytes.length];
    const idx = Math.abs(chunk) % deckSize;
    picks.add(idx);
    i++;
  }
  return Array.from(picks);
}

/* ---------- Prompt ---------- */
function buildSystemPrompt({ soul_number, soul_arcana, drawn6 }) {
  return `당신은 감정 기반 리듬 상담 시스템 ‘SoulPattern GPT’입니다.

⟪역할⟫
사주 구조 분석 + 소울타로 감정 흐름 해석을 통합한 11섹션 리포트를 생성하세요.

⟪출력 규격⟫
- 반드시 {"sections":[...]} JSON 객체로만 반환.
- sections = 정확히 11개.
- 각 요소 = {"title":"<제목>", "body":"<4~6문장>"}.
- 제목 순서 고정:
  1 평생총운, 2 대운흐름, 3 전성기, 4 주의시기, 5 조언,
  6 능력운, 7 재물운, 8 애정운, 9 건강운, 10 소울타로카드, 11 정리

⟪소울넘버⟫
- ${soul_number} / ${soul_arcana}

⟪현재 상황 카드(결정론적)⟫
- ${drawn6.join(', ')}

⟪지침⟫
- 10번 섹션에 소울넘버/아르카나 + 위 6장 반드시 반영.
- 문체: 따뜻하고 단정, 한국어, 과도한 전문용어 금지.
- JSON 외 출력 금지.`;
}

/* ---------- Validation & Repair ---------- */
async function validateAndRepair(sections, apiKey, sys, usr) {
  const okLen = Array.isArray(sections) && sections.length === 11;
  const okBodies = okLen && sections.every(s => {
    if(!s || typeof s.title!=='string' || typeof s.body!=='string') return false;
    const sent = s.body.split(/[.!?]\s+/).filter(x=>x.trim().length>0).length;
    return sent >= 4 && sent <= 6;
  });
  if (okLen && okBodies) return sections;

  // 재시도
  const repairUser = `
JSON을 11섹션으로 다시 고쳐서 주세요.
조건: sections=11, 각 body=4~6문장, 순서 고정.
원본: ${JSON.stringify({sections: sections||[]})}`;

  const r2 = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${apiKey}`, 'Content-Type':'application/json' },
    body: JSON.stringify({
      model:'gpt-4o-mini',
      temperature:0.4,
      messages:[
        { role:'system', content: sys },
        { role:'user', content: usr },
        { role:'user', content: repairUser }
      ],
      response_format:{ type:'json_object' }
    })
  });
  if(!r2.ok) return sections || [];
  const j2 = await r2.json();
  let p2 = {};
  try { p2 = JSON.parse(j2.choices?.[0]?.message?.content || '{}'); } catch {}
  const sec2 = Array.isArray(p2.sections) ? p2.sections : [];
  return sec2;
}

/* ---------- Handler ---------- */
export default async function handler(req) {
  try {
    if (req.method !== 'POST') return new Response('Use POST', { status: 405 });

    const body = await req.json().catch(()=> ({}));
    const {
      name='고객', birth_date='', calendar_type='양력',
      time='모름', gender='미상', city='', question='',
      time_rhythm_selected='', final_summary_focus='감정'
    } = body || {};

    // 출생시간 모름 + 리듬 미선택 → 선택 요청
    const unknownSet = new Set(['','모름','unknown','알 수 없음','알수없음']);
    const timeUnknown = unknownSet.has((time||'').trim().toLowerCase());
    if (timeUnknown && !time_rhythm_selected) {
      return new Response(JSON.stringify({
        ok:false, need_time_rhythm:true,
        options:['오전형 (23:00~06:59)','낮형 (07:00~14:59)','저녁형 (15:00~22:59)'],
        message:'출생시간이 확인되지 않았습니다. 위 3가지 중 하나를 선택해 주세요.'
      }), { headers:{'Content-Type':'application/json'} });
    }

    // 소울넘버 계산
    const soul_number = calcSoulNumber(birth_date);
    const soul_arcana = soulArcanaMap(soul_number);

    // 현 상황 타로 6장 결정
    const seed = `[KST:${todayKST()}]|${name}|${birth_date}|${(question||'').slice(0,120)}`;
    const picks = await pick6Deterministic(seed, MAJOR.length);
    const drawn6 = picks.map(i => MAJOR[i]);

    // User Prompt
    const rhythmLabel = timeUnknown ? `모름→${time_rhythm_selected}` : time;
    const userPrompt = `
입력:
- 이름: ${name}
- 생년월일: ${birth_date} (${calendar_type})
- 출생시간/리듬: ${rhythmLabel}
- 성별: ${gender}
- 도시: ${city}
- 질문: ${question||'미입력'}
- 소울넘버: ${soul_number} / ${soul_arcana}
- 현재상황카드: ${drawn6.join(', ')}

요청:
- 반드시 11섹션 JSON만 반환.
- 각 body는 4~6문장.`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return new Response('Missing OPENAI_API_KEY', { status: 500 });

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${apiKey}`, 'Content-Type':'application/json' },
      body: JSON.stringify({
        model:'gpt-4o-mini',
        temperature:0.7,
        messages:[
          { role:'system', content: buildSystemPrompt({ soul_number, soul_arcana, drawn6 }) },
          { role:'user', content: userPrompt }
        ],
        response_format:{ type:'json_object' }
      })
    });

    if(!r.ok){
      const t = await r.text();
      return new Response(`OpenAI error: ${t}`, { status: 500 });
    }
    const data = await r.json();

    let parsed={};
    try { parsed = JSON.parse(data.choices?.[0]?.message?.content||'{}'); } catch {}
    let sections = Array.isArray(parsed.sections) ? parsed.sections : [];

    // 검증 + 자동 보정
    sections = await validateAndRepair(sections, apiKey, buildSystemPrompt({ soul_number, soul_arcana, drawn6 }), userPrompt);

    const headers = new Headers({
      'Content-Type':'application/json',
      'Set-Cookie':'qleft=5; Path=/; Max-Age=86400; SameSite=Lax; Secure'
    });
    return new Response(JSON.stringify({
      ok:true,
      sections,
      meta:{ soul_number, soul_arcana, drawn6, qleft:5 }
    }), { headers });

  } catch(e) {
    return new Response('reading error', { status: 500 });
  }
}
