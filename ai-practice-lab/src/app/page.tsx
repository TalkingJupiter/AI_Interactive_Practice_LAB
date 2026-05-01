"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  canSpeak, speak, stopSpeaking,
  canListen, startListening, stopListening,
} from "../lib/voice";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

type CaseStudy = {
  id: string;
  category: string;
  level: number;
  title: string;
  case_text: string;
  questions: string[]; // JSON array like ["Q1","Q2","Q3"]
};

type ChatMessage =
  | { id: string; role: "system"; content: string }
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string };

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const LEVEL_LABELS: Record<0 | 1 | 2, string> = {
  0: "Easy",
  1: "Medium",
  2: "Hard",
};

function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl bg-neutral-800 text-neutral-200">
      <span className="sr-only">Assistant is thinking</span>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 animate-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 animate-bounce [animation-delay:300ms]" />
    </div>
  );
}

function IconSpeaker() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
    >
      <path d="M10 3.5a.75.75 0 0 0-1.264-.546L5.203 6H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.203l3.533 3.046A.75.75 0 0 0 10 16.5v-13Z" />
      <path d="M13.5 6a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5A.75.75 0 0 1 13.5 6ZM16 5a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-1.5 0v-8.5A.75.75 0 0 1 16 5Z" />
    </svg>
  );
}

function IconSpeakerOff() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
    >
      <path d="M10 3.5a.75.75 0 0 0-1.264-.546L5.203 6H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.203l3.533 3.046A.75.75 0 0 0 10 16.5v-13ZM14.78 6.22a.75.75 0 1 0-1.06 1.06L15.44 9l-1.72 1.72a.75.75 0 1 0 1.06 1.06L16.5 10.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L17.56 9l1.72-1.72a.75.75 0 1 0-1.06-1.06L16.5 7.94l-1.72-1.72Z" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
    >
      <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
      <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10a6 6 0 0 0 5.25 5.955V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.545A6 6 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
    </svg>
  );
}

function IconMicOff() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4"
    >
      <path d="M10 1a3 3 0 0 0-3 3v.585l5.874 5.874A3 3 0 0 0 13 10V4a3 3 0 0 0-3-3ZM3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06L3.28 2.22ZM7 12.24l-1.5-1.5V10a.75.75 0 0 0-1.5 0v.357A6 6 0 0 0 9.25 15.955V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.545a5.978 5.978 0 0 0 2.56-.975L11.2 13.37A4.5 4.5 0 0 1 7 12.24ZM14.97 11.65A4.471 4.471 0 0 0 15.5 10v-.357a.75.75 0 0 0-1.5 0V10c0 .546-.1 1.07-.282 1.552l1.252 1.098Z" />
    </svg>
  );
}


