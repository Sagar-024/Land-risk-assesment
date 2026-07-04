import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocode";
import { fetchMireyeFields } from "@/lib/mireye/client";
import { ALL_RELEVANT_FIELDS } from "@/lib/mireye/fields";
import { assessLand } from "@/lib/assessment";

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

    const BATCH_SIZE = 50;
    const batches: string[][] = [];
    for (let i = 0; i < ALL_RELEVANT_FIELDS.length; i += BATCH_SIZE) {
      batches.push(ALL_RELEVANT_FIELDS.slice(i, i + BATCH_SIZE) as string[]);
    }
    const results = await Promise.all(
      batches.map((batch) => fetchMireyeFields(lat, lng, batch)),
    );
    const fields: Record<string, unknown> = {};
    for (const result of results) {
      Object.assign(fields, result);
    }
    const assessment = await assessLand(
      fields,
      address,
      intendedUse ?? "residential",
    );

    return NextResponse.json({
      address,
      intendedUse,
      coordinates: { lat, lng },
      assessment,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
