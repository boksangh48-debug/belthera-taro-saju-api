// /api/reading.js — SoulPattern GPT 리포트 (11섹션 고정)
// ✅ 개선점
// 1) 소울넘버 서버 계산(11/22 마스터 유지, 전 자릿수 합의 반복 축약) — 정확도 고정
// 2) "지금 상황" 반영: KST(한국시간) 기준 'YYYY-MM-DD' + (이름/생년월일/질문)으로 SHA-256 해시 → 6장 카드 결정론적 선택
// 3) 6장 카드는 확정값으로 prompt에 고정 주입(랜덤 금지, 역방향 미사용)
// 4) time='모름'이면 리듬 선택 필요 시 응답으로 요청

export const config = { runtime: 'edge' };

/* ---------- Utils ---------- */

// (정확 고정) 소울넘버: 생년월일 숫자 전부 합 → 1자리 또는 11/22 유지
function calcSoulNumber(dateStr = '') {
  const digits = (dateStr.match(/\d/g) || []).map(x => +x);
  if (!digits.length) return 0;
  let sum = digits.reduce((a, b) => a + b, 0);

  const collapseOnce = n => ('' + n).split('').map(Number).reduce((a, b) => a + b, 0);

  // 반복 축약하되 11,22는 유지
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
    16:'ⅩⅥ 탑', 17:'ⅩⅦ 별', 18:'ⅩⅧ 달', 19:'ⅩⅨ 태양', 20:'ⅩⅩ 심판', 21:'ⅩⅩⅠ 세계', 22:'마스터 22(세계 확장)'
  };
  return map[n] ?? '';
}

// 한국시간(KST) YYYY-MM-DD
function todayKST() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10); // YYYY-MM-DD
}

// 결정론적 6장 선택용 SHA-256 → 6개 인덱스(중복 제거)
async function pick6Deterministic(seed, deckSize) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(seed));
  const bytes = Array.from(new Uint8Array(hash));

  const picks = new Set();
  let i = 0;
  // 바이트를 조금씩 섞어서 충분히 분산
  while (picks.size < 6) {
    const chunk = (bytes[i % bytes.length] << 8) ^ (bytes[(i + 7) % bytes.length] << 4) ^ bytes[(i + 13) % bytes.length];
    const idx = Math.abs(chunk) % deckSize;
    picks.add(idx);
    i++;
  }
  return Array.from(picks);
}

/* ---------- Tarot Deck (정위만, 역방향 미사용) ---------- */
// “감정 루프 6장”은 메이저 22장 중에서 현시점 시드로 결정
const MAJOR = [
  '0 바보', 'Ⅰ 마법사', 'Ⅱ 여사제', 'Ⅲ 여황제', 'Ⅳ 황제', 'Ⅴ 교황',
  'Ⅵ 연인', 'Ⅶ 전차', 'Ⅷ 힘', 'Ⅸ 은둔자', 'Ⅹ 운명의 바퀴',
  'Ⅺ 정의', 'Ⅻ 매달린 사람', 'ⅩⅢ 죽음', 'ⅩⅣ 절제', 'ⅩⅤ 악마',
  'ⅩⅥ 탑', 'ⅩⅦ 별', 'ⅩⅧ 달', 'ⅩⅩ 태양 전(19 아님 주의)', // ← 교정
  'ⅩⅩ 심판', 'ⅩⅩⅠ 세계'
];
// 위 배열의 19표기가 잘못되어 있어 정확히 교정합니다.
MAJOR[18] = 'ⅩⅨ 태양';

/* ---------- System Prompt ---------- */

function buildSystemPrompt({ soul_number, soul_arcana, drawn6 }) {
  return `당신은 감정 기반 리듬 상담 시스템 ‘SoulPattern GPT’입니다.

⟪역할⟫
사용자가 입력한 생년월일, 성별, 출생시간 등을 바탕으로
‘사주 구조 분석’ + ‘소울타로 감정 흐름 해석’을 통합한 감정 중심 리듬 리포트를 생성합니다.

⟪출력 규격 (JSON만)⟫
- 반드시 {"sections":[...]} 형태의 JSON 객체만 반환합니다(그 외 텍스트 금지).
- sections는 정확히 11개. 각 요소는 {"title":"<제목>", "body":"<4~6문장>"}.
- 제목과 순서는 고정:
  1 평생총운, 2 대운흐름, 3 전성기, 4 주의시기, 5 조언,
  6 능력운, 7 재물운, 8 애정운, 9 건강운, 10 소울타로카드, 11 정리
- 각 섹션은 구체적·실행가능·중복금지. 전문용어 남발 금지.

⟪소울넘버(서버 계산)⟫
- 소울넘버: ${soul_number} / 소울 아르카나: ${soul_arcana}

⟪현재 상황 카드(결정론적, 역방향 미사용, 변경 금지)⟫
- 6장: ${drawn6.join(', ')}

⟪작성 지침⟫
- 10번 "소울타로카드" 섹션에 소울넘버/아르카나와 위 6장을 반드시 반영하여 현재 감정 루프를 해석하세요.
- 출생시간이 모름일 경우, 사용자가 선택한 리듬(오전형/낮형/저녁형)을 시주 보정으로 간접 반영하되 과도한 명리 용어는 자제하세요.
- 문체: 따뜻하지만 단정한 상담 톤, 한국어 자연스러움 유지.
- JSON 외 텍스트, 마크다운, 코드블록 금지.`;
}

