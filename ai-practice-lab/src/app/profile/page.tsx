"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (!user) router.push("/login");
      setEmail(user?.email ?? null);
    });
  }, [router]);

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-4">
      <h1 className="text-3xl font-bold">Profile</h1>
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="text-sm text-gray-600">Signed in as</div>
        <div className="font-medium">{email ?? "..."}</div>

        <div className="mt-6 text-sm text-gray-600">
          Next: show attempts count, accuracy, last attempt time.
        </div>
      </div>
    </main>
  );
}
