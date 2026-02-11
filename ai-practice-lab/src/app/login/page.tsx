"use client";

import {useState} from "react";
import {supabase} from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage(){
    const router = useRouter();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState<"login" | "signup">("login");
    const [msg, setMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);


    async function onSubmit(e: React.FormEvent){
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        try{
            if(mode == "signup"){
                const {data, error} = await supabase.auth.signUp({email, password, 
                    options: {
                        data:{
                            first_name: firstName, 
                            last_name: lastName, 
                            full_name: (firstName+ " " +lastName).trim(),
                        },
                    },
                });
                if (error) throw error;
                if(data.session){
                    router.push("/");
                } else {
                    setMsg("Account created. Please check your email to confirm.")
                }
            } else {
                const {error} = await supabase.auth.signInWithPassword({email, password});
                if(error) throw error;
                router.push("/");
            }
        } catch(err:any) {
            setMsg(err?.message ?? "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6 ">
            <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
                <h1 className="text-2xl font-bold text-black">
                    {mode === "login" ? "Sign in": "Create Account"}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                    {mode === "login"
                        ? "Sign in to start practicing case studies."
                        : "Create an account to track your progress."
                    }
                </p>

                <form onSubmit={onSubmit} className="mt-6 space-y-4 ">
                    <div>
                        {mode === "signup" ? (
                            <div>
                                <label className="text-sm font-medium text-black">First Name</label>
                                <input
                                    className="mt-1 w-full rounded-lg border px-3 py-2 text-black"
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="First Name"
                                />
                                <label className="text-sm font-medium text-black">Last Name</label>
                                <input
                                    className="mt-1 w-full rounded-lg border px-3 py-2 text-black"
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Last Name"
                                />
                            </div>    
                        ):null}
                        <label className="text-sm font-medium text-black">Email</label>
                        <input
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-black"
                            type="email"
                            value={email}
                            onChange={(e)=> setEmail(e.target.value)}
                            placeholder="Email Address"
                            required
                        />
                        <label className="text-sm font-medium text-black">Password</label>
                        <input
                            className="mt-1 w-full rounded-lg border px-3 py-2 text-black"
                            type="password"
                            value={password}
                            onChange={(e)=> setPassword(e.target.value)}
                            placeholder="Password"
                            required
                        />
                    </div>
                    {msg && <div className="text-sm text-red-600">{msg}</div>}
                    
                    <button
                        disabled={loading}
                        className="w-full rounded-lg bg-black text-white py-2 font-medium disabled:opacity-50"
                    >
                        {loading ? "Working..." : mode === "login" ? "Sign in" : "Sign Up"}
                    </button>
                </form>

                <button
                    className="mt-4 text-sm text-gray-700 underline"
                    onClick={() => {
                        setMsg(null);
                        setMode(mode === "login" ? "signup" : "login");
                    }}
                >
                    {mode === "login" ? "Needed an account? Sign Up" : "Already have an account? Sign in"}
                </button>
            </div>
        </main>
    );
}
