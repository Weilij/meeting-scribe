import type { Settings, SummaryResult } from "../../types";
import { summarizeWithClaude } from "./claude";
import { summarizeWithOpenAI } from "./openai";
import { summarizeWithGemini } from "./gemini";
import { summarizeWithOllama } from "./ollama";

export async function summarizeTranscript(
  transcript: string,
  settings: Settings
): Promise<SummaryResult> {
  const lang = settings.outputLanguage;

  switch (settings.aiProvider) {
    case "claude":
      if (!settings.claudeApiKey) throw new Error("請填入 Claude API Key");
      return summarizeWithClaude(transcript, settings.claudeApiKey, settings.claudeModel, lang);

    case "openai":
      if (!settings.openaiApiKey) throw new Error("請填入 OpenAI API Key");
      return summarizeWithOpenAI(transcript, settings.openaiApiKey, settings.openaiModel, lang);

    case "gemini":
      if (!settings.geminiApiKey) throw new Error("請填入 Gemini API Key");
      return summarizeWithGemini(transcript, settings.geminiApiKey, settings.geminiModel, lang);

    case "ollama":
      return summarizeWithOllama(transcript, settings.ollamaBaseUrl, settings.ollamaModel, lang);

    default:
      throw new Error("未知的 AI Provider");
  }
}
