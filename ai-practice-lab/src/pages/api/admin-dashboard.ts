import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .single();

    if (!adminProfile?.is_admin) {
      return res.status(403).json({ error: "Admin only" });
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email, first_name, last_name, full_name, is_admin, created_at")
      .order("created_at", { ascending: false });

    if (profilesError) throw profilesError;

    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from("attempts")
      .select("id, user_id, case_id, score, is_correct, created_at, question_text")
      .order("created_at", { ascending: false });

    if (attemptsError) throw attemptsError;

    const { data: caseStudies, error: casesError } = await supabaseAdmin
      .from("case_studies")
      .select("id, title, category, level");

    if (casesError) throw casesError;

    return res.status(200).json({
      profiles: profiles ?? [],
      attempts: attempts ?? [],
      caseStudies: caseStudies ?? [],
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message ?? "Something went wrong" });
  }
}
