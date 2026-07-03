import { polish } from "./lib/summary/polish";
import { Interpretation } from "./lib/summary/interpret";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const MOCK_INTERPRETATIONS: Interpretation[] = [
  {
    sourceField: "within_floodplain_polygon",
    severity: "critical",
    sentence: "This parcel sits inside a FEMA flood zone — mandatory flood insurance applies to any permanent structure and stricter foundation and elevation requirements will govern construction; get a flood insurance quote and a flood-zone elevation certificate before going under contract.",
  },
  {
    sourceField: "intersects_protected_area",
    severity: "high",
    sentence: "This parcel overlaps a federally protected area — development is typically restricted or requires federal review regardless of intended use; request a formal determination from the managing agency before purchase to understand what activities are permitted.",
  }
];

async function runTests() {
  console.log("=== 1. VERIFYING SUCCESS & VALIDATION (REAL API KEY) ===");
  const originalKey = process.env.OPENCODE_API_KEY;
  if (!originalKey) {
    console.error("No OPENCODE_API_KEY found in .env, skipping test 1.");
  } else {
    const successResult = await polish(MOCK_INTERPRETATIONS);
    console.log("Polished Status:", successResult.polished);
    console.log("Output:");
    successResult.interpretations.forEach((item, idx) => {
      console.log(`[Original ${idx+1}]:`, MOCK_INTERPRETATIONS[idx].sentence);
      console.log(`[Polished ${idx+1}]:`, item.sentence);
      // Basic check
      const hasFlood = item.sentence.toLowerCase().includes("flood");
      const hasProtected = item.sentence.toLowerCase().includes("protect");
      console.log(`[Validation]: Mentions flood? ${hasFlood} | Mentions protected? ${hasProtected}`);
    });
  }

  console.log("\n=== 2. VERIFYING FALLBACK (BROKEN API KEY) ===");
  process.env.OPENCODE_API_KEY = "sk-broken-key-123456";
  const fallbackResult = await polish(MOCK_INTERPRETATIONS);
  console.log("Polished Status:", fallbackResult.polished);
  if (fallbackResult.polished === false && fallbackResult.interpretations === MOCK_INTERPRETATIONS) {
    console.log("Fallback succeeded: Returned identical reference to original interpretations.");
  } else {
    console.log("Fallback failed or altered data.");
  }

  // Restore
  process.env.OPENCODE_API_KEY = originalKey;
}

runTests().catch(console.error);
