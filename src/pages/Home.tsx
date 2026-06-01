import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, FileAudio, Loader2, AlertCircle, ClipboardPaste, Download } from "lucide-react";
import { useSettings } from "../store/settingsStore";
import { summarizeTranscript } from "../services/ai";

// Tauri APIs — only available inside the Tauri runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tauriInvoke: ((cmd: string, args?: any) => Promise<unknown>) | null = null;
let tauriListen: ((event: string, cb: (e: { payload: unknown }) => void) => Promise<() => void>) | null = null;
let tauriOpen: ((opts: object) => Promise<string | null>) | null = null;

if (typeof window !== "undefined" && "__TAURI__" in window) {
  import("@tauri-apps/api/core").then((m) => { tauriInvoke = m.invoke; });
  import("@tauri-apps/api/event").then((m) => { tauriListen = m.listen; });
  import("@tauri-apps/plugin-dialog").then((m) => { tauriOpen = m.open; });
}

type Mode = "upload" | "paste";
type Status = "idle" | "downloading" | "transcribing" | "summarizing" | "error";

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude", openai: "OpenAI GPT", gemini: "Gemini", ollama: "Ollama（本機）",
};

function hasApiKey(settings: ReturnType<typeof useSettings>["settings"]): boolean {
  const { aiProvider, claudeApiKey, openaiApiKey, geminiApiKey } = settings;
  if (aiProvider === "ollama") return true;
  if (aiProvider === "claude") return !!claudeApiKey;
  if (aiProvider === "openai") return !!openaiApiKey;
  if (aiProvider === "gemini") return !!geminiApiKey;
  return false;
}

const MODEL_SIZES: Record<string, string> = {
  tiny: "75 MB", base: "145 MB", small: "460 MB", medium: "1.5 GB",
};

export default function Home() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("upload");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);

  // Listen for Whisper model download progress
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    if (tauriListen) {
      tauriListen("whisper-download-progress", (e) => {
        setDownloadPct(e.payload as number);
      }).then((fn) => { unlisten = fn; });
    }
    return () => { unlisten?.(); };
  }, []);

  const handleSelectFile = async () => {
    if (tauriOpen) {
      const path = await tauriOpen({
        multiple: false,
        filters: [{ name: "音訊/影片", extensions: ["mp3", "m4a", "wav", "mp4", "webm", "ogg", "flac"] }],
      });
      if (path) {
        setSelectedFilePath(path);
        setSelectedFileName(path.split("/").pop() ?? path);
        setErrorMsg("");
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFileName(file.name);
      setErrorMsg("");
    }
  };

  const handleProcess = async () => {
    if (!hasApiKey(settings)) {
      setErrorMsg(`請先到「設定」填入 ${PROVIDER_LABELS[settings.aiProvider]} API Key`);
      return;
    }

    let finalTranscript = transcript;

    if (mode === "upload") {
      if (!selectedFilePath && !tauriInvoke) {
        setErrorMsg("請選擇音訊檔案");
        return;
      }
      if (!selectedFilePath) {
        setErrorMsg("請在 Tauri App 中選擇音訊檔案");
        return;
      }

      try {
        // Check if Whisper model is downloaded
        const isDownloaded = await tauriInvoke!("is_model_downloaded", {
          model: settings.whisperModel,
        }) as boolean;

        if (!isDownloaded) {
          setStatus("downloading");
          setDownloadPct(0);
          await tauriInvoke!("download_whisper_model", { model: settings.whisperModel });
        }

        setStatus("transcribing");
        finalTranscript = await tauriInvoke!("transcribe_audio", {
          filePath: selectedFilePath,
          model: settings.whisperModel,
          language: settings.outputLanguage,
        }) as string;
      } catch (err) {
        setStatus("error");
        setErrorMsg(`語音轉文字失敗：${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }

    if (!finalTranscript.trim()) {
      setErrorMsg("請輸入逐字稿內容");
      setStatus("idle");
      return;
    }

    try {
      setStatus("summarizing");
      setErrorMsg("");
      const summary = await summarizeTranscript(finalTranscript, settings);
      navigate("/summary", {
        state: {
          summary,
          transcript: finalTranscript,
          date: new Date().toLocaleDateString("zh-TW"),
        },
      });
    } catch (err) {
      setStatus("error");
      setErrorMsg(`AI 整理失敗：${err instanceof Error ? err.message : "未知錯誤"}`);
    } finally {
      setStatus((s) => (s === "summarizing" || s === "error" ? "idle" : s));
    }
  };

  const isLoading = status !== "idle" && status !== "error";

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
      {!hasApiKey(settings) && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm">
            尚未設定 {PROVIDER_LABELS[settings.aiProvider]} API Key，請先前往{" "}
            <button onClick={() => navigate("/settings")} className="font-medium underline">
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
              mode === m ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m === "upload" ? <FileAudio size={15} /> : <ClipboardPaste size={15} />}
            {m === "upload" ? "上傳音訊" : "貼上逐字稿"}
          </button>
        ))}
      </div>

      {/* Upload Mode */}
      {mode === "upload" && (
        <>
          <div
            onClick={handleSelectFile}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-indigo-400 bg-indigo-50"
                : selectedFilePath
                ? "border-green-400 bg-green-50"
                : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setSelectedFileName(f.name); setErrorMsg(""); }
              }}
            />
            <Mic size={36} className={`mx-auto mb-3 ${selectedFilePath ? "text-green-500" : "text-slate-300"}`} />
            {selectedFileName ? (
              <>
                <p className="font-medium text-slate-700">{selectedFileName}</p>
                <p className="text-slate-400 text-sm mt-1">點擊更換檔案</p>
              </>
            ) : (
              <>
                <p className="font-medium text-slate-600">點擊選擇音訊檔案</p>
                <p className="text-slate-400 text-sm mt-1">支援 MP3、M4A、WAV、MP4、OGG、FLAC</p>
              </>
            )}
          </div>

          {/* Whisper model info */}
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 px-1">
            <Download size={12} />
            <span>
              語音轉文字使用本地 Whisper（{settings.whisperModel} · {MODEL_SIZES[settings.whisperModel]}），首次使用自動下載
            </span>
          </div>

          {/* Download progress */}
          {status === "downloading" && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center justify-between mb-2 text-sm font-medium text-blue-700">
                <span>下載 Whisper {settings.whisperModel} 模型...</span>
                <span>{downloadPct}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${downloadPct}%` }}
                />
              </div>
              <p className="text-xs text-blue-500 mt-1.5">
                {MODEL_SIZES[settings.whisperModel]}，只需下載一次
              </p>
            </div>
          )}
        </>
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
            {status === "downloading" && "下載 Whisper 模型中..."}
            {status === "transcribing" && "語音轉文字中..."}
            {status === "summarizing" && "AI 整理中..."}
          </>
        ) : (
          "整理重點"
        )}
      </button>
    </div>
  );
}
