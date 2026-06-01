import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileAudio, Loader2, AlertCircle, ClipboardPaste } from "lucide-react";
import { useSettings } from "../store/settingsStore";
import { summarizeTranscript } from "../services/ai";

type Mode = "upload" | "paste";
type Status = "idle" | "transcribing" | "summarizing" | "error";

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude",
  openai: "OpenAI GPT",
  gemini: "Gemini",
  ollama: "Ollama（本機）",
};

function hasApiKey(settings: ReturnType<typeof useSettings>["settings"]): boolean {
  const { aiProvider, claudeApiKey, openaiApiKey, geminiApiKey } = settings;
  if (aiProvider === "ollama") return true;
  if (aiProvider === "claude") return !!claudeApiKey;
  if (aiProvider === "openai") return !!openaiApiKey;
  if (aiProvider === "gemini") return !!geminiApiKey;
  return false;
}

export default function Home() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    setErrorMsg("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleProcess = async () => {
    if (!hasApiKey(settings)) {
      setErrorMsg(`請先到「設定」填入 ${PROVIDER_LABELS[settings.aiProvider]} API Key`);
      return;
    }

    if (mode === "upload") {
      if (!selectedFile) { setErrorMsg("請選擇音訊檔案"); return; }
      setStatus("transcribing");
      setStatus("idle");
      setErrorMsg("Whisper 本地轉文字功能即將推出，請暫時使用「貼上逐字稿」模式。");
      return;
    }

    if (!transcript.trim()) { setErrorMsg("請輸入逐字稿內容"); return; }

    try {
      setStatus("summarizing");
      setErrorMsg("");
      const summary = await summarizeTranscript(transcript, settings);
      navigate("/summary", {
        state: {
          summary,
          transcript,
          date: new Date().toLocaleDateString("zh-TW"),
        },
      });
    } catch (err) {
      setStatus("error");
      setErrorMsg(`整理失敗：${err instanceof Error ? err.message : "未知錯誤"}`);
    } finally {
      setStatus((s) => (s === "summarizing" ? "idle" : s));
    }
  };

  const isLoading = status === "transcribing" || status === "summarizing";
  const apiKeyMissing = !hasApiKey(settings);

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">會議記錄</h1>
        <p className="text-slate-500 mt-1">
          上傳錄音或貼上逐字稿，由{" "}
          <span className="text-indigo-600 font-medium">
            {PROVIDER_LABELS[settings.aiProvider]}
          </span>{" "}
          自動整理大綱重點
        </p>
      </div>

      {/* No API key warning */}
      {apiKeyMissing && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm">
            尚未設定 {PROVIDER_LABELS[settings.aiProvider]} API Key，請先前往{" "}
            <button
              onClick={() => navigate("/settings")}
              className="font-medium underline"
            >
              設定頁面
            </button>
            。
          </p>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 w-fit">
        {(["upload", "paste"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === m
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m === "upload" ? <FileAudio size={15} /> : <ClipboardPaste size={15} />}
            {m === "upload" ? "上傳音訊" : "貼上逐字稿"}
          </button>
        ))}
      </div>

      {/* Upload Mode */}
      {mode === "upload" && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-indigo-400 bg-indigo-50"
              : selectedFile
              ? "border-green-400 bg-green-50"
              : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*,.mp3,.m4a,.wav,.mp4,.webm"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
          />
          <Upload size={36} className={`mx-auto mb-3 ${selectedFile ? "text-green-500" : "text-slate-300"}`} />
          {selectedFile ? (
            <>
              <p className="font-medium text-slate-700">{selectedFile.name}</p>
              <p className="text-slate-400 text-sm mt-1">
                {(selectedFile.size / 1024 / 1024).toFixed(1)} MB · 點擊更換
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-slate-600">拖拉音訊檔案到此處</p>
              <p className="text-slate-400 text-sm mt-1">或點擊選擇 · 支援 MP3、M4A、WAV、MP4</p>
            </>
          )}
        </div>
      )}

      {/* Paste Mode */}
      {mode === "paste" && (
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="將會議逐字稿貼到這裡..."
          className="w-full h-64 p-4 border border-slate-200 rounded-2xl text-sm text-slate-700 placeholder-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
      )}

      {errorMsg && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {errorMsg}
        </div>
      )}

      <button
        onClick={handleProcess}
        disabled={isLoading}
        className="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {status === "transcribing" ? "語音轉文字中..." : "AI 整理中..."}
          </>
        ) : (
          "整理重點"
        )}
      </button>
    </div>
  );
}
