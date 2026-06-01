import { useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  FileDown,
  FileText,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  List,
  CheckSquare,
  AlignLeft,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { SummaryResult, OutlineItem } from "../types";
import { exportToWord, exportToPDF } from "../services/exporter";

// Toast notification
interface Toast {
  msg: string;
  type: "success" | "error";
}

function ToastBar({ toast }: { toast: Toast }) {
  return (
    <div
      className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium z-50 transition-all ${
        toast.type === "success"
          ? "bg-green-600 text-white"
          : "bg-red-600 text-white"
      }`}
    >
      {toast.type === "success" ? (
        <CheckCircle size={16} />
      ) : (
        <XCircle size={16} />
      )}
      {toast.msg}
    </div>
  );
}

function OutlineNode({ item, index }: { item: OutlineItem; index?: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = item.children.length > 0;
  const prefix = index !== undefined ? `${index + 1}.` : "•";

  return (
    <li className="mt-1">
      <div
        className={`flex items-start gap-1 ${hasChildren ? "cursor-pointer" : ""}`}
        onClick={() => hasChildren && setOpen(!open)}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown size={14} className="mt-1 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight size={14} className="mt-1 text-slate-400 shrink-0" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="text-slate-700 text-sm">
          <span className="font-medium text-slate-500 mr-1">{prefix}</span>
          {item.content}
        </span>
      </div>
      {hasChildren && open && (
        <ul className="ml-5 mt-1 space-y-1 border-l border-slate-100 pl-3">
          {item.children.map((child, i) => (
            <OutlineNode key={i} item={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} className="text-indigo-500" />
        <h2 className="font-semibold text-slate-700">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function Summary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { summary, transcript, date } = location.state as {
    summary: SummaryResult;
    transcript: string;
    date: string;
  };

  const contentRef = useRef<HTMLDivElement>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  if (!summary) {
    navigate("/");
    return null;
  }

  const showToast = (msg: string, type: Toast["type"]) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleExportWord = async () => {
    setExportingWord(true);
    try {
      await exportToWord(summary, date);
      showToast("Word 檔案已儲存", "success");
    } catch (err) {
      showToast(`Word 匯出失敗：${err instanceof Error ? err.message : "未知錯誤"}`, "error");
    } finally {
      setExportingWord(false);
    }
  };

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    setExportingPdf(true);
    try {
      await exportToPDF(contentRef.current, summary.title, date);
      showToast("PDF 檔案已儲存", "success");
    } catch (err) {
      showToast(`PDF 匯出失敗：${err instanceof Error ? err.message : "未知錯誤"}`, "error");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      {toast && <ToastBar toast={toast} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          返回
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleExportWord}
            disabled={exportingWord}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {exportingWord ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            Word
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {exportingPdf ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
            PDF
          </button>
        </div>
      </div>

      {/* Content captured for PDF */}
      <div ref={contentRef} className="bg-slate-50 pb-2">
        {/* Title */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-800">{summary.title}</h1>
          <p className="text-slate-400 text-sm mt-1">{date}</p>
        </div>

        {/* TLDR */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-4">
          <p className="text-indigo-500 text-xs font-medium mb-1.5">一句話摘要</p>
          <p className="text-slate-700 text-sm leading-relaxed">{summary.tldr}</p>
        </div>

        {/* Outline */}
        <Section icon={List} title="大綱">
          <ul className="space-y-1">
            {summary.outline.map((item, i) => (
              <OutlineNode key={i} item={item} index={i} />
            ))}
          </ul>
        </Section>

        {/* Key Points */}
        <Section icon={Lightbulb} title="重點整理">
          <ul className="space-y-2">
            {summary.keyPoints.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </Section>

        {/* Action Items */}
        {summary.actionItems.length > 0 && (
          <Section icon={CheckSquare} title="待辦事項">
            <ul className="space-y-3">
              {summary.actionItems.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <input type="checkbox" className="mt-0.5 accent-indigo-600 shrink-0" />
                  <div className="text-sm">
                    <span className="text-slate-700">{item.task}</span>
                    <div className="flex gap-3 mt-0.5">
                      {item.assignee && (
                        <span className="text-indigo-500 text-xs">👤 {item.assignee}</span>
                      )}
                      {item.deadline && (
                        <span className="text-slate-400 text-xs">📅 {item.deadline}</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {/* Full Transcript (excluded from PDF capture) */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-4 mt-4">
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlignLeft size={18} className="text-indigo-500" />
            <span className="font-semibold text-slate-700">完整逐字稿</span>
          </div>
          {showTranscript ? (
            <ChevronDown size={16} className="text-slate-400" />
          ) : (
            <ChevronRight size={16} className="text-slate-400" />
          )}
        </button>
        {showTranscript && (
          <div className="px-6 pb-6 border-t border-slate-100">
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap pt-4">
              {transcript}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
