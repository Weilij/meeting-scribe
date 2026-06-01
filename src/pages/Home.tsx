import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileAudio, Loader2, AlertCircle, ClipboardPaste,
  Download, Mic, MicOff, Square,
} from "lucide-react";
import { useSettings } from "../store/settingsStore";
import { summarizeTranscript } from "../services/ai";
import { AudioRecorder } from "../services/recorder";

// Tauri APIs — only available inside Tauri runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tauriInvoke: ((cmd: string, args?: any) => Promise<unknown>) | null = null;
let tauriListen: ((event: string, cb: (e: { payload: unknown }) => void) => Promise<() => void>) | null = null;
let tauriOpen: ((opts: object) => Promise<string | null>) | null = null;
let writeFsFile: ((path: string, data: Uint8Array) => Promise<void>) | null = null;
let pathTempDir: (() => Promise<string>) | null = null;
let pathJoin: ((...parts: string[]) => Promise<string>) | null = null;

if (typeof window !== "undefined" && "__TAURI__" in window) {
  import("@tauri-apps/api/core").then((m) => { tauriInvoke = m.invoke; });
  import("@tauri-apps/api/event").then((m) => { tauriListen = m.listen; });
  import("@tauri-apps/plugin-dialog").then((m) => { tauriOpen = m.open; });
  import("@tauri-apps/plugin-fs").then((m) => { writeFsFile = m.writeFile as typeof writeFsFile; });
  import("@tauri-apps/api/path").then((m) => {
    pathTempDir = m.tempDir;
    pathJoin = m.join;
  });
}

type Mode = "upload" | "paste" | "record";
type Status = "idle" | "downloading" | "transcribing" | "summarizing" | "error";

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude", openai: "OpenAI GPT", gemini: "Gemini", ollama: "Ollama（本機）",
};

const MODEL_SIZES: Record<string, string> = {
  tiny: "75 MB", base: "145 MB", small: "460 MB", medium: "1.5 GB",
};

