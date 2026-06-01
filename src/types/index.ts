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

export interface Settings {
  claudeApiKey: string;
  whisperModel: "tiny" | "base" | "small" | "medium";
  outputLanguage: string;
}
