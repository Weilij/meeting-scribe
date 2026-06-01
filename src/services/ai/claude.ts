import Anthropic from "@anthropic-ai/sdk";
import type { SummaryResult } from "../../types";
import { buildPrompt, parseJSONResponse } from "./prompt";

export async function summarizeWithClaude(
  transcript: string,
  apiKey: string,
  model: string,
  language: string
): Promise<SummaryResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: buildPrompt(transcript, language) }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return parseJSONResponse(content.text);
}
