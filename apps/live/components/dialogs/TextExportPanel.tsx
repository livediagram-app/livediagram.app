import { useState } from 'react';
import { Button } from '@livediagram/ui';

// The view/edit/copy sub-view for a text export format (spec/27 + spec/73):
// a textarea pre-filled with the tab serialised to text, editable for a
// quick tweak-and-copy, plus Copy and Download buttons. Edits live only in
// this textarea — they never touch the tab (a scratch view for getting the
// text out, not a round-trip editor). Format-agnostic: the parent supplies
// the pre-filled text, the blurb, and the download button label + handler.
// Shared by JSON, Mermaid, and Markdown.
export function TextExportPanel({
  initialText,
  blurb,
  downloadLabel,
  onDownload,
  onCopied,
  onBack,
}: {
  initialText: string;
  blurb: string;
  downloadLabel: string;
  // Save the current textarea content as a file. The parent owns the blob
  // download + filename + telemetry so this stays a dumb view.
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
      <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400">{blurb}</p>
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
          <Button variant="primary" size="md" onClick={() => onDownload(text)}>
            {downloadLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
