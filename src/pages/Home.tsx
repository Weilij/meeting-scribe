import { useState, useEffect, useRef, CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { FileAudio, Loader2, AlertCircle, Download, Mic, MicOff, Square } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { tempDir, join as joinPath } from "@tauri-apps/api/path";
import { useSettings } from "../store/settingsStore";
import { summarizeTranscript } from "../services/ai";
import { AudioRecorder } from "../services/recorder";

type Mode = "upload" | "paste" | "record";
type Status = "idle" | "downloading" | "transcribing" | "summarizing" | "error";

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude", openai: "OpenAI GPT", gemini: "Gemini", ollama: "Ollama（本機）",
};
const MODEL_SIZES: Record<string, string> = {
  tiny: "75 MB", base: "145 MB", small: "460 MB", medium: "1.5 GB",
};

function hasApiKey(s: ReturnType<typeof useSettings>["settings"]): boolean {
  if (s.aiProvider === "ollama") return true;
  if (s.aiProvider === "claude") return !!s.claudeApiKey;
  if (s.aiProvider === "openai") return !!s.openaiApiKey;
  if (s.aiProvider === "gemini") return !!s.geminiApiKey;
  return false;
}

function formatTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
    : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

/* ── Waveform ── */
function Waveform({ analyser, active }: { analyser: AnalyserNode | null; active: boolean }) {
  const N = 36;
  const [bars, setBars] = useState<number[]>(new Array(N).fill(0.04));
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!active || !analyser) { setBars(new Array(N).fill(0.04)); return; }
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      setBars(Array.from({ length: N }, (_, i) => {
        const idx = Math.floor(i * data.length / N);
        return Math.max(0.04, data[idx] / 255);
      }));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [active, analyser]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 56 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 2,
          height: `${h * 100}%`,
          background: active ? "var(--red)" : "var(--label-4)",
          transition: "height 0.07s ease",
        }} />
      ))}
    </div>
  );
}

