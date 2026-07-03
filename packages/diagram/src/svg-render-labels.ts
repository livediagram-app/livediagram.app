// Export label text emitters (spec/54 label fidelity): the resolved-run
// types plus the plain / wrapped / rich <text> builders and the greedy
// style-aware word wrap shared by the SVG emitter and the PNG canvas
// drawer. Split from svg-render.ts alongside the -primitives / -shapes /
// -table siblings; svg-render re-exports everything so importers keep
// resolving.
import { LABEL_LINE_HEIGHT, labelMeasure, r2, xmlEscape } from './svg-render-primitives';

// One resolved span of a rich label (run + element defaults).
export type ExportRun = {
  text: string;
  color: string;
  size: number;
  bold: boolean;
  italic: boolean;
};

export type ExportLabel = {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  // How a WRAPPED block hangs off `y` (the editor's textAlignY): 'top'
  // anchors the first line at y, 'bottom' the last line, 'middle' centres
  // the block. Single lines render identically under all three.
  valign: 'top' | 'middle' | 'bottom';
  // Horizontal room to wrap into (element width minus its padding insets).
  maxWidth: number;
  color: string;
  size: number;
  bold: boolean;
  italic: boolean;
  runs?: ExportRun[];
};

export function svgLabel(
  text: string,
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end',
  color: string,
  fontSize: number,
  bold: boolean,
  italic: boolean,
): string {
  return (
    `<text x="${r2(x)}" y="${r2(y)}" font-family="system-ui, sans-serif" font-size="${fontSize}"` +
    ` font-weight="${bold ? 600 : 400}"${italic ? ' font-style="italic"' : ''}` +
    ` fill="${xmlEscape(color)}" text-anchor="${anchor}" dominant-baseline="central">${xmlEscape(text)}</text>`
  );
}

// Where a wrapped block's FIRST line sits so the block hangs off `y` per
// the vertical alignment: 'top' anchors the first line, 'bottom' the last,
// 'middle' centres the block. Shared by the plain + rich wrapped labels.
function blockFirstY(
  y: number,
  lineCount: number,
  lineH: number,
  valign: 'top' | 'middle' | 'bottom',
): number {
  if (valign === 'top') return y;
  if (valign === 'bottom') return y - (lineCount - 1) * lineH;
  return y - ((lineCount - 1) * lineH) / 2;
}

// A word-wrapped plain label: one anchored <text> with a <tspan> per line.
export function svgWrappedLabel(
  lines: string[],
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end',
  color: string,
  fontSize: number,
  bold: boolean,
  italic: boolean,
  valign: 'top' | 'middle' | 'bottom' = 'middle',
): string {
  const lineH = fontSize * LABEL_LINE_HEIGHT;
  const firstY = blockFirstY(y, lines.length, lineH, valign);
  const tspans = lines
    .map(
      (line, i) => `<tspan x="${r2(x)}" dy="${i === 0 ? 0 : r2(lineH)}">${xmlEscape(line)}</tspan>`,
    )
    .join('');
  return (
    `<text x="${r2(x)}" y="${r2(firstY)}" font-family="system-ui, sans-serif" font-size="${fontSize}"` +
    ` font-weight="${bold ? 600 : 400}"${italic ? ' font-style="italic"' : ''}` +
    ` fill="${xmlEscape(color)}" text-anchor="${anchor}" dominant-baseline="central">${tspans}</text>`
  );
}

// Greedy word-wrap for a rich label's runs: each word keeps its run's
// style and is measured WITH it (a bold 20px word takes more room than a
// regular 12px one), so mixed-format labels break at the same widths the
// editor's DOM layout does instead of running out of the element on one
// line. Adjacent same-style fragments on a line merge back together.
// Shared by the SVG emitter below and the PNG canvas drawer.
export function wrapExportRuns(runs: ExportRun[], maxWidth: number): ExportRun[][] {
  const lines: ExportRun[][] = [];
  let cur: ExportRun[] = [];
  let curW = 0;
  const pushLine = () => {
    lines.push(cur);
    cur = [];
    curW = 0;
  };
  for (const run of runs) {
    const measure = labelMeasure(run.size, run.bold, run.italic);
    const spaceW = Math.max(measure(' '), run.size * 0.25);
    run.text.split('\n').forEach((para, pi) => {
      if (pi > 0) pushLine();
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const wordW = measure(word);
        if (curW > 0 && curW + spaceW + wordW > maxWidth) pushLine();
        const frag = (curW > 0 ? ' ' : '') + word;
        const last = cur[cur.length - 1];
        if (
          last &&
          last.color === run.color &&
          last.size === run.size &&
          last.bold === run.bold &&
          last.italic === run.italic
        ) {
          last.text += frag;
        } else {
          cur.push({ ...run, text: frag });
        }
        curW += wordW + (frag.startsWith(' ') ? spaceW : 0);
      }
    });
  }
  pushLine();
  // A trailing empty line from a terminal newline renders as nothing.
  return lines.filter((l, i) => l.length > 0 || i < lines.length - 1);
}

// A word-wrapped rich label: one anchored <text>, a positioned outer
// <tspan> per line, a styled inner <tspan> per fragment.
export function svgRichWrappedLabel(
  runs: ExportRun[],
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end',
  maxWidth: number,
  valign: 'top' | 'middle' | 'bottom' = 'middle',
): string {
  const lines = wrapExportRuns(runs, maxWidth);
  const lineH = LABEL_LINE_HEIGHT * Math.max(...runs.map((r) => r.size));
  const firstY = blockFirstY(y, lines.length, lineH, valign);
  const body = lines
    .map((line, i) => {
      const frags = line
        .map(
          (run) =>
            `<tspan fill="${xmlEscape(run.color)}" font-size="${run.size}"` +
            ` font-weight="${run.bold ? 600 : 400}"${run.italic ? ' font-style="italic"' : ''}>` +
            `${xmlEscape(run.text)}</tspan>`,
        )
        .join('');
      return `<tspan x="${r2(x)}" dy="${i === 0 ? 0 : r2(lineH)}">${frags || ' '}</tspan>`;
    })
    .join('');
  return (
    `<text x="${r2(x)}" y="${r2(firstY)}" font-family="system-ui, sans-serif"` +
    ` text-anchor="${anchor}" dominant-baseline="central">${body}</text>`
  );
}

// Per-range label: one anchored <text> with a <tspan> per run.
export function svgRichLabel(
  runs: ExportRun[],
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end',
): string {
  const spans = runs
    .map(
      (run) =>
        `<tspan fill="${xmlEscape(run.color)}" font-size="${run.size}"` +
        ` font-weight="${run.bold ? 600 : 400}"${run.italic ? ' font-style="italic"' : ''}>` +
        `${xmlEscape(run.text)}</tspan>`,
    )
    .join('');
  return (
    `<text x="${r2(x)}" y="${r2(y)}" font-family="system-ui, sans-serif"` +
    ` text-anchor="${anchor}" dominant-baseline="central">${spans}</text>`
  );
}
