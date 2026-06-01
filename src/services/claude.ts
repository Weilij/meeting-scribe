import Anthropic from "@anthropic-ai/sdk";
import type { SummaryResult } from "../types";

export async function summarizeTranscript(
  transcript: string,
  apiKey: string,
  language: string = "zh-TW"
): Promise<SummaryResult> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const langInstruction =
    language === "zh-TW"
      ? "請用繁體中文輸出所有內容。"
      : language === "zh-CN"
      ? "请用简体中文输出所有内容。"
      : "Please output all content in English.";

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `你是專業的會議記錄整理助手。${langInstruction}

請根據以下逐字稿，輸出 JSON 格式的會議摘要。

JSON 結構如下（嚴格遵守，只輸出 JSON，不要任何其他文字）：
{
  "title": "會議標題（15字內）",
  "tldr": "一句話摘要（60字內，說明本次會議的核心結論）",
  "outline": [
    {
      "level": 1,
      "content": "主要議題",
      "children": [
        { "level": 2, "content": "子項目", "children": [] }
      ]
    }
  ],
  "keyPoints": [
    "重要決策或結論1",
    "重要決策或結論2"
  ],
  "actionItems": [
    {
      "assignee": "負責人姓名（若未提及填空字串）",
      "task": "具體任務描述",
      "deadline": "截止日期（若未提及填空字串）"
    }
  ]
}

逐字稿內容：
${transcript}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonText = content.text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(jsonText) as SummaryResult;
}
