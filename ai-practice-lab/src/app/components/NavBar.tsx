"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function NavBar() {
    const router = useRouter();

    const [email, setEmail] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false); // NEW
    const [isDyslexicMode, setIsDyslexicMode] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);

        const savedMode = localStorage.getItem("dyslexicMode") === "true";
        setIsDyslexicMode(savedMode);

        if (savedMode) {
            document.body.classList.add("dyslexic-mode");
        }

        // Get session
        supabase.auth.getSession().then(async ({ data }) => {
            const user = data.session?.user;
            setEmail(user?.email ?? null);

            // NEW: check admin from profiles
            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("is_admin")
                    .eq("id", user.id)
                    .single();

                setIsAdmin(profile?.is_admin ?? false);
            }
        });

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setEmail(session?.user.email ?? null);
        });

        return () => sub.subscription.unsubscribe();
    }, []);

    const toggleDyslexicMode = () => {
        const newMode = !isDyslexicMode;
        setIsDyslexicMode(newMode);
        localStorage.setItem("dyslexicMode", String(newMode));

        if (newMode) {
            document.body.classList.add("dyslexic-mode");
        } else {
            document.body.classList.remove("dyslexic-mode");
        }
    };

    async function signOut() {
        await supabase.auth.signOut();
        router.push("/login");
    }

    if (!mounted) return (
        <header className="bg-gray-900 text-white">
            <div className="mx-auto max-w-4xl flex items-center justify-between p-4">
                <Link href="/" className="font-bold">AI Practice Lab</Link>
                <div className="w-20"></div>
            </div>
        </header>
    );

    return (
        <header className="bg-gray-900 text-white">
            <div className="mx-auto max-w-4xl flex items-center justify-between p-4">
                <Link href="/" className="font-bold text-white">
                    AI Practice Lab
                </Link>

                <nav className="flex items-center gap-4 text-sm">

                    <button 
                        onClick={toggleDyslexicMode}
                        className={`px-3 py-1 rounded-md border ${
                            isDyslexicMode 
                            ? "bg-yellow-100 text-black border-yellow-400 font-bold" 
                            : "hover:bg-gray-700 border-gray-600 text-white"
                        }`}
                    >
                        {isDyslexicMode ? "Standard" : "Dyslexic"}
                    </button>

                    {/* <Link href="/profile" className="hover:underline">
                        Profile
                    </Link> */}

                    {/*Admin button */}
                    {isAdmin && (
                        <Link href="/admin" className="hover:underline text-yellow-300">
                            Admin
                        </Link>
                    )}

                    {/*Dashboard button */}
                    <Link href="/dashboard" className="hover:underline">
                        Dashboard
                    </Link>

                    {email ? (
                        <button 
                            onClick={signOut} 
                            className="rounded-md border border-gray-600 px-3 py-1 hover:bg-gray-700"
                        >
                            Sign out
                        </button>
                    ) : (
                        <Link href="/login" className="rounded-md border border-gray-600 px-3 py-1 hover:bg-gray-700">
                            Sign in
                        </Link>
                    )}
                </nav>
            </div>
        </header>
    );
}
