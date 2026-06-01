import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
} from "docx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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
    new Paragraph({ text: "摘要", heading: HeadingLevel.HEADING_2 }),
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

export async function exportToWord(summary: SummaryResult, date: string): Promise<void> {
  const doc = buildWordDoc(summary, date);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${summary.title}-${date}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToPDF(
  element: HTMLElement,
  title: string,
  date: string
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * contentWidth) / canvas.width;

  let posY = margin;
  let remainingHeight = imgHeight;

  pdf.addImage(imgData, "PNG", margin, posY, contentWidth, imgHeight);
  remainingHeight -= pageHeight - margin * 2;

  while (remainingHeight > 0) {
    pdf.addPage();
    posY = margin - (imgHeight - remainingHeight);
    pdf.addImage(imgData, "PNG", margin, posY, contentWidth, imgHeight);
    remainingHeight -= pageHeight - margin * 2;
  }

  pdf.save(`${title}-${date}.pdf`);
}
