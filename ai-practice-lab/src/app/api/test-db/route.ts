import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseServer";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("case_studies")
    .select("*")
    .limit(1);

  if (error) return NextResponse.json({ success: false, error: error.message });
  return NextResponse.json({ success: true, data });
}
