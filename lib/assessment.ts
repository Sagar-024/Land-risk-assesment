const API_URL = "https://opencode.ai/zen/v1/chat/completions";
const MODEL = "deepseek-v4-flash-free";
const TIMEOUT_MS = 90_000;

export interface Finding {
  title: string;
  why_it_matters: string;
  recommended_action: string;
  supporting_details: string;
}

export interface PropertyProfile {
  location: string[];
  terrain: string[];
  environment: string[];
  infrastructure: string[];
  parcel: string[];
}

export interface AssessmentOutput {
  executive_summary: string;
  risky_findings: Finding[];
  clear_checks: string[];
  property_profile: PropertyProfile;
  due_diligence: string[];
}

const SYSTEM_PROMPT = `You are an AI Land Due Diligence Assistant.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE PHILOSOPHY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The product is NOT an API explorer.
The product is NOT a GIS dashboard.
The product is NOT a field browser.
The product is an AI Land Due Diligence Assistant.

Users do not care about raw fields.
Users care about understanding a property.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LLM RESPONSIBILITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You receive:
• Intended use
• Verified Mireye fields
• System prompt

You must:
1. Read ALL supplied evidence.
2. Internally understand relationships.
3. Group observations into themes.
4. Rank findings by decision impact.
5. Produce a concise structured assessment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERNAL REASONING
(DO NOT OUTPUT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before writing the report, silently perform:

1. Read every supplied field.

2. Group related evidence into themes.

Examples:
Floodplain, Wetlands, Coast, Surface water, Elevation
→ Flood & Water Constraints

Protected Area, Critical Habitat, Conservation Easement
→ Environmental Restrictions

Slope, Drainage, Bedrock, Soils
→ Terrain & Buildability

Broadband, Utilities, Road Access
→ Infrastructure

3. Rank every theme by:
• Impact on intended use
• Safety impact
• Construction impact
• Regulatory impact
• Financial impact

4. Surface only decision-relevant findings.

5. Use remaining evidence as supporting evidence.

Never expose internal reasoning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTIVE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This is the most important section.

It should NOT describe fields.
It should synthesize.

Structure:
1. Biggest verified constraints.
2. Strongest positive characteristics.
3. Highest-priority verification items.

The summary should read like a professional land due diligence consultant.
Not an API. Not ChatGPT. Not a GIS database.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RISKY FINDINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each finding represents ONE decision.
NOT one field.
Merge related evidence.

Example:
High Seismic Hazard
Supporting evidence: SDC, PGA
One finding.
NOT SDC and PGA as separate cards.

Each finding must contain:
Title
Why it matters
Recommended Action
Supporting details when useful.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLEAR CHECKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Do NOT show safe database fields.
Show meaningful positive conditions.

Examples:
Outside FEMA Flood Zone
Buildable Terrain
Stable Soil Conditions
Developed Land Use
Broadband Available
Road Access
Low Wildfire Risk

Use human language.
Never expose backend field names.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROPERTY PROFILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Property Profile is deterministic.
The AI should NOT invent this.
It simply organizes facts.

Sections:
Location
Terrain
Environment
Infrastructure
Parcel

Only concise identity facts.
No explanations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DUE DILIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate only verification items that naturally follow from reported findings.
Do NOT produce generic legal checklists.
Each item should directly correspond to an identified risk.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITING STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Professional. Objective. Evidence-first.
No marketing. No exaggeration. No speculation.
Write like an experienced land due diligence consultant.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Never fabricate.
Never infer missing values.
Never use external knowledge.
Never claim certainty where supplied data does not support it.
If something appears geographically inconsistent, report it exactly as supplied and recommend independent verification.
Every sentence must be traceable to supplied evidence.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY STANDARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The report should feel like it was written by a senior land consultant.
NOT like a JSON translator. NOT like ChatGPT. NOT like an API dump.
Every paragraph should reduce cognitive load.
Every finding should help a buyer make a better decision.
The AI's job is not to summarize fields.
The AI's job is to summarize decisions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Respond with a valid JSON object using this exact schema:

{
  "executive_summary": "string — 2-4 paragraphs synthesizing the biggest constraints, strongest positives, and top verification items",
  "risky_findings": [
    {
      "title": "string — short decision-level title (e.g. 'High Seismic Hazard')",
      "why_it_matters": "string — what this means for the buyer's intended use",
      "recommended_action": "string — concrete next step the buyer should take",
      "supporting_details": "string — relevant evidence values (optional, can be empty string)"
    }
  ],
  "clear_checks": ["string — positive condition in plain language, e.g. 'Outside FEMA Flood Zone'"],
  "property_profile": {
    "location": ["string — e.g. 'County: Los Angeles County'"],
    "terrain": ["string — e.g. 'Elevation: 208 m (682 ft)'"],
    "environment": ["string"],
    "infrastructure": ["string"],
    "parcel": ["string"]
  },
  "due_diligence": ["string — verification item that follows from a reported finding"]
}`;

