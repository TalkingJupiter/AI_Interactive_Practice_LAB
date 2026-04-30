"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type AttemptRow = {
  id: string;
  case_id: string;
  score: number | null;
  is_correct: boolean | null;
  created_at: string;
};

type CaseRow = {
  id: string;
  title: string;
  category: string;
  level: number;
};

type DashboardAttempt = {
  id: string;
  case_id: string;
  title: string;
  category: string;
  level: number | null;
  score: number | null;
  is_correct: boolean | null;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<DashboardAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLevel, setSelectedLevel] = useState("All");

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      const { data: attemptsData, error: attemptsError } = await supabase
        .from("attempts")
        .select("id, case_id, score, is_correct, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (attemptsError) {
        setError(attemptsError.message);
        setLoading(false);
        return;
      }

      const caseIds = Array.from(
        new Set((attemptsData ?? []).map((item) => item.case_id).filter(Boolean))
      );

      let caseMap = new Map<string, CaseRow>();

      if (caseIds.length > 0) {
        const { data: caseStudiesData, error: caseStudiesError } = await supabase
          .from("case_studies")
          .select("id, title, category, level")
          .in("id", caseIds);

        if (caseStudiesError) {
          setError(caseStudiesError.message);
          setLoading(false);
          return;
        }

        caseMap = new Map(
          (caseStudiesData ?? []).map((item) => [item.id, item as CaseRow])
        );
      }

      const merged: DashboardAttempt[] = (attemptsData ?? []).map((attempt) => {
        const caseInfo = caseMap.get(attempt.case_id);

        return {
          id: attempt.id,
          case_id: attempt.case_id,
          title: caseInfo?.title ?? "Unknown case",
          category: caseInfo?.category ?? "Unknown",
          level: caseInfo?.level ?? null,
          score: attempt.score,
          is_correct: attempt.is_correct,
          created_at: attempt.created_at,
        };
      });

      setAttempts(merged);
      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  const categories = useMemo(() => {
    const values = Array.from(new Set(attempts.map((item) => item.category)));
    return ["All", ...values];
  }, [attempts]);

  const filteredAttempts = useMemo(() => {
    return attempts.filter((item) => {
      const categoryMatch =
        selectedCategory === "All" || item.category === selectedCategory;

      const levelMatch =
        selectedLevel === "All" || String(item.level) === selectedLevel;

      return categoryMatch && levelMatch;
    });
  }, [attempts, selectedCategory, selectedLevel]);

  const stats = useMemo(() => {
    const totalAttempts = filteredAttempts.length;

    const correctAttempts = filteredAttempts.filter(
      (item) => item.is_correct === true
    ).length;

    const accuracy =
      totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    const scoredAttempts = filteredAttempts.filter(
      (item) => typeof item.score === "number"
    );

    const averageScore =
      scoredAttempts.length > 0
        ? Math.round(
            scoredAttempts.reduce((sum, item) => sum + (item.score ?? 0), 0) /
              scoredAttempts.length
          )
        : 0;

    const lastAttempt =
      filteredAttempts.length > 0
        ? new Date(filteredAttempts[0].created_at).toLocaleString()
        : "No attempts yet";

    return {
      totalAttempts,
      accuracy,
      averageScore,
      lastAttempt,
    };
  }, [filteredAttempts]);

  function levelLabel(level: number | null) {
    if (level === 0) return "Easy";
    if (level === 1) return "Medium";
    if (level === 2) return "Hard";
    return "Unknown";
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          Loading dashboard...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="rounded-xl border bg-white p-6 shadow-sm text-red-600">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-black">
          Your attempt history and analytics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 shadow-sm text-black">
          <label className="mb-2 block text-sm font-medium text-black">
            Filter by category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-lg border p-2 text-sm"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-sm text-black">
          <label className="mb-2 block text-sm font-medium text-black">
            Filter by level
          </label>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="w-full rounded-lg border p-2 text-sm"
          >
            <option value="All">All</option>
            <option value="0">Easy</option>
            <option value="1">Medium</option>
            <option value="2">Hard</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-black">Total Attempts</div>
          <div className="mt-2 text-3xl font-bold text-black">
            {stats.totalAttempts}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-600">Accuracy</div>
          <div className="mt-2 text-3xl font-bold text-black">
            {stats.accuracy}%
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-600">Average Score</div>
          <div className="mt-2 text-3xl font-bold text-black">
            {stats.averageScore}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-600">Last Attempt</div>
          <div className="mt-2 text-sm font-medium text-black">
            {stats.lastAttempt}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-black">Attempts</h2>

        {filteredAttempts.length === 0 ? (
          <p className="mt-4 text-sm text-black">No attempts found.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {filteredAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="rounded-lg border p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-semibold text-black">{attempt.title}</div>
                  <div className="text-sm text-gray-600">
                    {attempt.category} - {levelLabel(attempt.level)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(attempt.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex gap-3 text-sm text-black">
                  <span className="rounded-md border px-3 py-1">
                    Score: {attempt.score ?? "-"}
                  </span>
                  <span
                    className={`rounded-md px-3 py-1 ${
                      attempt.is_correct
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {attempt.is_correct ? "Correct" : "Incorrect"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
