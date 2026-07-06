import { useState } from 'react';

// The Mermaid export sub-view (spec/73): a textarea pre-filled with the
// tab serialised to Mermaid, editable for a quick tweak-and-copy, plus a
// Copy and a Download button. Edits live only in this textarea — they
// never touch the tab (this is a scratch view for getting the text out,
// not a round-trip editor). Owns its own state so ExportTabDialog just
// swaps it in when the Mermaid card is picked.
export function MermaidExportPanel({
  initialText,
  onDownload,
  onCopied,
  onBack,
}: {
  initialText: string;
  // Save the current textarea content as a .mmd file. The parent owns the
  // blob download + filename + telemetry so this stays a dumb view.
  onDownload: (text: string) => void;
  // Fire telemetry when the text is copied to the clipboard.
  onCopied: () => void;
  onBack: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopied();
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (permissions / insecure context) — the textarea
      // is right there to select manually, so fail quietly.
    }
  };

  return (
    <div>
      <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">
        This tab as a Mermaid flowchart. Edit it here to copy a variant — your edits don't change
        the tab.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        className="h-56 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-800 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/30"
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={() => onDownload(text)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700"
          >
            Download .mmd
          </button>
        </div>
      </div>
    </div>
  );
}
