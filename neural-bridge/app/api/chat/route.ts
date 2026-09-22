import { NextResponse } from 'next/server';

export const maxDuration = 300;

type IncomingMessage = { role?: unknown; content?: unknown; images?: unknown };

function imageDataUrl(image: string) {
  if (image.startsWith('data:')) return image;
  const mime = image.startsWith('iVBOR') ? 'image/png'
    : image.startsWith('R0lGOD') ? 'image/gif'
    : image.startsWith('UklGR') ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${image}`;
}

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request.' }, { status: 400 });
  }
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0 ||
      body.messages.some((m: IncomingMessage) => !m ||
        !['user', 'assistant', 'system'].includes(String(m.role)) || typeof m.content !== 'string')) {
    return NextResponse.json({ error: 'Provide valid chat messages.' }, { status: 400 });
  }
  const { url, messages } = body;
  const provider = body.provider ?? 'ollama';
  if (provider !== 'modal' && provider !== 'ollama') {
    return NextResponse.json({ error: 'Unsupported provider.' }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const signal = AbortSignal.timeout(280_000);
    let endpoint: string;
    let model = body.model;
    if (provider === 'modal') {
      const { MODAL_ENDPOINT, MODAL_KEY, MODAL_SECRET } = process.env;
      if (!MODAL_ENDPOINT || !MODAL_KEY || !MODAL_SECRET) {
        return NextResponse.json({ error: 'Configure MODAL_ENDPOINT, MODAL_KEY and MODAL_SECRET on the server.' }, { status: 503 });
      }
      // Only the server configuration controls where credentials are sent.
      const base = MODAL_ENDPOINT.replace(/\/+$/, '').replace(/\/v1(?:\/chat\/completions)?$/, '');
      const target = new URL(base);
      if (target.protocol !== 'https:') throw new Error('Modal requires HTTPS');
      headers['Modal-Key'] = MODAL_KEY;
      headers['Modal-Secret'] = MODAL_SECRET;
      headers.Authorization = `Bearer ${MODAL_KEY}.${MODAL_SECRET}`;
      endpoint = `${base}/v1/chat/completions`;
      model = process.env.MODAL_MODEL;
      if (!model) {
        const modelsResponse = await fetch(`${base}/v1/models`, { headers, signal, redirect: 'error', cache: 'no-store' });
        if (!modelsResponse.ok) {
          return NextResponse.json({ error: `Modal model discovery failed (${modelsResponse.status}). Check the endpoint and credentials, or set MODAL_MODEL.` }, { status: 502 });
        }
        const models = await modelsResponse.json();
        model = models?.data?.[0]?.id;
        if (typeof model !== 'string' || !model) {
          return NextResponse.json({ error: 'Modal returned no models. Set MODAL_MODEL on the server.' }, { status: 502 });
        }
      }
    } else {
      if (typeof url !== 'string' || typeof model !== 'string' || !model.trim()) {
        return NextResponse.json({ error: 'Provide an Ollama URL and model.' }, { status: 400 });
      }
      let target;
      try { target = new URL(url); } catch {
        return NextResponse.json({ error: 'Invalid Ollama URL.' }, { status: 400 });
      }
      if (!['http:', 'https:'].includes(target.protocol)) {
        return NextResponse.json({ error: 'Use an HTTP or HTTPS Ollama URL.' }, { status: 400 });
      }
      const base = url.replace(/\/+$/, '');
      endpoint = base.endsWith('/api/chat') ? base : `${base}/api/chat`;
      headers['ngrok-skip-browser-warning'] = 'true';
    }

    const normalizedMessages = messages.map((message: IncomingMessage) => {
      const images = Array.isArray(message.images)
        ? message.images.filter((image): image is string => typeof image === 'string' && image.length > 0) : [];
      if (provider === 'modal' && images.length) {
        return { role: message.role, content: [
          { type: 'text', text: message.content },
          ...images.map(image => ({ type: 'image_url', image_url: { url: imageDataUrl(image) } })),
        ] };
      }
      return { role: message.role, content: message.content,
        ...(images.length ? { images: images.map(image => image.replace(/^data:[^,]+,/, '')) } : {}) };
    });
    const response = await fetch(endpoint, {
      method: 'POST', headers, signal, redirect: 'error',
      body: JSON.stringify({ model, messages: normalizedMessages, stream: false }),
    });
    if (!response.ok) {
      // Do not expose upstream bodies, which can include credential-bearing diagnostics.
      return NextResponse.json({ error: `${provider === 'modal' ? 'Modal' : 'Ollama'} request failed (${response.status}). Check the model, credentials and endpoint configuration.` }, { status: response.status });
    }
    const data = await response.json();
    if (provider === 'modal') {
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        return NextResponse.json({ error: 'Modal returned no assistant text.' }, { status: 502 });
      }
      return NextResponse.json({
        message: { role: 'assistant', content },
        prompt_eval_count: data.usage?.prompt_tokens,
        eval_count: data.usage?.completion_tokens,
      });
    }
    return NextResponse.json(data);
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return NextResponse.json({ error: timedOut
      ? 'The model request timed out. Please try again.'
      : 'Could not reach the model endpoint. Check the server configuration and try again.' },
    { status: timedOut ? 504 : 502 });
  }
}
