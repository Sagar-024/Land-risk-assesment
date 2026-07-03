/**
 * lib/summary/polish.ts
 *
 * Optional readability polishing layer — Phase 2.
 *
 * CONTRACT (hard constraints — never violate):
 *  1. This function receives ONLY the output of interpret(). It never sees
 *     raw Mireye field data, the Report object, or any upstream pipeline data.
 *  2. It improves readability only. It must never add facts, numbers,
 *     severity judgments, recommendations, opinions, or verdict language.
 *  3. On ANY failure (timeout, network error, bad JSON, validation failure,
 *     missing API key) it silently returns the original Interpretation[]
 *     unchanged. The report ALWAYS renders.
 *  4. API key is read exclusively from process.env.OPENCODE_API_KEY.
 *     Never hardcoded, never logged, never returned in responses.
 *  5. temperature: 0 — deterministic output, no creative drift.
 */

import type { Interpretation } from "./interpret";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "deepseek/deepseek-chat:free";
const TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// System prompt
//
// Tightly scoped to readability editing only.
// Banned patterns are enumerated explicitly so the model can self-check.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a plain-language editor for a land risk assessment tool.

You will receive a JSON array of sentences. Each sentence already contains three parts:
1. A geospatial finding about a land parcel
2. What that finding means for a buyer's specific intended use
3. A concrete next verification step the buyer should take

Your ONLY job is to improve readability — sentence flow, clarity, and natural rhythm.

STRICT RULES — violating any of these means your response will be discarded:
• Do NOT add any new facts, statistics, or numbers that were not in the original sentence
• Do NOT add recommendations, verdicts, or buy/no-buy language ("you should buy/avoid", "good/bad investment", "this is safe/risky", "we recommend")
• Do NOT add opinions or severity judgments beyond what is already stated
• Do NOT remove the next verification step (the part after the last semicolon or dash)
• Do NOT change the meaning of any sentence
• Keep every sentence self-contained — no merging or splitting
• If a sentence is already clear, return it exactly as received

RESPONSE FORMAT:
Return ONLY a valid JSON array of strings, one string per input sentence, in the same order.
No markdown. No code fences. No explanation. No extra keys.
Example output: ["polished sentence 1", "polished sentence 2"]`;

// ---------------------------------------------------------------------------
// Validation
//
// Rejects polished output if it violates safety constraints.
// Protects against model drift, jailbreak, or unexpected output format.
// ---------------------------------------------------------------------------

const BANNED_PATTERNS = [
  /\byou should (buy|avoid|not buy|skip)\b/i,
  /\bwe recommend\b/i,
  /\b(don'?t|do not) buy\b/i,
  /\bavoid this\b/i,
  /\bsafe (overall|investment|parcel|land)\b/i,
  /\brisky (overall|investment|parcel|land)\b/i,
  /\b(good|bad|great|terrible|excellent|poor) investment\b/i,
  /\bstay away\b/i,
  /\bpass on this\b/i,
  /\bwalk away\b/i,
];

function validatePolished(originals: string[], candidates: unknown[]): boolean {
  // Must be same length as input
  if (candidates.length !== originals.length) return false;

  for (const candidate of candidates) {
    // Every item must be a non-empty string
    if (typeof candidate !== "string") return false;
    if (candidate.trim().length === 0) return false;

    // Must not contain banned verdict/recommendation language
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.test(candidate)) return false;
    }

    // Sentence must not be dramatically longer than the original
    // (a proxy for "added undeclared facts"). Allow up to 50% growth.
    const idx = candidates.indexOf(candidate);
    if (idx >= 0 && originals[idx]) {
      const ratio = candidate.length / originals[idx].length;
      if (ratio > 1.5) return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PolishResult {
  interpretations: Interpretation[];
  /** true = LLM improved readability; false = original interpret() output used */
  polished: boolean;
}

/**
 * polish — optional async LLM readability layer.
 *
 * Receives the output of interpret() only.
 * Returns improved readability sentences, or the originals on any failure.
 * NEVER throws — always returns a valid PolishResult.
 *
 * Fallback triggers:
 *  - OPENCODE_API_KEY is missing or empty
 *  - Network request fails or times out (8s)
 *  - Response is not valid JSON
 *  - Parsed array fails validation (wrong length, banned patterns, type errors)
 *  - Any uncaught exception
 *
 * @param interpretations  Output from interpret() — no raw Mireye data.
 * @returns  PolishResult with interpretations (improved or original) and polished flag.
 */
export async function polish(
  interpretations: Interpretation[],
): Promise<PolishResult> {
  // Fast path: empty input
  if (interpretations.length === 0) {
    return { interpretations: [], polished: false };
  }

  // Fast path: API key not configured — silently degrade
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return { interpretations, polished: false };
  }

  const originals = interpretations.map((i) => i.sentence);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          // OpenRouter headers — helps with rate limiting and routing
          "HTTP-Referer": "https://land-risk-assessment.local",
          "X-Title": "Land Risk Assessment",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: JSON.stringify(originals) },
          ],
          temperature: 0,
          max_tokens: 2048,
          response_format: { type: "text" }, // avoid JSON mode to keep it simple
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      // Non-2xx → fallback
      return { interpretations, polished: false };
    }

    const data: unknown = await response.json();

    // Extract content from OpenRouter/OpenAI-compatible response
    const content =
      (data as { choices?: { message?: { content?: string } }[] })
        ?.choices?.[0]?.message?.content ?? "";

    if (!content || typeof content !== "string") {
      return { interpretations, polished: false };
    }

    // Strip markdown code fences if the model added them despite instructions
    const cleaned = content
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { interpretations, polished: false };
    }

    if (!Array.isArray(parsed)) {
      return { interpretations, polished: false };
    }

    // Validate — reject if safety constraints violated
    if (!validatePolished(originals, parsed as unknown[])) {
      return { interpretations, polished: false };
    }

    // Build polished Interpretation[] — carry sourceField and severity through unchanged,
    // only the sentence is updated (readability only, no structural change)
    const polishedInterpretations: Interpretation[] = interpretations.map(
      (item, i) => ({
        ...item,
        sentence: (parsed as string[])[i] ?? item.sentence,
      }),
    );

    return { interpretations: polishedInterpretations, polished: true };
  } catch {
    // Timeout, AbortError, JSON parse error, anything else → fallback
    return { interpretations, polished: false };
  }
}
