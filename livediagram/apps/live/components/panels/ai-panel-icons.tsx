import { Glyph } from '@livediagram/ui';
// Inline SVG icons for the AI panel: the Ask / Clean mode glyphs and the
// Plug (connect) glyph. Pure presentational; split out of AiPanel.

export function CleanIcon() {
  return (
    <Glyph size={11} units={16}>
      <path d="M3 13l4-4m0 0l6-6-3-3-6 6m3 3l-3 3" />
      <path d="M13 13h.01" strokeWidth="2" />
    </Glyph>
  );
}

export function AskIcon() {
  return (
    <Glyph size={11} units={16}>
      <circle cx="8" cy="8" r="6" />
      <path d="M6 6.5a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3" />
      <circle cx="8" cy="12" r="0.5" fill="currentColor" />
    </Glyph>
  );
}

// A small plug glyph for the "Connect agent" button (connecting an
// external AI tool over MCP).
export function PlugIcon() {
  return (
    <Glyph size={12} units={16}>
      <path d="M5 2v3M11 2v3" />
      <path d="M3.5 5h9v2a4.5 4.5 0 0 1-9 0V5Z" />
      <path d="M8 11.5V14" />
    </Glyph>
  );
}

export function SendIcon() {
  return (
    <Glyph size={13} units={16}>
      <path d="M2 8h12M9 3l5 5-5 5" />
    </Glyph>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <Glyph size={small ? 12 : 14} units={24} className="animate-spin" strokeLinejoin="miter">
      <path d="M12 2a10 10 0 0 1 10 10" />
    </Glyph>
  );
}

export function BlinkCursor() {
  return (
    <span
      className="ml-0.5 inline-block h-3 w-px animate-pulse bg-slate-500 dark:bg-slate-400"
      aria-hidden
    />
  );
}