export default function HomePage() {
  const router = useRouter();

  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [evalResult, setEvalResult] = useState<any>(null);

  // user must choose first
  const [level, setLevel] = useState<0 | 1 | 2 | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // categories derived from case_studies.category
  const [categories, setCategories] = useState<string[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // fetch happens only when user clicks Fetch case / New case
  const [fetchRequested, setFetchRequested] = useState(false);

  // one-question-at-a-time flow state (in-memory only; refresh resets everything)
  const [qIndex, setQIndex] = useState<number>(0);
  const [awaitingNextConfirm, setAwaitingNextConfirm] = useState(false);

  // Chat UI state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "system",
      content:
        "Select a category and difficulty, then click **Fetch case**. I'll show one question at a time and guide you.",
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);

  const [speechSupported, setSpeechSupported] = useState(false);
  const [isSpeakingState, setIsSpeakingState] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const [listenSupported, setListenSupported] = useState(false);
  const [isListeningState, setIsListeningState] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () =>
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });


  useEffect(() => {
    setSpeechSupported(canSpeak());
    setListenSupported(canListen());
  }, []);

  // Stop listening if the component unmounts
  useEffect(() => {
    return () => { stopListening(); };
  }, []);

  // Require login + capture user_id
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (!uid) router.push("/login");
      else setUserId(uid);
    });
  }, [router]);

  // Load categories from case_studies table (distinct category list)
  useEffect(() => {
    if (!userId) return;

    async function loadCategories() {
      setCatLoading(true);
      setCatError(null);

      const { data, error } = await supabase
        .from("case_studies")
        .select("category")
        .not("category", "is", null)
        .limit(1000);

      if (error) {
        setCatError(error.message);
        setCatLoading(false);
        return;
      }

      const unique = Array.from(
        new Set(
          (data ?? [])
            .map((r: any) => String(r.category ?? "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));

      setCategories(unique);
      setCatLoading(false);
    }

    loadCategories().catch((e) => {
      setCatError(e?.message ?? "Failed to load categories");
      setCatLoading(false);
    });
  }, [userId]);

  // Scroll on new messages / thinking changes
  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isThinking]);

  const headerBadge = useMemo(() => {
    if (!caseStudy) return null;
    return `${caseStudy.category} • level ${caseStudy.level}`;
  }, [caseStudy]);

  const selectionComplete = Boolean(userId && category && level !== null);

  // Load case ONLY when user requests it (Fetch case / New case)
  useEffect(() => {
  if (!fetchRequested) return;

  const selectedUserId = userId;
  const selectedCategory = category;
  const selectedLevel = level;

  if (!selectedUserId || !selectedCategory || selectedLevel === null) return;

  async function load() {
    setStatus(null);
    setCaseStudy(null);
    setAnswer("");
    setEvalResult(null);
    setQIndex(0);
    setAwaitingNextConfirm(false);

    const levelLabel = LEVEL_LABELS[selectedLevel!];

    setIsThinking(true);
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "assistant",
        content: `Fetching a **${selectedCategory}** case at **${levelLabel}** difficulty...`,
      },
    ]);

    const params = new URLSearchParams({
      level: String(selectedLevel),
      category: selectedCategory!,
      user_id: selectedUserId!,
    });

    const res = await fetch(`/api/get-case?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await res.json();

    setIsThinking(false);
    setFetchRequested(false);

    if (!res.ok) {
      const err = json.error ?? "Failed to load case study";
      setStatus(err);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: `⚠️ ${err}` },
      ]);
      return;
    }

    const cs: CaseStudy | null = json.case ?? null;
    setCaseStudy(cs);

    if (json.source === "generated") {
      const msg =
        "Generated a new case (you finished all existing ones in this category).";
      setStatus(msg);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: msg },
      ]);
    } else {
      setStatus(null);
    }

    if (cs) {
      const firstQ = cs.questions?.[0] ?? "";
      const caseMsg =
        `### ${cs.title}\n\n` +
        `${cs.case_text}\n\n` +
        `**Question 1 of ${cs.questions.length}:**\n` +
        `${firstQ}\n\n` +
        `Reply with your reasoning.`;

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: caseMsg },
      ]);
    }
  }

  load().catch((e) => {
    setIsThinking(false);
    setFetchRequested(false);
    setStatus(e.message);
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "assistant", content: `⚠️ ${e.message}` },
    ]);
  });
}, [fetchRequested, userId, category, level]);

  async function submitAnswer() {
    if (!caseStudy || !userId) return;

    const trimmed = answer.trim();
    if (!trimmed) return;

    setStatus(null);
    setEvalResult(null);

    // If waiting on yes/no, intercept it (no evaluation call)
    if (awaitingNextConfirm) {
      const t = trimmed.toLowerCase();

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", content: trimmed },
      ]);
      setAnswer("");

      if (t === "yes" || t === "y") {
        const next = qIndex + 1;

        if (next >= caseStudy.questions.length) {
          setAwaitingNextConfirm(false);
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "assistant",
              content: "You've completed all questions for this case ✅",
            },
          ]);
          return;
        }

        setQIndex(next);
        setAwaitingNextConfirm(false);

        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: `**Question ${next + 1} of ${
              caseStudy.questions.length
            }:**\n${caseStudy.questions[next]}`,
          },
        ]);
        return;
      }

      if (t === "no" || t === "n") {
        setAwaitingNextConfirm(false);
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content:
              "No problem — stopping here. Refreshing the page will start from scratch.",
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: "Please reply **yes** or **no**." },
      ]);
      return;
    }

    // normal flow: evaluate the current question
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", content: trimmed },
    ]);

    const questionText = caseStudy.questions?.[qIndex] ?? "";

    setIsThinking(true);

    try {
      const payload = {
        user_id: userId,
        case_id: caseStudy.id,
        answer_text: trimmed,
        question_index: qIndex,
        question_text: questionText,
      };

      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      setIsThinking(false);

      if (!res.ok) {
        const err = json.error ?? "Evaluation failed";
        setStatus(err);
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: `⚠️ ${err}` },
        ]);
        return;
      }

      setEvalResult(json.evaluation);
      const ev = json.evaluation;

      const scoreLine =
        ev?.score !== undefined && ev?.score !== null
          ? `**Score:** ${ev.score}`
          : "**Score:** —";
      const explainLine = ev?.explanation
        ? `**Explanation:** ${ev.explanation}`
        : "**Explanation:** —";

      const misconceptions =
        Array.isArray(ev?.misconceptions) && ev.misconceptions.length
          ? `\n\n**Misconceptions:**\n${ev.misconceptions
              .map((m: string) => `- ${m}`)
              .join("\n")}`
          : "";

      const guidance =
        Array.isArray(ev?.guidance) && ev.guidance.length
          ? `\n\n**Guidance:**\n${ev.guidance
              .map((g: string) => `- ${g}`)
              .join("\n")}`
          : "";

      const correctness =
        ev?.is_correct === true
          ? "✅ **Correct.** Nice work."
          : "🧠 **Not quite yet.** Let's tighten the reasoning.";

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: `${correctness}\n\n${scoreLine}\n\n${explainLine}${misconceptions}${guidance}`,
        },
      ]);

      setStatus(ev?.is_correct ? "Correct!" : "Not quite yet - check guidance");
      setAnswer("");

      // If correct and there are more questions, ask if they want next
      if (ev?.is_correct === true) {
        if (qIndex < caseStudy.questions.length - 1) {
          setAwaitingNextConfirm(true);
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "assistant",
              content:
                "Want the **next question**? Reply **yes** or **no**.",
            },
          ]);
        } else {
          setAwaitingNextConfirm(false);
          setMessages((prev) => [
            ...prev,
            {
              id: uid(),
              role: "assistant",
              content: "That was the final question — nice work ✅",
            },
          ]);
        }
      } else {
        setAwaitingNextConfirm(false);
      }
    } catch (e: any) {
      setIsThinking(false);
      const msg = e?.message ?? "Evaluation failed";
      setStatus(msg);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: `⚠️ ${msg}` },
      ]);
    }
  }

  function handleFetchCase() {
    if (!selectionComplete) {
      setStatus("Please select a category and difficulty first.");
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content:
            "Choose a **category** and **difficulty**, then click **Fetch case**.",
        },
      ]);
      return;
    }
    setStatus(null);
    setFetchRequested(true);
  }

  async function handleNewCase() {
    const selectedUserId = userId;
    const selectedCategory = category;
    const selectedLevel = level;

    if (!selectedUserId || !selectedCategory || selectedLevel === null) {
      setStatus("Please select a category and difficulty first.");
      return;
    }

    setStatus(null);
    setCaseStudy(null);
    setAnswer("");
    setEvalResult(null);
    setQIndex(0);
    setAwaitingNextConfirm(false);

    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "assistant",
        content: `Generating a new **${selectedCategory}** case at **${LEVEL_LABELS[selectedLevel]}** difficulty...`,
      },
    ]);

    setIsThinking(true);

    try {
      const res = await fetch("/api/generate-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          level: selectedLevel,
        }),
      });

      const json = await res.json();
      setIsThinking(false);

      if (!res.ok) {
        const err = json.error ?? "Failed to generate case";
        setStatus(err);
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: `⚠️ ${err}` },
        ]);
        return;
      }

      const cs: CaseStudy = json.case;
      setCaseStudy(cs);

      const firstQ = cs.questions?.[0] ?? "";
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content:
            `### ${cs.title}\n\n` +
            `${cs.case_text}\n\n` +
            `**Question 1 of ${cs.questions.length}:**\n` +
            `${firstQ}\n\n` +
            `Reply with your reasoning.`,
        },
      ]);
    } catch (e: any) {
      setIsThinking(false);
      const msg = e?.message ?? "Generation failed";
      setStatus(msg);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: `⚠️ ${msg}` },
      ]);
    }
  }

  function handleSpeakMessage(messageId: string, content: string){
    if(!speechSupported) return;

    const isCurrentMessageSpeaking = speakingMessageId === messageId && isSpeakingState;

    if (isCurrentMessageSpeaking){
      stopSpeaking();
      setIsSpeakingState(false);
      setSpeakingMessageId(null);
      return;
    }

    speak(content , {
      lang: "en-US",
      onStart: () => {
        setIsSpeakingState(true);
        setSpeakingMessageId(messageId);
      },
      onEnd: () => {
        setIsSpeakingState(false);
        setSpeakingMessageId(null);
      }
    })
  }

  function handleToggleListen() {
    if (!listenSupported) return;

    if (isListeningState) {
      stopListening();
      setIsListeningState(false);
      return;
    }

    startListening({
      lang: "en-US",
      continuous: true,
      interimResults: true,
      onStart: () => setIsListeningState(true),
      onResult: ({ transcript, isFinal }) => {
        setAnswer(transcript);
        if (isFinal) {
          // keep the final text in the box; user can edit or send
        }
      },
      onEnd: () => setIsListeningState(false),
      onError: () => setIsListeningState(false),
    });
  }

  return (
    <main className="min-h-screen bg-[#121212] text-neutral-100">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-neutral-800 bg-inherit backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-white">Case Study Practice</h1>
            <p className="text-xs text-neutral-400">Chat-style guided practice</p>
          </div>

          <div className="flex items-center gap-2">
            {headerBadge && (
              <span className="text-xs rounded-full bg-neutral-800 px-3 py-1">
                {headerBadge}
              </span>
            )}
            {/* <button
              onClick={() => router.push("/profile")}
              className="text-xs rounded-full border border-neutral-700 px-3 py-1 hover:bg-neutral-900"
            >
              Profile
            </button> */}
          </div>
        </div>

        {/* Filters row */}
        <div className="mx-auto max-w-4xl px-4 pb-4 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-neutral-400">Category:</span>

          {catLoading && <span className="text-xs text-neutral-500">Loading…</span>}
          {!catLoading && catError && <span className="text-xs text-red-400">{catError}</span>}

          {!catLoading &&
            !catError &&
            categories.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCategory(c);
                  setStatus(null);
                }}
                className={[
                  "rounded-full border px-3 py-1 text-xs",
                  category === c
                    ? "bg-neutral-100 text-neutral-900 border-neutral-100"
                    : "bg-neutral-950 text-neutral-200 border-neutral-700 hover:bg-neutral-900",
                ].join(" ")}
              >
                {c}
              </button>
            ))}

          <span className="ml-2 text-xs text-neutral-400">Difficulty:</span>
          {([
            { v: 0 as const, label: "Easy" },
            { v: 1 as const, label: "Medium" },
            { v: 2 as const, label: "Hard" },
          ] as const).map((x) => (
            <button
              key={x.v}
              onClick={() => {
                setLevel(x.v);
                setStatus(null);
              }}
              className={[
                "rounded-full border px-3 py-1 text-xs",
                level === x.v
                  ? "bg-neutral-100 text-neutral-900 border-neutral-100"
                  : "bg-neutral-950 text-neutral-200 border-neutral-700 hover:bg-neutral-900",
              ].join(" ")}
            >
              {x.label}
            </button>
          ))}

          <button
            onClick={handleFetchCase}
            className="ml-auto rounded-full bg-neutral-100 text-neutral-900 px-3 py-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selectionComplete || isThinking}
            title="Fetch a case using your selected category + difficulty"
          >
            Fetch case
          </button>

          <button
            onClick={handleNewCase}
            className="rounded-full border border-neutral-700 px-3 py-1 text-xs hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!selectionComplete || isThinking}
            title="Fetch a new case"
          >
            New case
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* {status && (
          <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 text-xs text-neutral-200">
            {status}
          </div>
        )} */}

        {/* {!caseStudy && selectionComplete && !isThinking && (
          <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/20 p-3 text-xs text-neutral-300">
            Ready. Click <b>Fetch case</b> to begin.
          </div>
        )} */}

        {/* {!caseStudy && !selectionComplete && !isThinking && (
          <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/20 p-3 text-xs text-neutral-300">
            Select a <b>category</b> and <b>difficulty</b> first.
          </div>
        )} */}

        <div className="space-y-4">
          {messages.map((m) => {
            const isUser = m.role === "user";
            const isSystem = m.role === "system";
            const isAssistant = m.role === "assistant";

            const bubbleStyles = isSystem
              ? "bg-neutral-900/30 border border-neutral-800 text-neutral-300"
              : isUser
              ? "bg-blue-600 text-white"
              : "bg-neutral-900 text-neutral-100 border border-neutral-800";

            const align = isUser ? "justify-end" : "justify-start";
            const isCurrentMessageSpeaking = isAssistant && speakingMessageId === m.id && isSpeakingState;

            return (
              <div key={m.id} className={`flex ${align}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${bubbleStyles}`}>
                  <ReactMarkdown
                    components={{
                      h3: ({ children }) => (
                        <h3 className="text-base font-semibold mt-1 mb-2">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="my-2 whitespace-pre-wrap">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc pl-5 my-2">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal pl-5 my-2">{children}</ol>
                      ),
                      li: ({ children }) => <li className="my-1">{children}</li>,
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>

                  {isAssistant && speechSupported && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSpeakMessage(m.id, m.content)}
                        className="inline-flex items-center justify-center rounded-full border border-neutral-700 p-2 text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
                        title={isCurrentMessageSpeaking ? "Stop reading" : "Read aloud"}
                        aria-label={isCurrentMessageSpeaking ? "Stop reading" : "Read aloud"}
                      >
                        {isCurrentMessageSpeaking ? <IconSpeakerOff /> : <IconSpeaker />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isThinking && (
            <div className="flex justify-start">
              <TypingIndicator />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 border-t border-neutral-800 bg-inherit backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex gap-3 items-end">
            <textarea
              className="flex-1 resize-none rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600 min-h-[52px] max-h-[180px]"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={
                awaitingNextConfirm
                  ? "Reply yes or no..."
                  : caseStudy
                  ? "Type your reasoning here..."
                  : "Fetch a case first..."
              }
              disabled={!caseStudy || isThinking}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitAnswer();
                }
              }}
            />
            {listenSupported && (
              <button
                type="button"
                onClick={handleToggleListen}
                disabled={!caseStudy || isThinking}
                className={[
                  "rounded-2xl border px-4 py-3 text-sm transition disabled:opacity-50 disabled:cursor-not-allowed",
                  isListeningState
                    ? "border-red-500 bg-red-500/20 text-red-400 animate-pulse"
                    : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800",
                ].join(" ")}
                title={isListeningState ? "Stop listening" : "Speak your answer"}
                aria-label={isListeningState ? "Stop listening" : "Speak your answer"}
              >
                {isListeningState ? <IconMicOff /> : <IconMic />}
              </button>
            )}
            <button
              onClick={submitAnswer}
              className="rounded-2xl bg-neutral-100 text-neutral-900 px-4 py-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!caseStudy || isThinking || !answer.trim()}
              title="Enter to send, Shift+Enter for a new line"
            >
              Send
            </button>
          </div>

          <div className="mt-2 text-[11px] text-neutral-500">
            Enter to send • Shift+Enter for a new line
          </div>
        </div>
      </div>
    </main>
  );
}
