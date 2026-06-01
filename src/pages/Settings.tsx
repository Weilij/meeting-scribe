import { useState } from "react";
import { Eye, EyeOff, CheckCircle, Key, Cpu, Languages } from "lucide-react";
import { useSettings } from "../store/settingsStore";

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
  const [apiKeyInput, setApiKeyInput] = useState(settings.claudeApiKey);

  const handleSave = () => {
    updateSettings({ claudeApiKey: apiKeyInput });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">設定</h1>
        <p className="text-slate-500 mt-1">管理 API 金鑰與應用程式偏好設定</p>
      </div>

      {/* Claude API Key */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Key size={18} className="text-indigo-500" />
          <h2 className="font-semibold text-slate-700">Claude API Key</h2>
        </div>
        <p className="text-slate-500 text-sm mb-4">
          前往{" "}
          <span className="text-indigo-600 font-medium">console.anthropic.com</span>{" "}
          取得您的 API Key，金鑰僅儲存於本機。
        </p>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full pr-10 pl-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {settings.claudeApiKey && (
          <p className="mt-2 text-xs text-green-600 flex items-center gap-1">
            <CheckCircle size={12} /> 已設定 API Key
          </p>
        )}
      </section>

      {/* Whisper Model */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Cpu size={18} className="text-indigo-500" />
          <h2 className="font-semibold text-slate-700">Whisper 模型</h2>
          <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            即將推出
          </span>
        </div>
        <p className="text-slate-500 text-sm mb-4">
          語音轉文字模型，首次使用需自動下載。
        </p>
        <div className="space-y-2 opacity-60 pointer-events-none">
          {WHISPER_MODELS.map((model) => (
            <label
              key={model.value}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                settings.whisperModel === model.value
                  ? "border-indigo-300 bg-indigo-50"
                  : "border-slate-200 hover:border-slate-300"
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

      {/* Language */}
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
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </section>

      {/* Save Button */}
      <button
        onClick={handleSave}
        className={`w-full py-3 font-medium rounded-xl transition-all flex items-center justify-center gap-2 ${
          saved
            ? "bg-green-500 text-white"
            : "bg-indigo-600 hover:bg-indigo-700 text-white"
        }`}
      >
        {saved ? (
          <>
            <CheckCircle size={18} /> 已儲存
          </>
        ) : (
          "儲存設定"
        )}
      </button>
    </div>
  );
}
