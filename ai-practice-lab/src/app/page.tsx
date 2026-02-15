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
  const [evalResult, setEvalResult] = useState<any>(null);
  const [level, setLevel] = useState<0 | 1 | 2>(0);
  const [category, setCategory] = useState<string>("Neuroscience");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Require login + capture user_id
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid) router.push("/login");
      else setUserId(uid);
    });
  }, [router]);

  // Load case when level/category changes (and once userId exists)
  useEffect(() => {
    if (!userId) return;

    async function load() {
      setStatus(null);
      setCaseStudy(null);
      setAnswer("");

      if (!userId) return;
      const params = new URLSearchParams({
        level: String(level),
        category,
        user_id: userId,
      });

      const res = await fetch(`/api/get-case?${params.toString()}`, {
        cache: "no-store",
      });

      const json = await res.json();

      if (!res.ok) {
        setStatus(json.error ?? "Failed to load case study");
        return;
      }

      // Expected shape: { source: "db"|"generated", case: {...} }
      setCaseStudy(json.case ?? null);

      if (json.source === "generated") {
        setStatus("Generated a new case (you finished all existing ones in this category).");
      } else {
        setStatus(null);
      }
    }

    load().catch((e) => setStatus(e.message));
  }, [level, category, userId]);

  async function submitAnswer() {
    if(!caseStudy || !userId) return;

    setStatus("Evaluating...");
    setEvalResult(null);

    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        user_id: userId,
        case_id: caseStudy.id,
        answer_text: answer,
      }),
    });

    const json = await res.json();

    if(!res.ok){
      setStatus(json.error ?? "Evaluation failed");
      return;
    }

    setEvalResult(json.evaluation);
    setStatus(json.evaluation.is_correct ? "Correct!" : "Not quite yet - check guidance");

  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Case Study Practice</h1>
      <p className="text-gray-600">
        Read the case, answer the questions, and receive guided feedback.
      </p>

      {/* Category selector (simple for now) */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-gray-600">Category:</span>
        {["Neuroscience", "Computer Science", "Ethics"].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              category === c ? "bg-black text-white" : "text-black bg-white"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Difficulty */}
      <div className="flex gap-2">
        {[
          { v: 0 as const, label: "Easy" },
          { v: 1 as const, label: "Medium" },
          { v: 2 as const, label: "Hard" },
        ].map((x) => (
          <button
            key={x.v}
            onClick={() => setLevel(x.v)}
            className={`rounded-lg border px-3 py-2 text-sm ${
              level === x.v ? "bg-black text-white" : "text-black bg-white"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {status && (
        <div className="rounded-lg border bg-white p-4 text-sm text-black">
          {status}
        </div>
      )}

      {caseStudy && (
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-black">{caseStudy.title}</h2>
            <span className="text-xs rounded-full bg-black text-white px-3 py-1">
              {caseStudy.category} • level {caseStudy.level}
            </span>
          </div>

          <p className="text-gray-800 whitespace-pre-wrap">{caseStudy.case_text}</p>

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
              className="w-full rounded-lg text-black border p-3 min-h-[140px]"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your reasoning here..."
            />
            <button
              onClick={submitAnswer}
              className="rounded-lg bg-black text-white px-4 py-2 font-medium"
              disabled={!answer.trim()}
            >
              Submit
            </button>

            {evalResult && (
              <div className="rounded-lg border p-4 text-sm text-black space-y-2 mt-4">
                <div><b>Score:</b></div>
                <div><b>Explanation:</b></div>

                {evalResult.misconceptions?.length > 0 && (
                  <div>
                    <b>Misconceptions:</b>
                    <ul className="list-disc pl-6">
                      {evalResult.misconceptions.map((m: string, i: number) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {evalResult.guidance?.length > 0 &&(
                  <div>
                    <b>Guidance:</b>
                    <ul className="list-disc pl-6">
                      {evalResult.guidance.map((g: string, i:number) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

            )}
          </div>
        </div>
      )}
    </main>
  );
}
