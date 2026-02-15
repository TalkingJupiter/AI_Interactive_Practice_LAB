import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-only
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const level = Number(req.query.level ?? 0);
    const category = String(req.query.category ?? "Brain Anatomy");
    const userId = String(req.query.user_id ?? "");

    if (!userId) return res.status(400).json({ error: "Missing user ID" });
    if (![0, 1, 2].includes(level)) return res.status(400).json({ error: "level must be 0, 1, or 2" });

    // 1) Get all case_ids this user has already attempted (seen)
    const { data: attempts, error: attErr } = await supabase
      .from("attempts")
      .select("case_id")
      .eq("user_id", userId);

    if (attErr) throw attErr;

    const seenIds: string[] = (attempts ?? [])
      .map((a: any) => a.case_id)
      .filter(Boolean);

    // 2) Query unseen cases (by category + level)
    let query = supabase
      .from("case_studies")
      .select("id,title,category,level,case_text,questions")
      .eq("category", category)
      .eq("level", level);

    // If user has seen some cases, exclude them
    if (seenIds.length > 0) {
      // Supabase expects a literal list like: (uuid1,uuid2,uuid3)
      query = query.not("id", "in", `(${seenIds.join(",")})`);
    }

    const { data: unseen, error } = await query;

    if (error) throw error;

    if (unseen && unseen.length > 0) {
      const pick = unseen[Math.floor(Math.random() * unseen.length)];
      return res.status(200).json({ source: "db", case: pick });
    }

    // 3) No unseen cases -> generate a new one
    const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || `http://localhost:3000`;

    const genResp = await fetch(`${base}/api/generate-case`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, level }),
    });

    const gen = await genResp.json();

    if (!genResp.ok) {
      return res.status(500).json({ error: gen.error ?? "Failed to generate case" });
    }

    return res.status(200).json({ source: "generated", case: gen.case });
  } catch (e: any) {
    return res.status(500).json({ error: e.message ?? "Unknown error" });
  }
}
