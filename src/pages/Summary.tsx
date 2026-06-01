import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, FileDown, FileText, ChevronDown, ChevronRight, Loader2, CheckCircle, XCircle } from "lucide-react";
import type { SummaryResult, OutlineItem } from "../types";
import { exportToWord, exportToPDF } from "../services/exporter";

interface Toast { msg: string; type: "success" | "error"; }

function ToastBar({ toast }: { toast: Toast }) {
  return (
    <div style={{
      position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
      display: "flex", alignItems: "center", gap: 8,
      padding: "12px 20px", borderRadius: 100,
      background: toast.type === "success" ? "#34C759" : "#FF3B30",
      color: "#fff", fontSize: 14, fontWeight: 500,
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
      zIndex: 100,
    }}>
      {toast.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
      {toast.msg}
    </div>
  );
}

function OutlineNode({ item, index }: { item: OutlineItem; index?: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = item.children.length > 0;

  return (
    <li style={{ listStyle: "none", marginTop: 4 }}>
      <div onClick={() => hasChildren && setOpen(!open)}
        style={{ display: "flex", alignItems: "flex-start", gap: 6, cursor: hasChildren ? "pointer" : "default" }}>
        <span style={{ color: "#C7C7CC", marginTop: 2, flexShrink: 0 }}>
          {hasChildren
            ? open ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            : <span style={{ width: 14, display: "inline-block" }} />}
        </span>
        <span style={{ fontSize: 14, color: "#1C1C1E", lineHeight: 1.5 }}>
          {index !== undefined && (
            <span style={{ color: "#8E8E93", marginRight: 4 }}>{index + 1}.</span>
          )}
          {item.content}
        </span>
      </div>
      {hasChildren && open && (
        <ul style={{ marginLeft: 20, marginTop: 4, paddingLeft: 12, borderLeft: "2px solid #F2F2F7" }}>
          {item.children.map((child, i) => <OutlineNode key={i} item={child} />)}
        </ul>
      )}
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#fff", borderRadius: 20,
      boxShadow: "0 1px 4px rgba(0,0,0,0.07)", padding: "20px 22px", marginBottom: 12,
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 14 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(60,60,67,0.15)",
  background: "#fff", color: "#3C3C43", fontSize: 13, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  transition: "background 0.15s",
};

export default function Summary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { summary, transcript, date } = location.state as {
    summary: SummaryResult; transcript: string; date: string;
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  if (!summary) { navigate("/"); return null; }

  const showToast = (msg: string, type: Toast["type"]) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleExportWord = async () => {
    setExportingWord(true);
    try { await exportToWord(summary, date); showToast("Word 已儲存", "success"); }
    catch (err) { showToast(`匯出失敗：${err instanceof Error ? err.message : "未知錯誤"}`, "error"); }
    finally { setExportingWord(false); }
  };

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    setExportingPdf(true);
    try { await exportToPDF(contentRef.current, summary.title, date); showToast("PDF 已儲存", "success"); }
    catch (err) { showToast(`匯出失敗：${err instanceof Error ? err.message : "未知錯誤"}`, "error"); }
    finally { setExportingPdf(false); }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 32px" }}>
      {toast && <ToastBar toast={toast} />}

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <button onClick={() => navigate("/")} style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "none", border: "none", cursor: "pointer",
          fontSize: 14, color: "#007AFF", fontFamily: "inherit", padding: 0,
        }}>
          <ArrowLeft size={16} /> 返回
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleExportWord} disabled={exportingWord} style={ghostBtn}>
            {exportingWord ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <FileText size={14} />}
            Word
          </button>
          <button onClick={handleExportPDF} disabled={exportingPdf} style={ghostBtn}>
            {exportingPdf ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <FileDown size={14} />}
            PDF
          </button>
        </div>
      </div>

      {/* Captured for PDF */}
      <div ref={contentRef}>
        {/* Title block */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.3, color: "#1C1C1E" }}>
            {summary.title}
          </h1>
          <p style={{ fontSize: 13, color: "#8E8E93", marginTop: 4 }}>{date}</p>
        </div>

        {/* TLDR */}
        <div style={{
          borderRadius: 16, padding: "16px 20px", marginBottom: 12,
          background: "rgba(0,122,255,0.07)",
          borderLeft: "3px solid #007AFF",
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#007AFF", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>
            摘要
          </p>
          <p style={{ fontSize: 14, color: "#1C1C1E", lineHeight: 1.6 }}>{summary.tldr}</p>
        </div>

        {/* Outline */}
        <Section title="大綱">
          <ul style={{ padding: 0 }}>
            {summary.outline.map((item, i) => <OutlineNode key={i} item={item} index={i} />)}
          </ul>
        </Section>

        {/* Key points */}
        <Section title="重點整理">
          <ul style={{ padding: 0 }}>
            {summary.keyPoints.map((pt, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: i > 0 ? 10 : 0 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#007AFF",
                  flexShrink: 0, marginTop: 6,
                }} />
                <span style={{ fontSize: 14, color: "#1C1C1E", lineHeight: 1.5 }}>{pt}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Action items */}
        {summary.actionItems.length > 0 && (
          <Section title="待辦事項">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {summary.actionItems.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <input type="checkbox" style={{ marginTop: 3, accentColor: "#007AFF", flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: 14, color: "#1C1C1E" }}>{item.task}</span>
                    <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
                      {item.assignee && <span style={{ fontSize: 12, color: "#007AFF" }}>👤 {item.assignee}</span>}
                      {item.deadline && <span style={{ fontSize: 12, color: "#8E8E93" }}>📅 {item.deadline}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Transcript (excluded from PDF) */}
      <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", overflow: "hidden", marginTop: 12 }}>
        <button onClick={() => setShowTranscript(!showTranscript)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "18px 22px", background: "none", border: "none", cursor: "pointer",
            fontFamily: "inherit",
          }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93", letterSpacing: 0.5, textTransform: "uppercase" }}>
            完整逐字稿
          </span>
          {showTranscript ? <ChevronDown size={16} color="#8E8E93" /> : <ChevronRight size={16} color="#8E8E93" />}
        </button>
        {showTranscript && (
          <div style={{ padding: "0 22px 20px", borderTop: "1px solid #F2F2F7" }}>
            <p style={{ fontSize: 13, color: "#3C3C43", lineHeight: 1.7, whiteSpace: "pre-wrap", paddingTop: 16 }}>
              {transcript}
            </p>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