/* ── Apple button ── */
const btn = (
  bg: string, color = "#fff", extra: CSSProperties = {}
): CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  padding: "10px 20px", borderRadius: 12, border: "none", cursor: "pointer",
  fontFamily: "inherit", fontSize: 14, fontWeight: 500, color,
  background: bg, transition: "opacity 0.15s, transform 0.1s",
  ...extra,
});

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingDone, setRecordingDone] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [wavBuffer, setWavBuffer] = useState<ArrayBuffer | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<number>("whisper-download-progress", (e) => setDownloadPct(e.payload))
      .then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);
  useEffect(() => () => {
    recorderRef.current?.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handleSelectFile = async () => {
    const path = await openDialog({
      multiple: false,
      filters: [{ name: "音訊/影片", extensions: ["mp3","m4a","wav","mp4","webm","ogg","flac"] }],
    });
    if (path) {
      setSelectedFilePath(path as string);
      setSelectedFileName((path as string).split("/").pop() ?? path as string);
      setErrorMsg("");
    }
  };

  const handleStartRecording = async () => {
    setErrorMsg(""); setRecordingDone(false);
    setSelectedFilePath(null); setSelectedFileName(""); setWavBuffer(null);
    try {
      const rec = new AudioRecorder();
      const analyser = await rec.start();
      recorderRef.current = rec;
      setAnalyserNode(analyser); setIsRecording(true); setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      setErrorMsg("無法存取麥克風，請在系統設定 → 隱私權 → 麥克風中允許此 App");
    }
  };

  const handleStopRecording = () => {
    if (!recorderRef.current) return;
    clearInterval(timerRef.current!);
    setIsRecording(false); setAnalyserNode(null);
    const buf = recorderRef.current.stop();
    setWavBuffer(buf);
    setSelectedFileName(`錄音 ${formatTime(recordingTime)}`);
    setRecordingDone(true);
  };

  const handleCancelRecording = () => {
    recorderRef.current?.cancel();
    clearInterval(timerRef.current!);
    setIsRecording(false); setAnalyserNode(null);
    setRecordingTime(0); setRecordingDone(false);
    setSelectedFilePath(null); setWavBuffer(null);
  };

  const handleProcess = async () => {
    if (!hasApiKey(settings)) {
      setErrorMsg(`請先到「設定」填入 ${PROVIDER_LABELS[settings.aiProvider]} API Key`);
      return;
    }
    let finalTranscript = transcript;

    if (mode === "upload" || mode === "record") {
      let filePath = selectedFilePath;
      if (mode === "record") {
        if (!wavBuffer) { setErrorMsg("請先完成錄音"); return; }
        try {
          const tmp = await tempDir();
          filePath = await joinPath(tmp, `meeting-scribe-${Date.now()}.wav`);
          await writeFile(filePath, new Uint8Array(wavBuffer));
          setSelectedFilePath(filePath);
        } catch (err) {
          setErrorMsg(`儲存錄音失敗：${err instanceof Error ? err.message : String(err)}`);
          return;
        }
      }
      if (!filePath) { setErrorMsg("請選擇音訊檔案"); return; }
      try {
        const isDownloaded = await invoke<boolean>("is_model_downloaded", { model: settings.whisperModel });
        if (!isDownloaded) {
          setStatus("downloading"); setDownloadPct(0);
          await invoke("download_whisper_model", { model: settings.whisperModel });
        }
        setStatus("transcribing");
        finalTranscript = await invoke<string>("transcribe_audio", {
          filePath, model: settings.whisperModel, language: settings.outputLanguage,
        });
      } catch (err) {
        setStatus("error");
        setErrorMsg(`語音轉文字失敗：${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }

    if (!finalTranscript.trim()) { setErrorMsg("請輸入逐字稿內容"); setStatus("idle"); return; }

    try {
      setStatus("summarizing"); setErrorMsg("");
      const summary = await summarizeTranscript(finalTranscript, settings);
      navigate("/summary", {
        state: { summary, transcript: finalTranscript, date: new Date().toLocaleDateString("zh-TW") },
      });
    } catch (err) {
      setStatus("error");
      setErrorMsg(`AI 整理失敗：${err instanceof Error ? err.message : "未知錯誤"}`);
    } finally {
      setStatus((s) => (["summarizing","error"].includes(s) ? "idle" : s));
    }
  };

  const isLoading = !["idle","error"].includes(status);

  const tabs: { id: Mode; label: string }[] = [
    { id: "upload", label: "上傳音訊" },
    { id: "paste",  label: "貼上逐字稿" },
    { id: "record", label: "🎙 錄音" },
  ];

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 32px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, color: "var(--label)" }}>
          會議記錄
        </h1>
        <p style={{ fontSize: 14, color: "var(--label-3)", marginTop: 4 }}>
          由 <span style={{ color: "var(--blue)", fontWeight: 500 }}>{PROVIDER_LABELS[settings.aiProvider]}</span> 自動整理大綱重點
        </p>
      </div>

      {/* No API key */}
      {!hasApiKey(settings) && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "12px 16px", borderRadius: 12, marginBottom: 20,
          background: "rgba(255,149,0,0.1)", color: "#bf6a00",
        }}>
          <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 13 }}>
            尚未設定 {PROVIDER_LABELS[settings.aiProvider]} API Key，請前往{" "}
            <button onClick={() => navigate("/settings")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--blue)", fontWeight: 500, fontSize: 13, padding: 0 }}>
              設定頁面
            </button>。
          </p>
        </div>
      )}

      {/* Segmented control */}
      <div style={{
        display: "inline-flex", background: "rgba(118,118,128,0.12)",
        borderRadius: 10, padding: 3, marginBottom: 20,
      }}>
        {tabs.map(({ id, label }) => (
          <button key={id} onClick={() => { setMode(id); setErrorMsg(""); }}
            style={{
              padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: "inherit", fontSize: 13, fontWeight: mode === id ? 500 : 400,
              background: mode === id ? "#fff" : "transparent",
              color: mode === id ? "var(--label)" : "var(--label-2)",
              boxShadow: mode === id ? "var(--shadow-xs)" : "none",
              transition: "all 0.15s",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Upload */}
      {mode === "upload" && (
        <>
          <div onClick={handleSelectFile}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault(); setIsDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) { setSelectedFileName(f.name); setErrorMsg(""); }
            }}
            style={{
              borderRadius: 20, padding: "48px 32px", textAlign: "center", cursor: "pointer",
              border: `2px dashed ${isDragging ? "var(--blue)" : selectedFilePath ? "var(--green)" : "var(--separator)"}`,
              background: isDragging ? "rgba(0,122,255,0.05)" : selectedFilePath ? "rgba(52,199,89,0.05)" : "var(--bg-card)",
              transition: "all 0.2s",
            }}>
            <input ref={fileInputRef} type="file" accept="audio/*,video/*" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setSelectedFileName(f.name); setErrorMsg(""); }}} />
            <div style={{
              width: 56, height: 56, borderRadius: 14, margin: "0 auto 14px",
              background: selectedFilePath ? "rgba(52,199,89,0.12)" : "rgba(0,122,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FileAudio size={26} color={selectedFilePath ? "var(--green)" : "var(--blue)"} />
            </div>
            {selectedFileName
              ? <><p style={{ fontWeight: 500, color: "var(--label)" }}>{selectedFileName}</p>
                  <p style={{ fontSize: 13, color: "var(--label-3)", marginTop: 4 }}>點擊更換檔案</p></>
              : <><p style={{ fontWeight: 500, color: "var(--label)" }}>點擊選擇或拖拉音訊</p>
                  <p style={{ fontSize: 13, color: "var(--label-3)", marginTop: 4 }}>MP3、M4A、WAV、MP4、OGG、FLAC</p></>
            }
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, paddingLeft: 4 }}>
            <Download size={12} color="var(--label-4)" />
            <span style={{ fontSize: 12, color: "var(--label-4)" }}>
              本地 Whisper（{settings.whisperModel} · {MODEL_SIZES[settings.whisperModel]}），首次使用自動下載
            </span>
          </div>
        </>
      )}

      {/* Paste */}
      {mode === "paste" && (
        <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)}
          placeholder="將會議逐字稿貼到這裡..."
          style={{
            width: "100%", height: 260, padding: "14px 16px",
            borderRadius: 16, border: "1px solid var(--separator)",
            background: "var(--bg-card)", color: "var(--label)",
            fontFamily: "inherit", fontSize: 14, lineHeight: 1.6,
            resize: "none", outline: "none", boxShadow: "var(--shadow-xs)",
          }} />
      )}

      {/* Record */}
      {mode === "record" && (
        <div style={{
          borderRadius: 20, padding: "40px 32px", textAlign: "center",
          background: "var(--bg-card)", boxShadow: "var(--shadow-sm)",
        }}>
          <Waveform analyser={analyserNode} active={isRecording} />

          {/* Timer */}
          <div style={{
            fontSize: 44, fontWeight: 300, letterSpacing: -1,
            color: isRecording ? "var(--red)" : "var(--label-4)",
            fontVariantNumeric: "tabular-nums", margin: "16px 0 28px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', monospace",
          }}>
            {formatTime(recordingTime)}
          </div>

          {/* Buttons */}
          {!isRecording && !recordingDone && (
            <button onClick={handleStartRecording} style={{
              width: 72, height: 72, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "var(--red)", boxShadow: "0 4px 16px rgba(255,59,48,0.4)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}>
              <Mic size={28} color="#fff" />
            </button>
          )}

          {isRecording && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <button onClick={handleStopRecording} style={{
                width: 64, height: 64, borderRadius: "50%", border: "none", cursor: "pointer",
                background: "var(--label)", boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                <Square size={22} color="#fff" fill="#fff" />
              </button>
              <button onClick={handleCancelRecording}
                style={btn("rgba(118,118,128,0.12)", "var(--label-2)", { fontSize: 13 })}>
                <MicOff size={14} /> 取消
              </button>
            </div>
          )}

          {recordingDone && !isRecording && (
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 20,
                background: "rgba(52,199,89,0.1)", color: "var(--green)",
                fontWeight: 500, fontSize: 14, marginBottom: 12,
              }}>
                <Mic size={14} /> {selectedFileName} 已就緒
              </div>
              <br />
              <button onClick={handleCancelRecording}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--label-3)" }}>
                重新錄音
              </button>
            </div>
          )}

          <p style={{ fontSize: 12, color: "var(--label-4)", marginTop: 24 }}>
            錄音完成後點擊下方「整理重點」
          </p>
        </div>
      )}

      {/* Download progress */}
      {status === "downloading" && (
        <div style={{
          marginTop: 16, padding: "14px 18px", borderRadius: 14,
          background: "rgba(0,122,255,0.08)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--blue)" }}>
              下載 Whisper {settings.whisperModel} 模型
            </span>
            <span style={{ fontSize: 13, color: "var(--blue)" }}>{downloadPct}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "rgba(0,122,255,0.15)" }}>
            <div style={{
              height: "100%", borderRadius: 2, background: "var(--blue)",
              width: `${downloadPct}%`, transition: "width 0.3s",
            }} />
          </div>
          <p style={{ fontSize: 11, color: "var(--label-3)", marginTop: 6 }}>
            {MODEL_SIZES[settings.whisperModel]}，僅需下載一次
          </p>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div style={{
          marginTop: 14, display: "flex", alignItems: "flex-start", gap: 8,
          padding: "12px 14px", borderRadius: 12,
          background: "rgba(255,59,48,0.08)", color: "#c0392b",
        }}>
          <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 13 }}>{errorMsg}</span>
        </div>
      )}

      {/* CTA button */}
      <button onClick={handleProcess} disabled={isLoading} style={{
        marginTop: 20, width: "100%", padding: "14px", borderRadius: 14,
        border: "none", cursor: isLoading ? "not-allowed" : "pointer",
        fontFamily: "inherit", fontSize: 16, fontWeight: 600,
        background: isLoading ? "var(--label-4)" : "var(--blue)",
        color: "#fff",
        boxShadow: isLoading ? "none" : "0 4px 16px rgba(0,122,255,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "background 0.2s, box-shadow 0.2s",
      }}>
        {isLoading ? (
          <>
            <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
            {status === "downloading" && "下載模型中..."}
            {status === "transcribing" && "語音轉文字中..."}
            {status === "summarizing" && "AI 整理中..."}
          </>
        ) : "整理重點"}
      </button>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
