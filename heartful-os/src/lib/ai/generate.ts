import Anthropic from "@anthropic-ai/sdk";
import { PromptPair } from "./prompts";

// ---------------------------------------------------------------------------
// Thin wrapper around the Anthropic Claude API.
//
// It used to fall back SILENTLY to a canned "sample" answer whenever the key
// was missing or the call failed — which produced generic briefs that looked
// real but ignored everything the practitioner had typed. Now a missing key
// or a failed call is a clear error the UI shows ("nothing was generated").
// The canned answers are only used when HEARTFUL_ALLOW_MOCK_AI=1 is set
// deliberately (e.g. recording a demo with no key).
// ---------------------------------------------------------------------------

const apiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = apiKey ? new Anthropic({ apiKey }) : null;
const allowMock = process.env.HEARTFUL_ALLOW_MOCK_AI === "1";

// claude-haiku-4-5-20251001 — fast and available on all API tiers.
// Upgrade to "claude-sonnet-4-6" if your API key has access to that model.
const MODEL = "claude-haiku-4-5-20251001";

export class AiUnavailableError extends Error {}

export async function runAiJson<T = Record<string, unknown>>(
  prompt: PromptPair,
  mockFallback: () => T
): Promise<{ data: T; model: string; mocked: boolean }> {
  if (!anthropic) {
    if (allowMock) {
      await new Promise((r) => setTimeout(r, 600));
      return { data: mockFallback(), model: "mock-fallback (no ANTHROPIC_API_KEY set)", mocked: true };
    }
    throw new AiUnavailableError(
      "AI is turned off — no Anthropic API key is set, so nothing was generated. Your notes are still saved."
    );
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
    console.error("Anthropic API call failed:", msg);
    if (allowMock) return { data: mockFallback(), model: `mock-fallback: ${msg}`, mocked: true };
    throw new AiUnavailableError(
      "The AI couldn't be reached, so nothing was generated. Your notes are still saved — please try again in a moment."
    );
  }
}
