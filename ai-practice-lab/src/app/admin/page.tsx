"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Profile = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  is_admin: boolean | null;
};

type Attempt = {
  id: string;
  user_id: string;
  case_id: string;
  score: number | null;
  is_correct: boolean | null;
  created_at: string;
  question_text: string | null;
};

type CaseStudy = {
  id: string;
  title: string;
  category: string;
  level: number;
};

type UserAttempt = Attempt & {
  title: string;
  category: string;
  level: number | null;
};

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAdminDashboard() {
      setLoading(true);
      setError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        router.push("/login");
        return;
      }

      const res = await fetch("/api/admin-dashboard", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          router.push("/dashboard");
          return;
        }

        setError(json.error ?? "Failed to load admin dashboard");
        setLoading(false);
        return;
      }

      setProfiles(json.profiles ?? []);
      setAttempts(json.attempts ?? []);
      setCaseStudies(json.caseStudies ?? []);
      setLoading(false);
    }

    loadAdminDashboard();
  }, [router]);

  const platformStats = useMemo(() => {
    const totalSessions = attempts.length;

    const correctSessions = attempts.filter(
      (attempt) => attempt.is_correct === true
    ).length;

    const accuracy =
      totalSessions > 0 ? Math.round((correctSessions / totalSessions) * 100) : 0;

    const activeUsers = new Set(
      attempts.map((attempt) => attempt.user_id).filter(Boolean)
    ).size;

    return {
      accuracy,
      activeUsers,
      totalSessions,
    };
  }, [attempts]);

  const searchResults = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return [];

    return profiles
      .filter((profile) => {
        const firstName = profile.first_name?.toLowerCase() ?? "";
        const lastName = profile.last_name?.toLowerCase() ?? "";
        const fullName = profile.full_name?.toLowerCase() ?? "";
        const email = profile.email?.toLowerCase() ?? "";
        const id = profile.id.toLowerCase();

        return (
          firstName.includes(value) ||
          lastName.includes(value) ||
          fullName.includes(value) ||
          email.includes(value) ||
          id.includes(value)
        );
      })
      .slice(0, 5);
  }, [search, profiles]);

  const selectedUserAttempts: UserAttempt[] = useMemo(() => {
    if (!selectedUser) return [];

    const caseMap = new Map(
      caseStudies.map((caseStudy) => [caseStudy.id, caseStudy])
    );

    return attempts
      .filter((attempt) => attempt.user_id === selectedUser.id)
      .map((attempt) => {
        const caseInfo = caseMap.get(attempt.case_id);

        return {
          ...attempt,
          title: caseInfo?.title ?? "Unknown case",
          category: caseInfo?.category ?? "Unknown",
          level: caseInfo?.level ?? null,
        };
      });
  }, [selectedUser, attempts, caseStudies]);

  const selectedUserStats = useMemo(() => {
    const totalAttempts = selectedUserAttempts.length;

    const correctAttempts = selectedUserAttempts.filter(
      (attempt) => attempt.is_correct === true
    ).length;

    const accuracy =
      totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    const scoredAttempts = selectedUserAttempts.filter(
      (attempt) => typeof attempt.score === "number"
    );

    const averageScore =
      scoredAttempts.length > 0
        ? Math.round(
            scoredAttempts.reduce(
              (sum, attempt) => sum + (attempt.score ?? 0),
              0
            ) / scoredAttempts.length
          )
        : 0;

    const lastAttempt =
      selectedUserAttempts.length > 0
        ? new Date(selectedUserAttempts[0].created_at).toLocaleString()
        : "No attempts yet";

    return {
      totalAttempts,
      accuracy,
      averageScore,
      lastAttempt,
    };
  }, [selectedUserAttempts]);

  function getUserName(profile: Profile) {
    if (profile.full_name) return profile.full_name;

    const name = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
    return name || "Unnamed user";
  }

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
          Loading admin dashboard...
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
        <h1 className="text-3xl font-bold">Admin Analytic Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          View platform performance and search user progress.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-600">Platform Accuracy</div>
          <div className="mt-2 text-3xl font-bold text-black">
            {platformStats.accuracy}%
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-600">Total Active Users</div>
          <div className="mt-2 text-3xl font-bold text-black">
            {platformStats.activeUsers}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-600">Total Practice Sessions</div>
          <div className="mt-2 text-3xl font-bold text-black">
            {platformStats.totalSessions}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-black">Search User</h2>
        <p className="mt-1 text-sm text-gray-600">
          Search by name, email, or user ID.
        </p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search user..."
          className="mt-4 w-full rounded-lg border p-3 text-sm text-black"
        />

        {search.trim() && searchResults.length === 0 && (
          <p className="mt-4 text-sm text-gray-600">No user found.</p>
        )}

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            {searchResults.map((profile) => (
              <button
                key={profile.id}
                onClick={() => setSelectedUser(profile)}
                className="w-full rounded-lg border p-4 text-left hover:bg-gray-50"
              >
                <div className="font-semibold text-black">
                  {getUserName(profile)}
                </div>
                <div className="text-sm text-gray-600">
                  {profile.email ?? "No email"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  ID: {profile.id}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-black">User Analytics</h2>

          <div className="mt-4 rounded-lg border p-4">
            <div className="font-semibold text-black">
              {getUserName(selectedUser)}
            </div>
            <div className="text-sm text-gray-600">
              {selectedUser.email ?? "No email"}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              ID: {selectedUser.id}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-600">Total Attempts</div>
              <div className="mt-2 text-3xl font-bold text-black">
                {selectedUserStats.totalAttempts}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-600">Accuracy</div>
              <div className="mt-2 text-3xl font-bold text-black">
                {selectedUserStats.accuracy}%
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-600">Average Score</div>
              <div className="mt-2 text-3xl font-bold text-black">
                {selectedUserStats.averageScore}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="text-sm text-gray-600">Last Attempt</div>
              <div className="mt-2 text-sm font-medium text-black">
                {selectedUserStats.lastAttempt}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="font-bold text-black">Recent Attempts</h3>

            {selectedUserAttempts.length === 0 ? (
              <p className="mt-3 text-sm text-gray-600">
                This user has no attempts yet.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {selectedUserAttempts.slice(0, 6).map((attempt) => (
                  <div
                    key={attempt.id}
                    className="rounded-lg border p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-semibold text-black">
                        {attempt.title}
                      </div>
                      <div className="text-sm text-gray-600">
                        {attempt.category} • {levelLabel(attempt.level)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(attempt.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex gap-3 text-sm">
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
        </div>
      )}
    </main>
  );
}