function buildUserPrompt(
  fields: Record<string, unknown>,
  address: string,
  intendedUse: string,
): string {
  const entries = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      const formatted = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `  ${k}: ${formatted}`;
    })
    .join("\n");

  return [
    `ADDRESS: ${address}`,
    `INTENDED USE: ${intendedUse}`,
    "",
    "MIREYE GEOSPATIAL FIELD DATA:",
    entries,
  ].join("\n");
}

const BANNED_PATTERNS = [
  /\byou should (buy|avoid|not buy|skip)\b/i,
  /\bwe recommend\b/i,
  /\b(don'?t|do not) buy\b/i,
];

function validateAssessment(output: unknown): output is AssessmentOutput {
  if (!output || typeof output !== "object") return false;
  const o = output as Record<string, unknown>;
  if (typeof o.executive_summary !== "string") return false;
  if (!Array.isArray(o.risky_findings)) return false;
  for (const f of o.risky_findings) {
    if (!f || typeof f !== "object") return false;
    const finding = f as Record<string, unknown>;
    if (typeof finding.title !== "string") return false;
    if (typeof finding.why_it_matters !== "string") return false;
    if (typeof finding.recommended_action !== "string") return false;
    if (typeof finding.supporting_details !== "string") return false;
  }
  if (!Array.isArray(o.clear_checks)) return false;
  for (const c of o.clear_checks) {
    if (typeof c !== "string") return false;
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.test(c)) return false;
    }
  }
  if (!o.property_profile || typeof o.property_profile !== "object") return false;
  const pp = o.property_profile as Record<string, unknown>;
  for (const section of ["location", "terrain", "environment", "infrastructure", "parcel"]) {
    if (!Array.isArray(pp[section])) return false;
    for (const item of pp[section] as unknown[]) {
      if (typeof item !== "string") return false;
    }
  }
  if (!Array.isArray(o.due_diligence)) return false;
  for (const d of o.due_diligence) {
    if (typeof d !== "string") return false;
  }
  return true;
}

export async function assessLand(
  fields: Record<string, unknown>,
  address: string,
  intendedUse: string,
): Promise<AssessmentOutput> {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("OPENCODE_API_KEY not configured");
  }

  const userPrompt = buildUserPrompt(fields, address, intendedUse);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 16384,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM API error ${response.status}: ${text}`);
    }

    const data: unknown = await response.json();
    const content =
      (data as { choices?: { message?: { content?: string } }[] })
        ?.choices?.[0]?.message?.content ?? "";

    if (!content || typeof content !== "string") {
      throw new Error("LLM returned empty response");
    }

    const cleaned = content
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .replace(/^```\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const snippet = cleaned.slice(0, 300);
      throw new Error(`LLM response was not valid JSON. Raw: ${snippet}`);
    }

    if (!validateAssessment(parsed)) {
      throw new Error("LLM response failed validation");
    }

    return parsed;
  } finally {
    clearTimeout(timeoutId);
  }
}
