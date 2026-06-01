import type { SummaryResult } from "../../types";
import { buildPrompt, parseJSONResponse } from "./prompt";

export async function summarizeWithOllama(
  transcript: string,
  baseUrl: string,
  model: string,
  language: string
): Promise<SummaryResult> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [{ role: "user", content: buildPrompt(transcript, language) }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama 錯誤：${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return parseJSONResponse(data.message.content);
}
