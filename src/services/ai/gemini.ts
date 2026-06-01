import { GoogleGenerativeAI } from "@google/generative-ai";
import type { SummaryResult } from "../../types";
import { buildPrompt, parseJSONResponse } from "./prompt";

export async function summarizeWithGemini(
  transcript: string,
  apiKey: string,
  model: string,
  language: string
): Promise<SummaryResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({
    model,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await geminiModel.generateContent(buildPrompt(transcript, language));
  const text = result.response.text();
  return parseJSONResponse(text);
}
