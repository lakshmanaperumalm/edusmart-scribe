import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Sliding-window per-user rate limit for AI calls.
 * Counts rows in `ai_call_log` for the user in the past `windowMinutes`.
 * Throws a Response 429 if over the limit, otherwise logs the call.
 */
export async function enforceAiRateLimit(
  userId: string,
  kind: string,
  opts: { limit?: number; windowMinutes?: number } = {},
) {
  const limit = opts.limit ?? 30;
  const windowMinutes = opts.windowMinutes ?? 60;
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  const { count, error } = await supabaseAdmin
    .from("ai_call_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    console.error("[rate-limit] count error", error);
    // Fail-open on infra error to avoid breaking the app
    return;
  }

  if ((count ?? 0) >= limit) {
    throw new Response(
      `Rate limit exceeded: max ${limit} AI calls per ${windowMinutes} minutes. Please wait and try again.`,
      { status: 429 },
    );
  }

  await supabaseAdmin.from("ai_call_log").insert({ user_id: userId, kind });
}
