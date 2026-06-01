import { useState, useEffect } from "react";
import type { Settings } from "../types";

const STORAGE_KEY = "meeting-scribe-settings";

const defaultSettings: Settings = {
  claudeApiKey: "",
  whisperModel: "base",
  outputLanguage: "zh-TW",
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  function updateSettings(updates: Partial<Settings>) {
    setSettings((prev) => ({ ...prev, ...updates }));
  }

  return { settings, updateSettings };
}
