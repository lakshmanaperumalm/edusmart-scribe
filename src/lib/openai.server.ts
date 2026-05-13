// Server-only OpenAI helper. Never import this from client modules.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function openaiChat(opts: {
  messages: ChatMsg[];
  model?: string;
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  temperature?: number;
}): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  const body: Record<string, unknown> = {
    model: opts.model ?? "gpt-4o-mini",
    messages: opts.messages,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.jsonSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: opts.jsonSchema.name, schema: opts.jsonSchema.schema, strict: false },
    };
  }

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`[openai] error ${res.status}: ${txt.slice(0, 800)}`);
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
