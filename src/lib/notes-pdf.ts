// Client-side PDF builder for deep notes using pdfmake.
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { TDocumentDefinitions, Content, ContentTable } from "pdfmake/interfaces";

// pdfmake vfs wiring (handles both ESM/CJS shapes)
type VfsModule = { pdfMake?: { vfs?: Record<string, string> }; vfs?: Record<string, string> };
const vfs = (pdfFonts as unknown as VfsModule).pdfMake?.vfs ?? (pdfFonts as unknown as VfsModule).vfs;
if (vfs) (pdfMake as unknown as { vfs: Record<string, string> }).vfs = vfs;

export type DeepNote = {
  topic: string;
  level: string;
  language?: string | null;
  summary: string | null;
  created_at: string;
  chapters: Array<{
    id: string;
    title: string;
    introduction: string;
    definitions: { term: string; definition: string }[];
    concepts: { heading: string; body: string }[];
    examples: { title: string; body: string }[];
    diagrams: { caption: string; description: string }[];
    key_points: string[];
    tables: { title: string; headers: string[]; rows: string[][] }[];
    formulas: { name: string; formula: string; explanation: string }[];
    summary: string;
    interview_qs: { q: string; a: string }[];
    mcqs: { q: string; choices: string[]; answer_index: number; explanation: string }[];
    revision: string[];
  }>;
};

const BRAND = "#6366f1";
const BRAND_DARK = "#1e1b4b";
const ACCENT = "#f59e0b";
const MUTED = "#64748b";
const SOFT = "#f1f5f9";

function calloutBox(title: string, items: string[], color: string): Content {
  return {
    table: {
      widths: ["*"],
      body: [[
        {
          stack: [
            { text: title, bold: true, color, margin: [0, 0, 0, 4] },
            { ul: items, margin: [0, 0, 0, 0] },
          ],
        },
      ]],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i: number) => (i === 0 ? 3 : 0),
      vLineColor: () => color,
      fillColor: () => SOFT,
      paddingTop: () => 8,
      paddingBottom: () => 8,
      paddingLeft: () => 12,
      paddingRight: () => 12,
    },
    margin: [0, 6, 0, 10],
  };
}

function tableContent(title: string, headers: string[], rows: string[][]): Content {
  const table: ContentTable = {
    table: {
      headerRows: 1,
      widths: headers.map(() => "*"),
      body: [
        headers.map((h) => ({ text: h, bold: true, color: "#ffffff", fillColor: BRAND, margin: [4, 4, 4, 4] as [number, number, number, number] })),
        ...rows.map((r, ri) =>
          r.map((cell) => ({
            text: String(cell ?? ""),
            margin: [4, 3, 4, 3] as [number, number, number, number],
            fillColor: ri % 2 === 0 ? "#ffffff" : SOFT,
          })),
        ),
      ] as unknown as ContentTable["table"]["body"],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#e2e8f0",
      vLineColor: () => "#e2e8f0",
    },
    margin: [0, 4, 0, 12],
  };
  return { stack: [{ text: title, italics: true, color: MUTED, margin: [0, 0, 0, 4] }, table] };
}

function diagramPlaceholder(caption: string, description: string): Content {
  return {
    stack: [
      {
        table: {
          widths: ["*"],
          heights: [80],
          body: [[{ text: "[ Diagram ]", alignment: "center", color: MUTED, italics: true }]],
        },
        layout: {
          hLineWidth: () => 1,
          vLineWidth: () => 1,
          hLineColor: () => BRAND,
          vLineColor: () => BRAND,
          fillColor: () => "#eef2ff",
        },
      },
      { text: caption, bold: true, margin: [0, 4, 0, 2] },
      { text: description, color: MUTED, fontSize: 9, italics: true },
    ],
    margin: [0, 4, 0, 10],
    unbreakable: true,
  };
}

