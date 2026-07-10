// Line + label plumbing shared by the Mermaid dialect parsers (spec/73):
// the flowchart parser (mermaid.ts), the state-diagram parser
// (mermaid-state.ts), and the ER parser (mermaid-er.ts) all clean lines,
// read id tokens, and decode labels the same way. Internal module, not
// re-exported from the package index — the public surface is parseMermaid.

import type { DiagramGraph } from './graph-authoring';

export type MermaidDirection = 'TB' | 'LR';

export type ParseMermaidResult =
  | { ok: true; graph: DiagramGraph; direction: MermaidDirection }
  | { ok: false; error: string };

// TD/TB (and BT, folded) → TB; LR/RL → LR. Anything else → TB.
export function directionOf(token: string | undefined): MermaidDirection {
  const t = (token ?? '').toUpperCase();
  return t === 'LR' || t === 'RL' ? 'LR' : 'TB';
}

// Strip trailing %% comments and statement-terminating semicolons, then trim.
export function cleanLine(rawLine: string): string {
  return rawLine
    .replace(/%%.*$/, '')
    .replace(/;+\s*$/, '')
    .trim();
}

// Label text -> element label: strip surrounding quotes, turn <br> line
// breaks into real newlines, decode the entities the export emits.
export function decodeLabel(s: string): string {
  let t = s.trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) t = t.slice(1, -1);
  return t
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

// Read the id token at the front (letters, digits, _, made of the chars
// Mermaid allows in a bare id). Returns null if none.
export function readId(s: string): { id: string; rest: string } | null {
  const m = /^\s*([A-Za-z0-9_]+)/.exec(s);
  return m ? { id: m[1]!, rest: s.slice(m[0].length) } : null;
}
