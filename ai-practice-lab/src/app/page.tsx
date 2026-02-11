"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
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
  const [level, setLevel] = useState<0 | 1 | 2>(0);
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
      setStatus(null);
      setCaseStudy(null);

      const res = await fetch(`/api/get-case?level=${level}`, {cache: "no-store"});
      const json = await res.json();

      if(!res.ok){
        setStatus(json.error ?? "Failed to load case study");
      }

      setCaseStudy(json.caseStudy)
    }
    load().catch((e) => setStatus(e.message));
  }, [level]);

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

      <div className="flex gap-2">
        {[
          {v: 0 as const, label: "Easy"},
          {v: 1 as const, label: "Medium"},
          {v: 2 as const, label: "Hard"}
        ].map((x) => (
          <button
            key={x.v}
            onClick={() => setLevel(x.v)}
            className={`rounded-lg border px-3 py-2 text-sm ${level === x.v ? "bg-black text-white" : " text-black bg-white"}`} >
              {x.label}
            </button>
        ))
        }
      </div>
      {status && <div className="rounded-lg border bg-white p-4 text-sm text-black">{status}</div>}

      {caseStudy && (
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-black">{caseStudy.title}</h2>
            <span className="text-xs rounded-full bg-black px-3 py-1">
              {caseStudy.category} • level {caseStudy.level}
            </span>
          </div>

          <p className="text-gray-800">{caseStudy.case_text}</p>

          <div className="space-y-2">
            <h3 className="font-medium text-black">Questions</h3>
            <ul className="list-disc pl-6 text-gray-700">
              {caseStudy.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-black">Your Answer</h3>
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
