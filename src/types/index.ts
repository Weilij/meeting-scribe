export interface OutlineItem {
  level: number;
  content: string;
  children: OutlineItem[];
}

export interface ActionItem {
  assignee: string;
  task: string;
  deadline: string;
}

export interface SummaryResult {
  title: string;
  tldr: string;
  outline: OutlineItem[];
  keyPoints: string[];
  actionItems: ActionItem[];
}

export type AIProvider = "claude" | "openai" | "gemini" | "ollama";

export interface Settings {
  aiProvider: AIProvider;

  claudeApiKey: string;
  claudeModel: string;

  openaiApiKey: string;
  openaiModel: string;

  geminiApiKey: string;
  geminiModel: string;

  ollamaBaseUrl: string;
  ollamaModel: string;

  whisperModel: "tiny" | "base" | "small" | "medium";
  outputLanguage: string;
}
