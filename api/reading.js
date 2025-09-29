export const config = { runtime: 'edge' };

/* ---- helpers: load custom ---- */
async function loadCustom(origin) {
  try {
    const r = await fetch(`${origin}/configs/custom.json`, { cache: 'no-store' });
    if (!r.ok) throw new Error('no custom');
    return await r.json();
  } catch {
    return {
      brand: { voice: "따뜻하고 단정한 상담 톤, 직설적이되 공감 유지", avoid_jargon: true },
      report: { section_count: 11, sentences_per_section_min: 4, sentences_per_section_max: 6, final_summary_focus_default: "감정" },
      tarot: { deck_mode: "major_only", draw_mode: "deterministic_kst_seed", use_reversed: false },
      saju: { require_time_rhythm_when_unknown: true, time_rhythm_options: ["오전형","낮형","저녁형"] },
      followup: { limit_per_report: 5, sentences_min: 5, sentences_max: 7 }
    };
  }
}

/* ---- Tarot Deck ---- */
const MAJOR = [
  '0 바보','Ⅰ 마법사','Ⅱ 여사제','Ⅲ 여황제','Ⅳ 황제','Ⅴ 교황',
  'Ⅵ 연인','Ⅶ 전차','Ⅷ 힘','Ⅸ 은둔자','Ⅹ 운명의 바퀴',
  'Ⅺ 정의','Ⅻ 매달린 사람','ⅩⅢ 죽음','ⅩⅣ 절제','ⅩⅤ 악마',
  'ⅩⅥ 탑','ⅩⅦ 별','ⅩⅧ 달','ⅩⅨ 태양','ⅩⅩ 심판','ⅩⅩⅠ 세계'
];

function todayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9*60*60*1000);
  return kst.toISOString().slice(0,10);
}
async function pick6Deterministic(seed, deckSize) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(seed));
  const bytes = Array.from(new Uint8Array(hash));
  const picks = new Set(); let i=0;
  while (picks.size < 6) {
    const chunk = (bytes[i % bytes.length] << 8) ^ (bytes[(i+7)%bytes.length] << 4) ^ bytes[(i+13)%bytes.length];
    picks.add(Math.abs(chunk) % deckSize);
    i++;
  }
  return Array.from(picks);
}

function buildSystemPrompt(custom, { soul_number, soul_arcana, drawn6 }) {
  const R = custom.report;
  return `당신은 감정 기반 리듬 상담 시스템 ‘SoulPattern GPT’입니다.

⟪역할⟫
사주 구조 분석 + 소울타로 감정 흐름 해석을 통합한 감정 중심 리듬 리포트를 생성합니다.

⟪출력 규격⟫
- 반드시 {"sections":[...]} JSON 객체로만 반환.
- sections = 정확히 ${R.section_count}개.
- 각 요소 = {"title":"<제목>", "body":"<${R.sentences_per_section_min}~${R.sentences_per_section_max}문장>"}.
- 제목 순서 고정:
  1 평생총운, 2 대운흐름, 3 전성기, 4 주의시기, 5 조언,
  6 능력운, 7 재물운, 8 애정운, 9 건강운, 10 소울타로카드, 11 정리

⟪소울넘버⟫
- ${soul_number} / ${soul_arcana}

⟪현재 상황 카드(결정론적)⟫
- ${drawn6.join(', ')}

⟪브랜드 톤⟫
- ${custom.brand.voice}
- 전문용어 남발 금지: ${custom.brand.avoid_jargon ? '금지' : '허용'}

⟪지침⟫
- 10번 섹션에 소울넘버/아르카나 + 위 6장 반드시 반영.
- JSON 외 텍스트 금지.`;
}

