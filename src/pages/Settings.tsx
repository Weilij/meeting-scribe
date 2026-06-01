import { useState } from "react";
import { Eye, EyeOff, CheckCircle, Key, Cpu, Languages, ExternalLink } from "lucide-react";
import { useSettings } from "../store/settingsStore";
import type { AIProvider } from "../types";

const PROVIDERS: {
  id: AIProvider;
  name: string;
  desc: string;
  keyLabel: string;
  keyPlaceholder: string;
  docsUrl: string;
  models: string[];
  needsKey: boolean;
}[] = [
  {
    id: "claude",
    name: "Claude",
    desc: "Anthropic",
    keyLabel: "Claude API Key",
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com",
    models: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
    needsKey: true,
  },
  {
    id: "openai",
    name: "GPT",
    desc: "OpenAI",
    keyLabel: "OpenAI API Key",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    needsKey: true,
  },
  {
    id: "gemini",
    name: "Gemini",
    desc: "Google",
    keyLabel: "Gemini API Key",
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    needsKey: true,
  },
  {
    id: "ollama",
    name: "Ollama",
    desc: "本機免費",
    keyLabel: "",
    keyPlaceholder: "",
    docsUrl: "https://ollama.com",
    models: ["llama3", "mistral", "qwen2.5", "gemma2"],
    needsKey: false,
  },
];

const PROVIDER_COLORS: Record<AIProvider, string> = {
  claude: "bg-violet-100 text-violet-700 border-violet-300",
  openai: "bg-emerald-100 text-emerald-700 border-emerald-300",
  gemini: "bg-blue-100 text-blue-700 border-blue-300",
  ollama: "bg-slate-100 text-slate-700 border-slate-300",
};

const WHISPER_MODELS = [
  { value: "tiny", label: "Tiny", desc: "75 MB · 最快，準確度普通" },
  { value: "base", label: "Base", desc: "145 MB · 推薦，速度與準確度平衡" },
  { value: "small", label: "Small", desc: "460 MB · 較準確，速度中等" },
  { value: "medium", label: "Medium", desc: "1.5 GB · 最準確，速度較慢" },
] as const;

const LANGUAGES = [
  { value: "zh-TW", label: "繁體中文" },
  { value: "zh-CN", label: "簡體中文" },
  { value: "en", label: "English" },
];

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeProvider = PROVIDERS.find((p) => p.id === settings.aiProvider)!;

  const getApiKey = (id: AIProvider) => {
    if (id === "claude") return settings.claudeApiKey;
    if (id === "openai") return settings.openaiApiKey;
    if (id === "gemini") return settings.geminiApiKey;
    return "";
  };

  const setApiKey = (id: AIProvider, value: string) => {
    if (id === "claude") updateSettings({ claudeApiKey: value });
    else if (id === "openai") updateSettings({ openaiApiKey: value });
    else if (id === "gemini") updateSettings({ geminiApiKey: value });
  };

  const getModel = (id: AIProvider) => {
    if (id === "claude") return settings.claudeModel;
    if (id === "openai") return settings.openaiModel;
    if (id === "gemini") return settings.geminiModel;
    if (id === "ollama") return settings.ollamaModel;
    return "";
  };

  const setModel = (id: AIProvider, value: string) => {
    if (id === "claude") updateSettings({ claudeModel: value });
    else if (id === "openai") updateSettings({ openaiModel: value });
    else if (id === "gemini") updateSettings({ geminiModel: value });
    else if (id === "ollama") updateSettings({ ollamaModel: value });
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">設定</h1>
        <p className="text-slate-500 mt-1">選擇 AI Provider 並填入對應的 API Key</p>
      </div>

      {/* AI Provider Selection */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Key size={18} className="text-indigo-500" />
          <h2 className="font-semibold text-slate-700">AI Provider</h2>
        </div>

        {/* Provider Cards */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => updateSettings({ aiProvider: p.id })}
              className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-medium transition-all ${
                settings.aiProvider === p.id
                  ? `${PROVIDER_COLORS[p.id]} border-current`
                  : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              <span className="text-lg">
                {p.id === "claude" && "🟣"}
                {p.id === "openai" && "🟢"}
                {p.id === "gemini" && "🔵"}
                {p.id === "ollama" && "⚫"}
              </span>
              <span>{p.name}</span>
              <span className="text-xs opacity-70">{p.desc}</span>
            </button>
          ))}
        </div>

        {/* API Key */}
        {activeProvider.needsKey ? (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-600">
                {activeProvider.keyLabel}
              </label>
              <a
                href={activeProvider.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700"
              >
                取得 Key <ExternalLink size={11} />
              </a>
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={getApiKey(activeProvider.id)}
                onChange={(e) => setApiKey(activeProvider.id, e.target.value)}
                placeholder={activeProvider.keyPlaceholder}
                className="w-full pr-10 pl-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {getApiKey(activeProvider.id) && (
              <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                <CheckCircle size={11} /> 已設定
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4">
            <label className="text-sm font-medium text-slate-600 block mb-1.5">
              Ollama Server URL
            </label>
            <input
              type="text"
              value={settings.ollamaBaseUrl}
              onChange={(e) => updateSettings({ ollamaBaseUrl: e.target.value })}
              placeholder="http://localhost:11434"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
            />
          </div>
        )}

        {/* Model Selection */}
        <div>
          <label className="text-sm font-medium text-slate-600 block mb-1.5">模型</label>
          {activeProvider.id === "ollama" ? (
            <input
              type="text"
              value={getModel(activeProvider.id)}
              onChange={(e) => setModel(activeProvider.id, e.target.value)}
              placeholder="llama3"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          ) : (
            <select
              value={getModel(activeProvider.id)}
              onChange={(e) => setModel(activeProvider.id, e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
            >
              {activeProvider.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
        </div>
      </section>

      {/* Whisper Model */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Cpu size={18} className="text-indigo-500" />
          <h2 className="font-semibold text-slate-700">Whisper 語音模型</h2>
          <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            即將推出
          </span>
        </div>
        <p className="text-slate-500 text-sm mb-4">語音轉文字，首次使用自動下載。</p>
        <div className="space-y-2 opacity-60 pointer-events-none">
          {WHISPER_MODELS.map((model) => (
            <label
              key={model.value}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${
                settings.whisperModel === model.value
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="whisperModel"
                value={model.value}
                checked={settings.whisperModel === model.value}
                onChange={() => updateSettings({ whisperModel: model.value })}
                className="accent-indigo-600"
              />
              <div>
                <p className="text-sm font-medium text-slate-700">{model.label}</p>
                <p className="text-xs text-slate-400">{model.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Output Language */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Languages size={18} className="text-indigo-500" />
          <h2 className="font-semibold text-slate-700">輸出語言</h2>
        </div>
        <select
          value={settings.outputLanguage}
          onChange={(e) => updateSettings({ outputLanguage: e.target.value })}
          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>
      </section>

      <button
        onClick={handleSave}
        className={`w-full py-3 font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${
          saved
            ? "bg-green-500 text-white"
            : "bg-indigo-600 hover:bg-indigo-700 text-white"
        }`}
      >
        {saved ? <><CheckCircle size={18} /> 已儲存</> : "儲存設定"}
      </button>
    </div>
  );
}
