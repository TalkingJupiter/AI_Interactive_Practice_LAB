"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {supabase} from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function NavBar(){
    const router = useRouter();
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setEmail(data.session?.user.email ?? null);
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setEmail(session?.user.email ?? null);
        });

        return () => sub.subscription.unsubscribe();
    }, []);

    async function signOut(){
        await supabase.auth.signOut();
        router.push("/login");
    }

    return (
        <header className=" bg-gray-900">
            <div className="mx-auto max-w-4xl flex items-center justify-between p-4">
                <Link href="/" className="font-bold">
                AI Practice Lab
                </Link>

                <nav className="flex items-center gap-4 text-sm">
                <Link href="/profile" className="hover:underline">
                    Profile
                </Link>
                {email ? (
                    <button onClick={signOut} className="rounded-md border px-3 py-1 hover:bg-gray-50">
                    Sign out
                    </button>
                ) : (
                    <Link href="/login" className="rounded-md border px-3 py-1 hover:bg-gray-50">
                    Sign in
                    </Link>
                )}
                </nav>
            </div>
        </header>
    );
}

