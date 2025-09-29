// /api/soul-number.ts
// Soul Number 계산기 (항상 동일한 값 반환)

import type { NextApiRequest, NextApiResponse } from "next";

function calcSoulNumber(dateStr = "") {
  const digits = (dateStr.match(/\d/g) || []).map(x => +x);
  if (!digits.length) return 0;
  let sum = digits.reduce((a, b) => a + b, 0);
  const collapseOnce = (n: number) =>
    ("" + n)
      .split("")
      .map(Number)
      .reduce((a, b) => a + b, 0);
  while (sum >= 10 && sum !== 11 && sum !== 22) sum = collapseOnce(sum);
  return sum;
}

function soulArcanaMap(n: number): string {
  const map = {
    0: "0 바보", 1: "Ⅰ 마법사", 2: "Ⅱ 여사제", 3: "Ⅲ 여황제", 4: "Ⅳ 황제", 5: "Ⅴ 교황",
    6: "Ⅵ 연인", 7: "Ⅶ 전차", 8: "Ⅷ 힘", 9: "Ⅸ 은둔자", 10: "Ⅹ 운명의 바퀴",
    11: "Ⅺ 정의", 12: "Ⅻ 매달린 사람", 13: "ⅩⅢ 죽음", 14: "ⅩⅣ 절제", 15: "ⅩⅤ 악마",
    16: "ⅩⅥ 탑", 17: "ⅩⅦ 별", 18: "ⅩⅧ 달", 19: "ⅩⅨ 태양", 20: "ⅩⅩ 심판", 21: "ⅩⅩⅠ 세계",
    22: "마스터 22(세계 확장)"
  };
  return map[n] ?? "알 수 없음";
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 방식만 허용됩니다." });
  }

  const { birth_date = "" } = req.body;
  const normalized = birth_date.replace(/[^0-9]/g, ""); // 19910320처럼 만들기

  if (normalized.length < 6) {
    return res.status(400).json({ error: "유효한 생년월일 형식이 아닙니다." });
  }

  const soulNumber = calcSoulNumber(normalized);
  const arcana = soulArcanaMap(soulNumber);

  return res.status(200).json({
    ok: true,
    soul_number: soulNumber,
    arcana: arcana
  });
}
