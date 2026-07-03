import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { fetchMireyeFields } from "@/lib/mireye/client";
import {
  BASELINE_FIELDS,
  QUICK_HAZARD_FIELDS,
  type BaselineResult,
} from "@/lib/mireye/fields";
import { decideBranches, getAllTriggeredFields } from "@/lib/mireye/planner";
import { buildReport } from "@/lib/report";
import { interpret, type Interpretation } from "@/lib/summary/interpret";
import { polish } from "@/lib/summary/polish";

export async function POST(req: NextRequest) {
  try {
    const { address, intendedUse } = await req.json();

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "address is required" },
        { status: 400 },
      );
    }

    const { lat, lng } = await geocodeAddress(address);

    const baseline = await fetchMireyeFields(lat, lng, BASELINE_FIELDS);
    const quickHazard = await fetchMireyeFields(lat, lng, QUICK_HAZARD_FIELDS);

    const mergedBaseline = { ...baseline, ...quickHazard } as BaselineResult;
    const triggeredBranches = decideBranches(mergedBaseline);

    const branchResults: Record<string, Record<string, unknown>> = {};
    if (triggeredBranches.length > 0) {
      const branchFields = getAllTriggeredFields(mergedBaseline);
      const branchData = await fetchMireyeFields(lat, lng, branchFields);
      for (const branch of triggeredBranches) {
        const branchResult: Record<string, unknown> = {};
        for (const field of branch.fields) {
          if (branchData[field] !== undefined) {
            branchResult[field] = branchData[field];
          }
        }
        branchResults[branch.id] = branchResult;
      }
    }

    const report = buildReport(mergedBaseline, quickHazard, branchResults);

    // ── Plain-language interpretation layer (Phase 1 + 2) ─────────────────
    // Step 1: interpret() — pure, synchronous, reads finished report only.
    // Step 2: polish()   — optional async LLM readability pass (DeepSeek).
    //         Falls back to interpret() output on any failure (timeout,
    //         bad JSON, validation fail, missing key). Report always renders.
    // Neither step modifies the report or influences any upstream logic.
    let interpretations: Interpretation[] = [];
    try {
      const raw = interpret(report, intendedUse ?? "residential");
      const { interpretations: polished } = await polish(raw);
      interpretations = polished;
    } catch {
      // Constraint: if this layer throws for any reason, interpretations = []
      // and the rest of the response is unaffected.
      interpretations = [];
    }

    return NextResponse.json({
      address,
      intendedUse,
      coordinates: { lat, lng },
      report,
      interpretations, // pre-computed server-side; API key never leaves server
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
