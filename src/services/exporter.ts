import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
} from "docx";
import jsPDF from "jspdf";
import type { SummaryResult } from "../types";

function buildWordDoc(summary: SummaryResult, date: string): Document {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      text: summary.title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: `日期：${date}`, color: "666666" })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      text: "摘要",
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({ text: summary.tldr }),
    new Paragraph({ text: "" }),
    new Paragraph({ text: "大綱", heading: HeadingLevel.HEADING_2 })
  );

  summary.outline.forEach((item, i) => {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: `${i + 1}. ${item.content}`, bold: true })],
      })
    );
    item.children.forEach((child, j) => {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: `    ${i + 1}.${j + 1} ${child.content}` })],
        })
      );
    });
  });

  paragraphs.push(
    new Paragraph({ text: "" }),
    new Paragraph({ text: "重點整理", heading: HeadingLevel.HEADING_2 })
  );
  summary.keyPoints.forEach((point) => {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: `• ${point}` })] }));
  });

  if (summary.actionItems.length > 0) {
    paragraphs.push(
      new Paragraph({ text: "" }),
      new Paragraph({ text: "待辦事項", heading: HeadingLevel.HEADING_2 })
    );
    summary.actionItems.forEach((item) => {
      const text = [
        item.assignee ? `【${item.assignee}】` : "☐",
        item.task,
        item.deadline ? `（${item.deadline}）` : "",
      ].join(" ");
      paragraphs.push(new Paragraph({ children: [new TextRun({ text })] }));
    });
  }

  return new Document({ sections: [{ properties: {}, children: paragraphs }] });
}

export async function exportToWord(summary: SummaryResult, date: string) {
  const doc = buildWordDoc(summary, date);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${summary.title}-${date}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(summary: SummaryResult, date: string) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const marginLeft = 20;
  const marginRight = 190;
  const lineHeight = 7;
  let y = 25;

  const addText = (text: string, size = 11, bold = false, color = "#000000") => {
    pdf.setFontSize(size);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setTextColor(color);
    const lines = pdf.splitTextToSize(text, marginRight - marginLeft);
    lines.forEach((line: string) => {
      if (y > 275) {
        pdf.addPage();
        y = 25;
      }
      pdf.text(line, marginLeft, y);
      y += lineHeight;
    });
  };

  const addSection = (title: string) => {
    y += 3;
    addText(title, 13, true, "#1e293b");
    pdf.setDrawColor("#6366f1");
    pdf.setLineWidth(0.5);
    pdf.line(marginLeft, y, marginRight, y);
    y += 5;
  };

  addText(summary.title, 18, true, "#1e293b");
  y += 2;
  addText(`日期：${date}`, 10, false, "#64748b");
  y += 4;

  addSection("摘要");
  addText(summary.tldr);
  y += 2;

  addSection("大綱");
  summary.outline.forEach((item, i) => {
    addText(`${i + 1}. ${item.content}`, 11, true);
    item.children.forEach((child, j) => {
      addText(`    ${i + 1}.${j + 1} ${child.content}`);
    });
  });

  addSection("重點整理");
  summary.keyPoints.forEach((point) => addText(`• ${point}`));

  if (summary.actionItems.length > 0) {
    addSection("待辦事項");
    summary.actionItems.forEach((item) => {
      const text = [
        item.assignee ? `【${item.assignee}】` : "☐",
        item.task,
        item.deadline ? `（${item.deadline}）` : "",
      ].join(" ");
      addText(text);
    });
  }

  pdf.save(`${summary.title}-${date}.pdf`);
}
