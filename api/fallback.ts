// /api/fallback.ts
// SoulPattern GPT — Fallback Report Generator (with fixed soul-number)

import { NextApiRequest, NextApiResponse } from "next";

export const config = { runtime: "edge" };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { name = "고객", birth_date = "", gender = "미상", time = "모름", question = "" } = req.body;

    // ✅ 소울넘버 고정 API 호출
    const origin = new URL(req.headers.referer || req.url!).origin;
    const soulRes = await fetch(`${origin}/api/soul-number`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birth_date })
    });
    const soulData = await soulRes.json();
    const soul_number = soulData.soul_number;
    const arcana = soulData.arcana;

    // 🕒 현재 날짜 (KST)
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // 🧠 GPT 프롬프트
    const prompt = `
당신은 감정 기반 리듬 상담 시스템 ‘SoulPattern GPT’입니다.

다음 사용자 정보를 기반으로 사주, 소울넘버, 타로 6장을 분석하여  
11개의 섹션 리포트를 마크다운 형식으로 생성하세요.

[사용자 정보]
- 이름: ${name}
- 생년월일: ${birth_date}
- 성별: ${gender}
- 출생시간: ${time}
- 오늘 날짜: ${today}
- 질문: ${question || "없음"}
- 소울넘버: ${soul_number} / ${arcana}

[요구사항]
- 소울넘버는 위에서 주어진 숫자를 그대로 사용 (절대 재계산 금지)
- 11개 섹션 구성 (1. 평생총운 ~ 11. 요약 및 실행 제안)
- 각 섹션 제목에 이모지 포함 + 4~6문장 리딩
- 오늘 날짜 + 이름 기반으로 6장의 타로를 결정론적으로 정방향으로 배열
- 타로카드는 메이저 아르카나에서만 선택
- 반드시 마크다운으로 출력
- 감정적인 말투, 따뜻하고 공감 있는 상담 톤 유지
- JSON, 따옴표, 대괄호, 원시 데이터 출력 금지
`;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o", // 또는 "gpt-4o-mini"
        temperature: 0.7,
        messages: [
          { role: "system", content: "너는 SoulPattern GPT라는 감정 리듬 상담 AI다." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!gptRes.ok) {
      const errorText = await gptRes.text();
      return res.status(500).json({ error: "GPT 응답 실패", detail: errorText });
    }

    const gptData = await gptRes.json();
    const markdown = gptData.choices?.[0]?.message?.content ?? "";

    return res.status(200).json({
      ok: true,
      source: "fallback",
      content: markdown,
    });
  } catch (error: any) {
    return res.status(500).json({ error: "Fallback 처리 중 오류 발생", detail: error.message });
  }
}
