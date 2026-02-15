import type { NextApiRequest, NextApiResponse } from "next";
import {z} from "zod";
import { createClient } from "@supabase/supabase-js";
import { getEmbedding } from "../../lib/embeddings";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CaseSchema = z.object({
    title: z.string().min(5),
    category: z.string(),
    level: z.number().int().min(0).max(2),
    case_text: z.string().min(80),
    questions: z.array(z.string().min(5)).min(3).max(5),
})

function buildRagPrompt(category: string, level: number, neighbors: any[]){
    const neighborSummaries = neighbors.map((c,i) => {
        const q = Array.isArray(c.questions) ? c.questions : [];
        return `# Existing case ${i +1}
                Title : ${c.title}
                Summary: ${String(c.case_text).slice(0,220)}...
                Questions: ${q.slice(0,3).join(" | ")}
                `;
    }).join("\n");

    return `
    You are generating educational case studies for a university learning platform.
    Goal:
    Create ONE NEW case study that is clearly different from the existing cases below.

    Constraints:
    - Must be in category: "${category}"
    - Difficulty level: ${level} (0=easy, 1=medium, 2=hard)
    - Must be fictional and student-friendly
    - Must test reasoning, not memorization
    - Must NOT be a near-duplicate of the existing cases (different setting, different surface story, different distractors)

    Existing similar cases (DO NOT copy these):
    ${neighborSummaries}

    Return ONLY valid JSON. No markdown. No extra text.

    JSON schema:
    {
    "title": string,
    "category": "${category}",
    "level": ${level},
    "case_text": string,
    "questions": string[]
    }

    Rules:
    - case_text: 140-220 words, 1-2 short paragraphs
    - questions: exactly 3
    - do NOT include answers
    `;
}

async function callLLM(promt:string) {
    const base = process.env.LLM_BASE_URL;
    const r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            model: process.env.LLM_MODEL,
            messages: [{role: "user", content: promt}],
            temperature: 0.3,
            max_tokens: 650,
            stop: ["<|im_end|>", "</s>", "```"],
        }),
    });

    const j = await r.json();
    const text = j?.choices?.[0].message?.content ?? "";
    return text;
}

function safeJsonParse(raw: String){
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if(start === -1 || end === -1 || end <=start) throw new Error("No JSON object found");
    const sliced = raw.slice(start, end +1 )
    return JSON.parse(sliced);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse){
    try{
        const {category, level} = req.body as {category: string, level:number};
        if(!category || level === undefined) return res.status(400).json({error: "Missing category or level"});

        //build a retrival query embedding from the intent
        const queryText = `Generate a ${level} difficulty educational case study in ${category}.`;
        const queryEmbedding = await getEmbedding(queryText);

        //retrieve neighbors via RCP
        const {data: neighbors, error:nErr} = await supabase.rpc("match_case_studies", {
            query_embedding: queryEmbedding,
            match_category: category,
            match_level: level,
            match_count: 10,
        });

        if(nErr) throw nErr;

        //generate with RAG and novelty loop
        const SIM_THRESHOLD = 0.88//we can tune this
        const MAX_TRIES = 3;

        for(let attemt = 1; attemt<=MAX_TRIES; attemt++){
            const prompt = buildRagPrompt(category, level, neighbors || []);
            const raw = await callLLM(prompt);

            const parsed = safeJsonParse(raw);
            const candidate = CaseSchema.parse({
                ...parsed,
                level: Number(parsed.level),
            });

            //novelty check => embedded candidate and compare to neighbors
            const candText = `${candidate.title}\n${candidate.case_text}\n${candidate.questions.join("\n")}`;
            const candEmbedding = await getEmbedding(candText);

            //compare by reusing the same RPC to find closest matches to candidate
            const{data: close, error:cErr} = await supabase.rpc("match_case_studies", {
                query_embedding: candEmbedding,
                match_category: category,
                match_level: level,
                match_count: 10,
            });
            if(cErr) throw cErr;

            const bestSim = close?.[0]?.similarity ?? 0;

            if (bestSim >= SIM_THRESHOLD){
                //too similar -> try again with stronger instruction
                continue;
            }

            // insert new case and embedding
            const{data: inserted, error: insErr} = await supabase
                .from("case_studies")
                .insert({
                    category: candidate.category,
                    level: candidate.level,
                    title: candidate.title,
                    case_text: candidate.case_text,
                    questions: candidate.questions,
                    embedding: candEmbedding,
                })
                .select("id,title,category,level,case_text,questions")
                .single();

            if(insErr) throw insErr;

            return res.status(200).json({case: inserted, best_similarity: bestSim});

        }
    } catch(e: any){
        return res.status(500).json({error: e.message ?? "Unknown error"});
    }
}