async function validateAndRepair(custom, sections, apiKey, sys, usr) {
  const min = custom.report.sentences_per_section_min;
  const max = custom.report.sentences_per_section_max;
  const okLen = Array.isArray(sections) && sections.length === custom.report.section_count;
  const okBodies = okLen && sections.every(s => {
    if (!s || typeof s.title !== 'string' || typeof s.body !== 'string') return false;
    const sent = s.body.split(/[.!?]\s+/).filter(x => x.trim().length > 0).length;
    return sent >= min && sent <= max;
  });
  if (okLen && okBodies) return sections;

  const repairUser = `
다음 JSON을 조건에 맞게 고쳐주세요.
- sections=${custom.report.section_count}, 각 body=${min}~${max}문장, 제목 순서 고정.
원본: ${JSON.stringify({ sections: sections || [] })}`;

  const r2 = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: usr },
        { role: 'user', content: repairUser }
      ],
      response_format: { type: 'json_object' }
    })
  });
  if (!r2.ok) return sections || [];
  const j2 = await r2.json();
  let p2 = {}; try { p2 = JSON.parse(j2.choices?.[0]?.message?.content || '{}'); } catch {}
  return Array.isArray(p2.sections) ? p2.sections : [];
}

export default async function handler(req) {
  try {
    if (req.method !== 'POST') return new Response('Use POST', { status: 405 });

    const origin = new URL(req.url).origin;
    const custom = await loadCustom(origin);

    const body = await req.json().catch(() => ({}));
    const {
      name = '고객', birth_date = '', calendar_type = '양력',
      time = '모름', gender = '미상', city = '', question = '',
      time_rhythm_selected = '', final_summary_focus = custom.report.final_summary_focus_default
    } = body || {};

    const unknown = new Set(['', '모름', 'unknown', '알 수 없음', '알수없음']);
    if (custom.saju.require_time_rhythm_when_unknown && unknown.has((time || '').trim().toLowerCase()) && !time_rhythm_selected) {
      return new Response(JSON.stringify({
        ok: false, need_time_rhythm: true,
        options: custom.saju.time_rhythm_options.map(v => {
          const map = { '오전형': '23:00~06:59', '낮형': '07:00~14:59', '저녁형': '15:00~22:59' };
          return `${v} (${map[v] || ''})`;
        }),
        message: '출생시간이 확인되지 않았습니다. 위 3가지 중 하나를 선택해 주세요.'
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ✅ 소울넘버 API 호출
    const soulRes = await fetch(`${origin}/api/soul-number`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birth_date })
    });
    const soulData = await soulRes.json();
    const soul_number = soulData.soul_number;
    const soul_arcana = soulData.arcana;

    // 카드 결정
    const seed = `[KST:${todayKST()}]|${name}|${birth_date}|${(question || '').slice(0, 120)}`;
    const picks = await pick6Deterministic(seed, MAJOR.length);
    const drawn6 = picks.map(i => MAJOR[i]);

    const rhythmLabel = unknown.has((time || '').trim().toLowerCase()) ? `모름→${time_rhythm_selected}` : time;
    const userPrompt = `
입력:
- 이름: ${name}
- 생년월일: ${birth_date} (${calendar_type})
- 출생시간/리듬: ${rhythmLabel}
- 성별: ${gender}
- 도시: ${city}
- 질문: ${question || '미입력'}
- 소울넘버: ${soul_number} / ${soul_arcana}
- 현재상황카드(6): ${drawn6.join(', ')}
- 마무리 초점: ${final_summary_focus}

요청:
- 반드시 ${custom.report.section_count}개 섹션 JSON만 반환.
- 각 섹션 body는 ${custom.report.sentences_per_section_min}~${custom.report.sentences_per_section_max}문장.`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return new Response('Missing OPENAI_API_KEY', { status: 500 });

    const sys = buildSystemPrompt(custom, { soul_number, soul_arcana, drawn6 });
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: userPrompt }],
        response_format: { type: 'json_object' }
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return new Response(`OpenAI error: ${t}`, { status: 500 });
    }
    const data = await r.json();
    let parsed = {}; try { parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}'); } catch {}
    let sections = Array.isArray(parsed.sections) ? parsed.sections : [];

    sections = await validateAndRepair(custom, sections, apiKey, sys, userPrompt);

    const headers = new Headers({
      'Content-Type': 'application/json',
      'Set-Cookie': `qleft=${custom.followup.limit_per_report}; Path=/; Max-Age=86400; SameSite=Lax; Secure`
    });
    return new Response(JSON.stringify({
      ok: true,
      sections,
      meta: { soul_number, soul_arcana, drawn6, qleft: custom.followup.limit_per_report }
    }), { headers });

  } catch (e) {
    return new Response('reading error', { status: 500 });
  }
}
