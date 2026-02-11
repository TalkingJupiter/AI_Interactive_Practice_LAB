"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

type CaseStudy = {
  id: string;
  category: string;
  level: number;
  title: string;
  case_text: string;
  questions: string[];
};

export default function HomePage() {
  const router = useRouter();
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    // Require login for now
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.push("/login");
    });
  }, [router]);

  useEffect(() => {
    async function load() {
      // For now: call your existing API test route, then we’ll add a real “get case” endpoint
      const res = await fetch("/api/test-db", { cache: "no-store" });
      const json = await res.json();

      if (!json.success || !json.data?.length) {
        setStatus(json.error ?? "No case studies found in DB.");
        return;
      }

      const row = json.data[0];
      setCaseStudy({
        id: row.id,
        category: row.category,
        level: row.level,
        title: row.title,
        case_text: row.case_text,
        questions: row.questions ?? [],
      });
    }

    load().catch((e) => setStatus(e.message));
  }, []);

  async function submitAnswer() {
    setStatus("Saved locally (LLM evaluate comes next).");
    // Next step: call /api/evaluate and store attempt
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Case Study Practice</h1>
      <p className="text-gray-600">
        Read the case, answer the questions, and receive guided feedback.
      </p>

      {status && <div className="rounded-lg border bg-white p-4 text-sm">{status}</div>}

      {caseStudy && (
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{caseStudy.title}</h2>
            <span className="text-xs rounded-full bg-gray-100 px-3 py-1">
              {caseStudy.category} • level {caseStudy.level}
            </span>
          </div>

          <p className="text-gray-800">{caseStudy.case_text}</p>

          <div className="space-y-2">
            <h3 className="font-medium">Questions</h3>
            <ul className="list-disc pl-6 text-gray-700">
              {caseStudy.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Your Answer</h3>
            <textarea
              className="w-full rounded-lg border p-3 min-h-[140px]"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your reasoning here..."
            />
            <button
              onClick={submitAnswer}
              className="rounded-lg bg-black text-white px-4 py-2 font-medium"
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
