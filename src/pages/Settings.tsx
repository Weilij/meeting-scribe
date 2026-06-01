import { useState } from "react";
import { Eye, EyeOff, CheckCircle, ExternalLink } from "lucide-react";
import { useSettings } from "../store/settingsStore";
import type { AIProvider } from "../types";

const PROVIDERS: {
  id: AIProvider; name: string; emoji: string; desc: string;
  keyLabel: string; keyPlaceholder: string; docsUrl: string;
  models: string[]; needsKey: boolean;
}[] = [
  { id: "claude", name: "Claude", emoji: "🟣", desc: "Anthropic",
    keyLabel: "Claude API Key", keyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com",
    models: ["claude-sonnet-4-6","claude-opus-4-8","claude-haiku-4-5-20251001"], needsKey: true },
  { id: "openai", name: "GPT", emoji: "🟢", desc: "OpenAI",
    keyLabel: "OpenAI API Key", keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o","gpt-4o-mini","gpt-4-turbo"], needsKey: true },
  { id: "gemini", name: "Gemini", emoji: "🔵", desc: "Google",
    keyLabel: "Gemini API Key", keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    models: ["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.0-flash-lite","gemini-1.5-flash"], needsKey: true },
  { id: "ollama", name: "Ollama", emoji: "⚫", desc: "本機免費",
    keyLabel: "", keyPlaceholder: "",
    docsUrl: "https://ollama.com",
    models: ["llama3","mistral","qwen2.5","gemma2"], needsKey: false },
];

const WHISPER_MODELS = [
  { value: "tiny",   label: "Tiny",   size: "75 MB",  desc: "最快，準確度普通" },
  { value: "base",   label: "Base",   size: "145 MB", desc: "推薦，速度與準確度平衡" },
  { value: "small",  label: "Small",  size: "460 MB", desc: "較準確，速度中等" },
  { value: "medium", label: "Medium", size: "1.5 GB", desc: "最準確，速度較慢" },
] as const;

const LANGUAGES = [
  { value: "zh-TW", label: "繁體中文" },
  { value: "zh-CN", label: "簡體中文" },
  { value: "en",    label: "English" },
];

/* ── Shared styles ── */
const card: React.CSSProperties = {
  background: "#fff", borderRadius: 20,
  boxShadow: "0 1px 4px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
  padding: "20px 22px", marginBottom: 14,
};
const label: React.CSSProperties = {
  fontSize: 13, fontWeight: 500, color: "#3C3C43", display: "block", marginBottom: 8,
};
const input: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 10, outline: "none",
  border: "1px solid rgba(60,60,67,0.12)", background: "#F2F2F7",
  fontFamily: "inherit", fontSize: 14, color: "#1C1C1E",
  transition: "border 0.15s",
};

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const active = PROVIDERS.find((p) => p.id === settings.aiProvider)!;

  const getKey = (id: AIProvider) => id === "claude" ? settings.claudeApiKey : id === "openai" ? settings.openaiApiKey : id === "gemini" ? settings.geminiApiKey : "";
  const setKey = (id: AIProvider, v: string) => { if (id==="claude") updateSettings({claudeApiKey:v}); else if (id==="openai") updateSettings({openaiApiKey:v}); else if (id==="gemini") updateSettings({geminiApiKey:v}); };
  const getModel = (id: AIProvider) => id==="claude"?settings.claudeModel:id==="openai"?settings.openaiModel:id==="gemini"?settings.geminiModel:settings.ollamaModel;
  const setModel = (id: AIProvider, v: string) => { if(id==="claude")updateSettings({claudeModel:v}); else if(id==="openai")updateSettings({openaiModel:v}); else if(id==="gemini")updateSettings({geminiModel:v}); else updateSettings({ollamaModel:v}); };

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "40px 32px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: "#1C1C1E" }}>設定</h1>
        <p style={{ fontSize: 14, color: "#8E8E93", marginTop: 4 }}>管理 AI Provider 與應用程式偏好</p>
      </div>

      {/* AI Provider */}
      <div style={card}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 14 }}>
          AI Provider
        </p>

        {/* Provider grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {PROVIDERS.map((p) => (
            <button key={p.id} onClick={() => updateSettings({ aiProvider: p.id })} style={{
              padding: "12px 8px", borderRadius: 12, border: "2px solid",
              borderColor: settings.aiProvider === p.id ? "#007AFF" : "rgba(60,60,67,0.12)",
              background: settings.aiProvider === p.id ? "rgba(0,122,255,0.06)" : "#F9F9FB",
              cursor: "pointer", fontFamily: "inherit", textAlign: "center",
              transition: "all 0.15s",
            }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{p.emoji}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: settings.aiProvider===p.id?"#007AFF":"#3C3C43" }}>{p.name}</div>
              <div style={{ fontSize: 10, color: "#8E8E93", marginTop: 1 }}>{p.desc}</div>
            </button>
          ))}
        </div>

        {/* Key input */}
        {active.needsKey ? (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={label as React.CSSProperties}>{active.keyLabel}</span>
              <a href={active.docsUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: "#007AFF", textDecoration: "none", display: "flex", alignItems: "center", gap: 3 }}>
                取得 Key <ExternalLink size={11} />
              </a>
            </div>
            <div style={{ position: "relative" }}>
              <input
                type={showKey ? "text" : "password"}
                value={getKey(active.id)}
                onChange={(e) => setKey(active.id, e.target.value)}
                placeholder={active.keyPlaceholder}
                style={{ ...input, paddingRight: 40, fontFamily: "monospace" }}
              />
              <button onClick={() => setShowKey(!showKey)} style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "#8E8E93", padding: 0,
              }}>
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {getKey(active.id) && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, color: "#34C759", fontSize: 12 }}>
                <CheckCircle size={12} /> 已設定
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <span style={label as React.CSSProperties}>Ollama Server URL</span>
            <input type="text" value={settings.ollamaBaseUrl}
              onChange={(e) => updateSettings({ ollamaBaseUrl: e.target.value })}
              placeholder="http://localhost:11434" style={{ ...input, fontFamily: "monospace" }} />
          </div>
        )}

        {/* Model */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={label as React.CSSProperties}>模型</span>
            {active.id !== "ollama" && (
              <span style={{ fontSize: 11, color: "#8E8E93" }}>可直接輸入自訂模型名稱</span>
            )}
          </div>
          {active.id === "ollama" ? (
            <input type="text" value={getModel(active.id)}
              onChange={(e) => setModel(active.id, e.target.value)}
              placeholder="llama3" style={input} />
          ) : (
            <>
              <input type="text" value={getModel(active.id)}
                onChange={(e) => setModel(active.id, e.target.value)}
                placeholder={active.models[0]} style={{ ...input, marginBottom: 8 }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {active.models.map((m) => (
                  <button key={m} onClick={() => setModel(active.id, m)} style={{
                    padding: "4px 10px", borderRadius: 8, border: "1px solid",
                    borderColor: getModel(active.id)===m ? "#007AFF" : "rgba(60,60,67,0.12)",
                    background: getModel(active.id)===m ? "rgba(0,122,255,0.08)" : "transparent",
                    color: getModel(active.id)===m ? "#007AFF" : "#8E8E93",
                    fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                  }}>{m}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Whisper */}
      <div style={card}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 14 }}>
          Whisper 語音模型
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {WHISPER_MODELS.map((m) => (
            <label key={m.value} onClick={() => updateSettings({ whisperModel: m.value })}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                borderRadius: 12, border: "1px solid",
                borderColor: settings.whisperModel===m.value ? "#007AFF" : "rgba(60,60,67,0.1)",
                background: settings.whisperModel===m.value ? "rgba(0,122,255,0.05)" : "#F9F9FB",
                cursor: "pointer",
              }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", border: "2px solid",
                borderColor: settings.whisperModel===m.value ? "#007AFF" : "#C7C7CC",
                background: settings.whisperModel===m.value ? "#007AFF" : "transparent",
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {settings.whisperModel===m.value && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#1C1C1E" }}>
                  {m.label} <span style={{ fontSize: 12, color: "#8E8E93", fontWeight: 400 }}>· {m.size}</span>
                </div>
                <div style={{ fontSize: 12, color: "#8E8E93", marginTop: 1 }}>{m.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Language */}
      <div style={card}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 14 }}>
          輸出語言
        </p>
        <select value={settings.outputLanguage}
          onChange={(e) => updateSettings({ outputLanguage: e.target.value })}
          style={{ ...input, cursor: "pointer" }}>
          {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
      </div>

      {/* Save */}
      <button onClick={handleSave} style={{
        width: "100%", padding: "14px", borderRadius: 14, border: "none",
        cursor: "pointer", fontFamily: "inherit", fontSize: 16, fontWeight: 600,
        background: saved ? "#34C759" : "#007AFF", color: "#fff",
        boxShadow: saved ? "0 4px 16px rgba(52,199,89,0.35)" : "0 4px 16px rgba(0,122,255,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "background 0.2s, box-shadow 0.2s",
      }}>
        {saved ? <><CheckCircle size={18} /> 已儲存</> : "儲存設定"}
      </button>
    </div>
  );
}
