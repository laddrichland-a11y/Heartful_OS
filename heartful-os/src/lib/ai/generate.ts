import Anthropic from "@anthropic-ai/sdk";
import { PromptPair } from "./prompts";

// ---------------------------------------------------------------------------
// Thin wrapper around the Anthropic Claude API.
// If ANTHROPIC_API_KEY is not set, falls back to a deterministic mock so
// every AI feature stays fully clickable without credentials.
// ---------------------------------------------------------------------------

const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

// claude-haiku-4-5-20251001 — fast and available on all API tiers.
// Upgrade to "claude-sonnet-4-6" if your API key has access to that model.
const MODEL = "claude-haiku-4-5-20251001";

export async function runAiJson<T = Record<string, unknown>>(
  prompt: PromptPair,
  mockFallback: () => T
): Promise<{ data: T; model: string; mocked: boolean }> {
  if (!anthropic) {
    await new Promise((r) => setTimeout(r, 600));
    return { data: mockFallback(), model: "mock-fallback (no ANTHROPIC_API_KEY set)", mocked: true };
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "{}";
    // Strip markdown code fences if the model wraps its JSON output
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return { data: JSON.parse(cleaned) as T, model: MODEL, mocked: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Anthropic API call failed, falling back to mock:", msg);
    return { data: mockFallback(), model: `mock-fallback: ${msg}`, mocked: true };
  }
}
