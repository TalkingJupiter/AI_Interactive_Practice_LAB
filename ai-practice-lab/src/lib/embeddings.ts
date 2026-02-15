import {pipeline} from "@xenova/transformers"
import { normalize } from "path";

let embedder: any;

export async function getEmbedding(text: string): Promise<number[]>{
    if(!embedder){
        embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }

    const out = await embedder(text, {pooling: "mean", normalize: true});
    return Array.from(out.data as Float32Array);
}