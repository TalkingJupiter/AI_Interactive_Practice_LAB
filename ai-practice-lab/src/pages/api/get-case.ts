import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    //Report env status immediately
    if (!url || !key) {
      return res.status(500).json({
        error: "Missing env vars",
        hasUrl: Boolean(url),
        urlPreview: url ? url.slice(0, 30) + "..." : null,
        keyLength: key?.length ?? 0,
      });
    }

    const supabaseAdmin = createClient(url, key);

    const level = Number(req.query.level);
    if (![0, 1, 2].includes(level)) {
      return res.status(400).json({ error: "level must be 0, 1, or 2" });
    }

    const { data, error } = await supabaseAdmin
      .from("case_studies")
      .select("id, category, level, title, case_text, questions")
      .eq("level", level)
      .limit(50);

    if (error) {
      return res.status(500).json({
        error: "Supabase query error",
        details: error.message,
      });
    }

    if (!data?.length) {
      return res.status(404).json({ error: "No case studies found for that level." });
    }

    const chosen = data[Math.floor(Math.random() * data.length)];
    return res.status(200).json({ caseStudy: chosen });
  } catch (e: any) {
    return res.status(500).json({
      error: "Handler crashed",
      details: String(e?.message ?? e),
    });
  }
}
