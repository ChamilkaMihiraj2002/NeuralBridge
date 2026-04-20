import { NextResponse } from 'next/server';

export const maxDuration = 300;

type IncomingMessage = {
  role?: unknown;
  content?: unknown;
  images?: unknown;
};

export async function POST(req: Request) {
  try {
    console.log("[API] Incoming chat request to proxy");
    const { url, model, messages } = await req.json();
    console.log(`[API] Target url: ${url}, model: ${model}, messages count: ${messages.length}`);
    
    // Check if there are images
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.images) {
      console.log(`[API] Found image in last message to send, base64 length: ${lastMessage.images[0].length}`);
    }

    const endpoint = url.endsWith('/api/chat') ? url : `${url}/api/chat`;
    const normalizedMessages = Array.isArray(messages)
      ? messages.map((message: IncomingMessage) => {
          const normalizedMessage: {
            role: string;
            content: string;
            images?: string[];
          } = {
            role: typeof message?.role === 'string' ? message.role : 'user',
            content: typeof message?.content === 'string' ? message.content : '',
          };

          if (Array.isArray(message?.images)) {
            const encodedImages = message.images.filter(
              (image): image is string => typeof image === 'string' && image.length > 0
            );

            if (encodedImages.length > 0) {
              normalizedMessage.images = encodedImages;
            }
          }

          return normalizedMessage;
        })
      : [];

    console.log(`[API] Fetching ${endpoint}...`);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', 
      },
      body: JSON.stringify({
        model,
        messages: normalizedMessages,
        stream: false,
      }),
    });

    console.log(`[API] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API] Error text:", errorText);
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    console.log("[API] Success, returning data.");
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[API] Root Catch block hit:", message);
    return NextResponse.json(
      { error: 'Failed to connect to the Ngrok backend. Ensure the backend is reachable and not timing out.' },
      { status: 500 }
    );
  }
}