function hasApiKey(settings: ReturnType<typeof useSettings>["settings"]): boolean {
  const { aiProvider, claudeApiKey, openaiApiKey, geminiApiKey } = settings;
  if (aiProvider === "ollama") return true;
  if (aiProvider === "claude") return !!claudeApiKey;
  if (aiProvider === "openai") return !!openaiApiKey;
  if (aiProvider === "gemini") return !!geminiApiKey;
  return false;
}

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Animated waveform bars
function Waveform({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const BAR_COUNT = 32;
  const [bars, setBars] = useState<number[]>(new Array(BAR_COUNT).fill(0.05));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active || !analyser) {
      setBars(new Array(BAR_COUNT).fill(0.05));
      return;
    }
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      setBars(
        Array.from({ length: BAR_COUNT }, (_, i) => {
          const idx = Math.floor((i * data.length) / BAR_COUNT);
          return Math.max(0.05, data[idx] / 255);
        })
      );
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, analyser]);

  return (
    <div className="flex items-center justify-center gap-0.5 h-16 px-4">
      {bars.map((h, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full transition-all duration-75 ${active ? "bg-red-400" : "bg-slate-200"}`}
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("upload");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingDone, setRecordingDone] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Download progress listener
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    if (tauriListen) {
      tauriListen("whisper-download-progress", (e) => {
        setDownloadPct(e.payload as number);
      }).then((fn) => { unlisten = fn; });
    }
    return () => { unlisten?.(); };
  }, []);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleSelectFile = async () => {
    if (tauriOpen) {
      const path = await tauriOpen({
        multiple: false,
        filters: [{ name: "音訊/影片", extensions: ["mp3", "m4a", "wav", "mp4", "webm", "ogg", "flac"] }],
      });
      if (path) {
        setSelectedFilePath(path);
        setSelectedFileName((path as string).split("/").pop() ?? (path as string));
        setErrorMsg("");
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleStartRecording = async () => {
    setErrorMsg("");
    setRecordingDone(false);
    setSelectedFilePath(null);
    setSelectedFileName("");
    try {
      const rec = new AudioRecorder();
      const analyser = await rec.start();
      recorderRef.current = rec;
      setAnalyserNode(analyser);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      setErrorMsg("無法存取麥克風，請確認權限設定");
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current) return;
    clearInterval(timerRef.current!);
    setIsRecording(false);
    setAnalyserNode(null);

    const wavBuffer = recorderRef.current.stop();

    try {
      if (pathTempDir && pathJoin && writeFsFile) {
        const tmp = await pathTempDir();
        const filePath = await pathJoin(tmp, `meeting-scribe-${Date.now()}.wav`);
        await writeFsFile(filePath, new Uint8Array(wavBuffer));
        setSelectedFilePath(filePath);
      }
      setSelectedFileName(`錄音 ${formatTime(recordingTime)}`);
      setRecordingDone(true);
    } catch (err) {
      setErrorMsg(`儲存錄音失敗：${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCancelRecording = () => {
    recorderRef.current?.cancel();
    clearInterval(timerRef.current!);
    setIsRecording(false);
    setAnalyserNode(null);
    setRecordingTime(0);
    setRecordingDone(false);
    setSelectedFilePath(null);
  };

  const handleProcess = async () => {
    if (!hasApiKey(settings)) {
      setErrorMsg(`請先到「設定」填入 ${PROVIDER_LABELS[settings.aiProvider]} API Key`);
      return;
    }

    let finalTranscript = transcript;

    if (mode === "upload" || mode === "record") {
      if (!selectedFilePath) {
        setErrorMsg(mode === "record" ? "請先錄音" : "請選擇音訊檔案");
        return;
      }
      try {
        const isDownloaded = await tauriInvoke!("is_model_downloaded", { model: settings.whisperModel }) as boolean;
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
        state: { summary, transcript: finalTranscript, date: new Date().toLocaleDateString("zh-TW") },
      });
    } catch (err) {
      setStatus("error");
      setErrorMsg(`AI 整理失敗：${err instanceof Error ? err.message : "未知錯誤"}`);
    } finally {
      setStatus((s) => (["summarizing", "error"].includes(s) ? "idle" : s));
    }
  };

  const isLoading = !["idle", "error"].includes(status);
  const tabs: { id: Mode; label: string; icon: React.ReactNode }[] = [
    { id: "upload", label: "上傳音訊", icon: <FileAudio size={15} /> },
    { id: "paste", label: "貼上逐字稿", icon: <ClipboardPaste size={15} /> },
    { id: "record", label: "錄音", icon: <Mic size={15} /> },
  ];

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">會議記錄</h1>
        <p className="text-slate-500 mt-1">
          由{" "}
          <span className="text-indigo-600 font-medium">{PROVIDER_LABELS[settings.aiProvider]}</span>{" "}
          自動整理大綱重點
        </p>
      </div>

      {!hasApiKey(settings) && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="text-sm">
            尚未設定 {PROVIDER_LABELS[settings.aiProvider]} API Key，請先前往{" "}
            <button onClick={() => navigate("/settings")} className="font-medium underline">設定頁面</button>。
          </p>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 w-fit">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => { setMode(id); setErrorMsg(""); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {icon}{label}
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
            onDrop={(e) => {
              e.preventDefault(); setIsDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) { setSelectedFileName(f.name); setErrorMsg(""); }
            }}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
              isDragging ? "border-indigo-400 bg-indigo-50"
              : selectedFilePath ? "border-green-400 bg-green-50"
              : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
            }`}
          >
            <input ref={fileInputRef} type="file" accept="audio/*,video/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelectedFileName(f.name); setErrorMsg(""); }}} />
            <FileAudio size={36} className={`mx-auto mb-3 ${selectedFilePath ? "text-green-500" : "text-slate-300"}`} />
            {selectedFileName ? (
              <><p className="font-medium text-slate-700">{selectedFileName}</p>
              <p className="text-slate-400 text-sm mt-1">點擊更換</p></>
            ) : (
              <><p className="font-medium text-slate-600">點擊選擇或拖拉音訊檔案</p>
              <p className="text-slate-400 text-sm mt-1">支援 MP3、M4A、WAV、MP4、OGG、FLAC</p></>
            )}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-400 px-1">
            <Download size={12} />
            <span>本地 Whisper（{settings.whisperModel} · {MODEL_SIZES[settings.whisperModel]}），首次使用自動下載</span>
          </div>
        </>
      )}

      {/* Paste Mode */}
      {mode === "paste" && (
        <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)}
          placeholder="將會議逐字稿貼到這裡..."
          className="w-full h-64 p-4 border border-slate-200 rounded-2xl text-sm text-slate-700 placeholder-slate-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
      )}

      {/* Record Mode */}
      {mode === "record" && (
        <div className="border-2 border-slate-200 rounded-2xl p-8 text-center">
          {/* Waveform */}
          <Waveform analyser={analyserNode} active={isRecording} />

          {/* Timer */}
          <div className={`text-3xl font-mono font-semibold mb-6 tracking-widest ${isRecording ? "text-red-500" : "text-slate-300"}`}>
            {formatTime(recordingTime)}
          </div>

          {!isRecording && !recordingDone && (
            <button onClick={handleStartRecording}
              className="flex items-center gap-2 mx-auto px-8 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors">
              <Mic size={18} /> 開始錄音
            </button>
          )}

          {isRecording && (
            <div className="flex items-center justify-center gap-3">
              <button onClick={handleStopRecording}
                className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl transition-colors">
                <Square size={16} fill="white" /> 停止錄音
              </button>
              <button onClick={handleCancelRecording}
                className="flex items-center gap-2 px-4 py-3 border border-slate-200 text-slate-500 hover:text-slate-700 font-medium rounded-xl transition-colors">
                <MicOff size={16} /> 取消
              </button>
            </div>
          )}

          {recordingDone && !isRecording && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                <Mic size={16} />
                <span>{selectedFileName} 已就緒</span>
              </div>
              <button onClick={handleCancelRecording}
                className="text-sm text-slate-400 hover:text-slate-600 underline">
                重新錄音
              </button>
            </div>
          )}

          <p className="text-slate-400 text-xs mt-6">錄音完成後點擊「整理重點」進行語音轉文字</p>
        </div>
      )}

      {/* Download progress */}
      {status === "downloading" && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center justify-between mb-2 text-sm font-medium text-blue-700">
            <span>下載 Whisper {settings.whisperModel} 模型...</span>
            <span>{downloadPct}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${downloadPct}%` }} />
          </div>
          <p className="text-xs text-blue-500 mt-1.5">{MODEL_SIZES[settings.whisperModel]}，只需下載一次</p>
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />{errorMsg}
        </div>
      )}

      <button onClick={handleProcess} disabled={isLoading}
        className="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
        {isLoading ? (
          <><Loader2 size={18} className="animate-spin" />
            {status === "downloading" && "下載 Whisper 模型中..."}
            {status === "transcribing" && "語音轉文字中..."}
            {status === "summarizing" && "AI 整理中..."}</>
        ) : "整理重點"}
      </button>
    </div>
  );
}
