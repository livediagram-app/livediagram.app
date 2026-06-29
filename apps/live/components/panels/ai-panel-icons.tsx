// Inline SVG icons for the AI panel: the Ask / Clean mode glyphs and the
// Plug (connect) glyph. Pure presentational; split out of AiPanel.

export function CleanIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 13l4-4m0 0l6-6-3-3-6 6m3 3l-3 3" />
      <path d="M13 13h.01" strokeWidth="2" />
    </svg>
  );
}

export function AskIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M6 6.5a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3" />
      <circle cx="8" cy="12" r="0.5" fill="currentColor" />
    </svg>
  );
}

// A small plug glyph for the "Connect agent" button (connecting an
// external AI tool over MCP).
export function PlugIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 2v3M11 2v3" />
      <path d="M3.5 5h9v2a4.5 4.5 0 0 1-9 0V5Z" />
      <path d="M8 11.5V14" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 8h12M9 3l5 5-5 5" />
    </svg>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <svg
      width={small ? 12 : 14}
      height={small ? 12 : 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
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
