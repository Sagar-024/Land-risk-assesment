import { NextRequest } from 'next/server';
import { runPipelineStream } from '@/lib/pipeline';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return new Response('invalid JSON body', { status: 400 }); }

  const address = (body?.address || '').trim();
  const landUse = (body?.land_use || 'Residential').trim();
  if (!address) return new Response('address is required', { status: 400 });
  if (address.length > 500) return new Response('address too long', { status: 400 });

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: any) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch { /* controller already closed */ }
      };

      // SSE heartbeat every 2s — prevents proxy idle timeouts during long LLM stages
      const heartbeat = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`)); }
        catch { /* controller closed */ }
      }, 2000);

      try {
        await runPipelineStream(address, landUse, send);
      } catch (e: any) {
        send({ type: 'error', error: e.message || String(e) });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() { closed = true; },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
