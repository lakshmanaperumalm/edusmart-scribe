// Server-only AI helper using Lovable AI Gateway. Never import from client modules.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function openaiChat(opts: {
  messages: ChatMsg[];
  model?: string;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;
}): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");

  const body: Record<string, unknown> = {
    model: opts.model ?? "google/gemini-2.5-flash",
    messages: opts.messages,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.jsonSchema.name, schema: opts.jsonSchema.schema, strict: false },
    };
  }

  const MAX_RETRIES = 5;
  let backoff = 1200;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const json = (await res.json()) as { choices: { message: { content: string } }[] };
      return json.choices[0]?.message?.content ?? "";
    }

    const txt = await res.text();
    console.error(`[ai-gateway] error ${res.status} (attempt ${attempt + 1}): ${txt.slice(0, 400)}`);

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff;
      await new Promise((r) => setTimeout(r, waitMs));
      backoff = Math.min(backoff * 2, 15000);
      continue;
    }

    if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    const snippet = txt.slice(0, 200).replace(/\s+/g, " ");
    throw new Error(`AI service request failed (${res.status}): ${snippet}`);
  }
  throw new Error("Rate limit reached. Please try again in a moment.");
}

export async function openaiJSON<T>(opts: {
  messages: ChatMsg[];
  schema: { name: string; schema: Record<string, unknown> };
  model?: string;
}): Promise<T> {
  const text = await openaiChat({
    messages: opts.messages,
    model: opts.model,
    jsonSchema: opts.schema,
    temperature: 0.7,
  });
  try {
    return JSON.parse(text) as T;
  } catch {
    // Try to recover JSON from inside fences
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("Failed to parse JSON from model");
  }
}