export function buildNotesPdf(note: DeepNote): void {
  const today = new Date(note.created_at).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  const content: Content[] = [];

  // ---------- Cover ----------
  content.push({
    stack: [
      { text: "RAW", fontSize: 28, bold: true, color: BRAND, margin: [0, 120, 0, 0] },
      { text: "AI PERSONAL TUTOR", fontSize: 10, color: MUTED, characterSpacing: 4, margin: [0, 2, 0, 60] },
      { text: note.topic, fontSize: 36, bold: true, color: BRAND_DARK },
      { text: `${note.level.toUpperCase()} • Deep Study Guide`, fontSize: 12, color: ACCENT, margin: [0, 10, 0, 0] },
      { text: note.summary ?? "", fontSize: 11, color: MUTED, margin: [0, 30, 0, 0], lineHeight: 1.4 },
      { text: today, fontSize: 10, color: MUTED, margin: [0, 80, 0, 0] },
    ],
    alignment: "left",
    pageBreak: "after",
  });

  // ---------- Table of contents ----------
  content.push(
    { text: "Table of Contents", style: "h1", tocItem: false },
    {
      toc: {
        title: { text: "", margin: [0, 0, 0, 8] },
        numberStyle: { color: MUTED },
        textStyle: { color: BRAND_DARK },
      },
    },
    { text: "", pageBreak: "after" },
  );

  // ---------- Chapters ----------
  note.chapters.forEach((ch, idx) => {
    content.push({
      text: `Chapter ${idx + 1}. ${ch.title}`,
      style: "h1",
      tocItem: true,
      tocStyle: { color: BRAND_DARK },
      tocNumberStyle: { color: MUTED },
    });

    content.push({ text: "Introduction", style: "h2" });
    content.push({ text: ch.introduction, margin: [0, 0, 0, 10], lineHeight: 1.35 });

    if (ch.definitions.length) {
      content.push({ text: "Key Definitions", style: "h2" });
      content.push({
        ul: ch.definitions.map((d) => ({
          text: [{ text: `${d.term}: `, bold: true, color: BRAND }, { text: d.definition }],
        })),
        margin: [0, 0, 0, 10],
      });
    }

    if (ch.concepts.length) {
      content.push({ text: "Core Concepts", style: "h2" });
      ch.concepts.forEach((c) => {
        content.push({ text: c.heading, bold: true, color: BRAND_DARK, margin: [0, 4, 0, 2] });
        content.push({ text: c.body, margin: [0, 0, 0, 6], lineHeight: 1.35 });
      });
    }

    if (ch.examples.length) {
      content.push({ text: "Examples", style: "h2" });
      ch.examples.forEach((e) => {
        content.push({ text: e.title, bold: true, margin: [0, 4, 0, 2] });
        content.push({ text: e.body, margin: [0, 0, 0, 6], lineHeight: 1.35 });
      });
    }

    if (ch.diagrams.length) {
      content.push({ text: "Diagrams", style: "h2" });
      ch.diagrams.forEach((d) => content.push(diagramPlaceholder(d.caption, d.description)));
    }

    if (ch.key_points.length) {
      content.push(calloutBox("Key Points", ch.key_points, BRAND));
    }

    if (ch.tables.length) {
      content.push({ text: "Tables", style: "h2" });
      ch.tables.forEach((t) => content.push(tableContent(t.title, t.headers, t.rows)));
    }

    if (ch.formulas.length) {
      content.push({ text: "Formulas", style: "h2" });
      content.push(
        calloutBox(
          "Formulas",
          ch.formulas.map((f) => `${f.name}: ${f.formula} — ${f.explanation}`),
          ACCENT,
        ),
      );
    }

    content.push({ text: "Summary", style: "h2" });
    content.push({ text: ch.summary, italics: true, color: MUTED, margin: [0, 0, 0, 10], lineHeight: 1.35 });

    if (ch.interview_qs.length) {
      content.push({ text: "Interview Questions", style: "h2" });
      content.push({
        ol: ch.interview_qs.map((qa) => ({
          stack: [
            { text: qa.q, bold: true, margin: [0, 0, 0, 2] },
            { text: qa.a, color: MUTED, margin: [0, 0, 0, 4] },
          ],
        })),
        margin: [0, 0, 0, 10],
      });
    }

    if (ch.mcqs.length) {
      content.push({ text: "Practice MCQs", style: "h2" });
      ch.mcqs.forEach((m, qi) => {
        content.push({ text: `Q${qi + 1}. ${m.q}`, bold: true, margin: [0, 4, 0, 2] });
        content.push({
          ul: m.choices.map((c, ci) => ({
            text: `${String.fromCharCode(65 + ci)}. ${c}`,
            color: ci === m.answer_index ? BRAND : undefined,
            bold: ci === m.answer_index,
          })),
          margin: [0, 0, 0, 2],
        });
        content.push({ text: `Answer: ${String.fromCharCode(65 + m.answer_index)} — ${m.explanation}`, fontSize: 9, color: MUTED, italics: true, margin: [0, 0, 0, 6] });
      });
    }

    if (ch.revision.length) {
      content.push(calloutBox("Revision Notes", ch.revision, "#10b981"));
    }

    if (idx < note.chapters.length - 1) {
      content.push({ text: "", pageBreak: "after" });
    }
  });

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [50, 70, 50, 60],
    info: { title: `${note.topic} — RAW Study Guide`, author: "RAW AI Tutor" },
    background: (currentPage: number) => {
      if (currentPage === 1) return [];
      // Watermark on content pages
      return [
        {
          text: "RAW",
          color: "#e5e7eb",
          opacity: 0.35,
          fontSize: 80,
          bold: true,
          absolutePosition: { x: 220, y: 400 },
        },
      ] as unknown as Content;
    },
    header: (currentPage: number) => {
      if (currentPage === 1) return "";
      return {
        columns: [
          { text: "RAW · AI Personal Tutor", color: MUTED, fontSize: 9, margin: [50, 30, 0, 0] },
          { text: note.topic, color: BRAND_DARK, bold: true, fontSize: 9, alignment: "right", margin: [0, 30, 50, 0] },
        ],
      };
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: `Generated ${today}`, color: MUTED, fontSize: 8, margin: [50, 20, 0, 0] },
        { text: `Page ${currentPage} of ${pageCount}`, color: MUTED, fontSize: 8, alignment: "right", margin: [0, 20, 50, 0] },
      ],
    }),
    content,
    styles: {
      h1: { fontSize: 20, bold: true, color: BRAND_DARK, margin: [0, 18, 0, 8] },
      h2: { fontSize: 13, bold: true, color: BRAND, margin: [0, 10, 0, 4] },
    },
    defaultStyle: { fontSize: 10, color: "#111827", lineHeight: 1.3 },
  };

  const filename = `${note.topic.replace(/[^a-z0-9-_ ]/gi, "").trim() || "notes"}.pdf`;
  pdfMake.createPdf(docDefinition).download(filename);
}
