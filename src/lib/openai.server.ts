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

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`[ai-gateway] error ${res.status}: ${txt.slice(0, 800)}`);
    if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
    throw new Error("AI service request failed. Please try again.");
  }
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content ?? "";
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
