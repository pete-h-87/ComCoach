import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_FALLBACK_MODEL = "gemini-2.0-flash";

export function isGeminiConfigured(): boolean {
  return !!GEMINI_API_KEY;
}

export async function callGeminiWithRetry(
  body: unknown,
  maxAttempts = 3
): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const models = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL];

  for (const model of models) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (r.ok) {
          const data: any = await r.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (typeof text !== "string") {
            return { ok: false, status: 502, error: "unexpected gemini response" };
          }
          if (model !== GEMINI_MODEL) {
            console.log(`[gemini] succeeded via fallback model "${model}"`);
          }
          return { ok: true, text };
        }

        const transient = r.status === 429 || r.status === 503;
        const errText = await r.text();
        console.error(`Gemini error (${model}, attempt ${attempt}):`, r.status, errText);

        if (!transient) {
          return { ok: false, status: 502, error: "gemini request failed" };
        }

        if (attempt < maxAttempts) {
          const backoffMs = 400 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 200);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      } catch (e) {
        console.error(`Gemini fetch threw (${model}, attempt ${attempt}):`, e);
        if (attempt < maxAttempts) {
          const backoffMs = 400 * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }
    console.warn(`[gemini] model "${model}" exhausted retries; trying next model`);
  }
  return { ok: false, status: 503, error: "gemini unavailable" };
}
