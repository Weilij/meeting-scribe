export function buildPrompt(transcript: string, language: string): string {
  const langInstruction =
    language === "zh-TW"
      ? "請用繁體中文輸出所有內容。"
      : language === "zh-CN"
      ? "请用简体中文输出所有内容。"
      : "Please output all content in English.";

  return `你是專業的會議記錄整理助手。${langInstruction}

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
${transcript}`;
}

export function parseJSONResponse(text: string) {
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}
