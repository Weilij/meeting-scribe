import OpenAI from "openai";
import type { SummaryResult } from "../../types";
import { buildPrompt, parseJSONResponse } from "./prompt";

export async function summarizeWithOpenAI(
  transcript: string,
  apiKey: string,
  model: string,
  language: string
): Promise<SummaryResult> {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.chat.completions.create({
    model,
    max_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: buildPrompt(transcript, language) }],
  });

  const text = response.choices[0].message.content ?? "";
  return parseJSONResponse(text);
}
