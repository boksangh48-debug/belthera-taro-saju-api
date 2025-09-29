// /api/proxy/reading.ts

import type { NextApiRequest, NextApiResponse } from "next";

export const config = { runtime: "edge" };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const apiRes = await fetch("https://belthera-taro-saju-api.vercel.app/api/reading", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.INTERNAL_API_SECRET ?? ""}` // optional
      },
      body: JSON.stringify(req.body)
    });

    const data = await apiRes.json();
    return res.status(apiRes.status).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: "프록시 요청 실패", detail: error.message });
  }
}
