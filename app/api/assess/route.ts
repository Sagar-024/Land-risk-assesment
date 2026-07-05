import { NextRequest, NextResponse } from 'next/server';
import { runPipeline } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 300; // fetch + LLM can take 60s+

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 }); }

  const address = (body?.address || '').trim();
  const landUse = (body?.land_use || 'Residential').trim();

  if (!address) return NextResponse.json({ error: 'address is required' }, { status: 400 });
  if (address.length > 500) return NextResponse.json({ error: 'address too long' }, { status: 400 });

  const result = await runPipeline(address, landUse);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET() {
  return NextResponse.json({
    name: 'Land Purchase Risk Assessment API v2',
    endpoints: { POST: { address: 'string (required)', land_use: 'string (optional, default: Residential)' } },
  });
}