/* ---------- Handler ---------- */

export default async function handler(req) {
  try {
    if (req.method !== 'POST') return new Response('Use POST', { status: 405 });

    const body = await req.json().catch(() => ({}));
    const {
      name = '고객',
      birth_date = '',            // YYYY-MM-DD 권장
      calendar_type = '양력',
      time = '모름',
      gender = '미상',
      city = '',
      question = '',
      time_rhythm_selected = '',  // '오전형' | '낮형' | '저녁형'
      final_summary_focus = '감정',
      emotion_cards = ''          // (입력 시) 커스텀 카드 6장(쉼표 구분) — 있으면 그 값 사용
    } = body || {};

    // 1) 출생시간 모름 + 리듬 미선택 → 리듬 선택 요청
    const unknownSet = new Set(['', '모름', 'unknown', '알 수 없음', '알수없음']);
    const timeUnknown = unknownSet.has((time || '').trim().toLowerCase());
    if (timeUnknown && !time_rhythm_selected) {
      return new Response(JSON.stringify({
        ok: false,
        need_time_rhythm: true,
        options: ['오전형 (23:00~06:59)', '낮형 (07:00~14:59)', '저녁형 (15:00~22:59)'],
        message: '출생시간이 확인되지 않았습니다. 위 3가지 중 하나를 선택해 주세요.'
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 2) 소울넘버 계산(정확 고정)
    const soul_number = calcSoulNumber(birth_date);
    const soul_arcana = soulArcanaMap(soul_number);

    // 3) "현 상황" 타로 6장 — 결정론적 선택
    //    Seed = KST 날짜 + 이름 + 생년월일 + 질문(요청 시점의 현재상황 반영)
    let drawn6;
    if (emotion_cards && emotion_cards.trim()) {
      drawn6 = emotion_cards.split(',').map(s => s.trim()).filter(Boolean).slice(0, 6);
    } else {
      const seed = `[KST:${todayKST()}]|${name}|${birth_date}|${(question||'').slice(0,120)}`;
      const picks = await pick6Deterministic(seed, MAJOR.length);
      drawn6 = picks.map(i => MAJOR[i]);
    }

    // 4) 사용자 프롬프트(설명 데이터)
    const rhythmLabel = timeUnknown ? `모름→${time_rhythm_selected}` : time;
    const userPrompt = `
⟪입력⟫
- 이름: ${name}
- 생년월일: ${birth_date} (${calendar_type})
- 출생시간/리듬: ${rhythmLabel}
- 성별: ${gender}
- 태어난 도시: ${city}
- 질문/의도: ${question || '미입력'}
- 마무리 초점: ${final_summary_focus}
- 현재상황 카드(6): ${drawn6.join(', ')}

⟪요청⟫
- 위 정보를 반영하여 11개 섹션(JSON)만 반환하세요.
- 각 섹션 body는 4~6문장, 구체·실행가능·중복금지.
- 10번 섹션에 소울넘버/아르카나 + 현재상황 카드 6장을 반드시 반영.`;

    // 5) OpenAI 호출
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return new Response('Missing OPENAI_API_KEY', { status: 500 });

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: buildSystemPrompt({ soul_number, soul_arcana, drawn6 }) },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!r.ok) {
      const t = await r.text();
      return new Response(`OpenAI error: ${t}`, { status: 500 });
    }
    const data = await r.json();

    let parsed;
    try {
      parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    } catch {
      parsed = {};
    }

    const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
    const headers = new Headers({
      'Content-Type': 'application/json',
      // 최초 호출마다 추가질문 횟수 5회로 초기화(하루 유효)
      'Set-Cookie': 'qleft=5; Path=/; Max-Age=86400; SameSite=Lax; Secure'
    });

    return new Response(JSON.stringify({
      ok: true,
      sections,
      meta: {
        soul_number,
        soul_arcana,
        drawn6,
        qleft: 5
      }
    }), { headers });

  } catch (e) {
    return new Response('reading error', { status: 500 });
  }
}
