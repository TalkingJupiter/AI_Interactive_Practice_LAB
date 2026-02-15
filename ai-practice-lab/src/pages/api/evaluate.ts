import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EvalSchema = z.object({
  score: z.number().min(0).max(100),
  is_correct: z.boolean(),
  explanation: z.string().min(1),
  guidance: z.array(z.string()).default([]),
  misconceptions: z.array(z.string()).default([]),
});

function extractJson(raw: string) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function buildEvalPrompt(opts: {
  caseStudy: any;
  questionText: string;
  questionIndex: number;
  studentAnswer: string;
}) {
  const { caseStudy, questionText, questionIndex, studentAnswer } = opts;

  return `
You are an AI tutor evaluating a student's reasoning for an educational practice app.
This is NOT medical advice.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown. No extra words.
- Evaluate ONLY the single question given below (ignore other questions).
- If the student is wrong, DO NOT reveal the correct answer directly.
- Do not name specific "final answers" explicitly. Use hints and guidance instead.
- Keep explanation short (1-2 sentences).

Case Title: ${caseStudy.title}
Category: ${caseStudy.category}
Difficulty Level: ${caseStudy.level}

Case:
${caseStudy.case_text}

Current Question (${questionIndex + 1}):
${questionText}

Student Answer:
${studentAnswer}

Return JSON schema exactly:
{
  "score": number,
  "is_correct": boolean,
  "explanation": string,
  "guidance": string[],
  "misconceptions": string[]
}

Scoring guidance:
- 90-100: correct and well-explained
- 60-89: mostly correct but missing reasoning
- 30-59: partially correct with major gaps
- 0-29: incorrect reasoning

Remember: if wrong, guide without giving away the answer.
`.trim();
}

async function callLLM(prompt: string) {
  const base = process.env.LLM_BASE_URL;
  const url = `${base}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
      stop: ["<|im_end|>", "</s>", "```"],
    }),
  });

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  return text;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

    const { user_id, case_id, answer_text, question_index, question_text } = req.body as {
      user_id: string;
      case_id: string;
      answer_text: string;
      question_index?: number;
      question_text?: string;
    };

    if (!user_id || !case_id || !answer_text?.trim()) {
      return res.status(400).json({ error: "Missing user_id, case_id, or answer_text" });
    }

    // ✅ Require question_index for 1-at-a-time flow
    if (question_index === undefined || question_index === null || Number.isNaN(Number(question_index))) {
      return res.status(400).json({ error: "Missing question_index" });
    }

    // load the case from db
    const { data: caseStudy, error: csErr } = await supabase
      .from("case_studies")
      .select("id,category,level,title,case_text,questions")
      .eq("id", case_id)
      .single();

    if (csErr) throw csErr;

    const questions: string[] = Array.isArray(caseStudy?.questions) ? caseStudy.questions : [];
    const qi = Number(question_index);

    if (qi < 0 || qi >= questions.length) {
      return res.status(400).json({ error: `question_index out of range (0..${Math.max(0, questions.length - 1)})` });
    }

    // Prefer question_text from client if provided, but sanity-check it.
    // If it doesn't match what's in DB, fall back to DB to prevent tampering.
    const dbQuestion = questions[qi] ?? "";
    const resolvedQuestionText =
      typeof question_text === "string" && question_text.trim() && question_text.trim() === dbQuestion.trim()
        ? question_text.trim()
        : dbQuestion;

    // ask llm to evaluate ONLY this question
    const prompt = buildEvalPrompt({
      caseStudy,
      questionText: resolvedQuestionText,
      questionIndex: qi,
      studentAnswer: answer_text,
    });

    const raw = await callLLM(prompt);
    const parsed = extractJson(raw);
    const evaluation = EvalSchema.parse(parsed);

    // save attempt INCLUDING which question this was
    const { data: attempt, error: insErr } = await supabase
      .from("attempts")
      .insert({
        user_id,
        case_id,
        answer_text: answer_text.trim(),
        question_index: qi, 
        question_text: resolvedQuestionText,
        score: evaluation.score,
        is_correct: evaluation.is_correct,
        feedback: { explanation: evaluation.explanation, misconceptions: evaluation.misconceptions },
        guidence: evaluation.guidance,
      })
      .select("id,created_at,score,is_correct,feedback,guidence,question_index,question_text")
      .single();

    if (insErr) throw insErr;

    // helpful for frontend resume logic
    const next_question_index = evaluation.is_correct ? qi + 1 : qi;
    const is_complete = evaluation.is_correct && qi >= questions.length - 1;

    return res.status(200).json({
      evaluation,
      attempt,
      next_question_index,
      is_complete,
      total_questions: questions.length,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message ?? "Unknown error" });
  }
}
