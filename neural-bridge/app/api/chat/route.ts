import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { url, model, messages } = await req.json();

    const endpoint = url.endsWith('/api/chat') ? url : `${url}/api/chat`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', 
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: 'Failed to connect to the Ngrok backend.' },
      { status: 500 }
    );
  }
}
