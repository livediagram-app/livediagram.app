import { CopyButton } from './CopyButton';

// A command or config block with its copy button (docs/specs/019-marketing/build-with-ai.md): a dark panel in
// both appearances, the way a terminal reads, scrolling sideways rather than wrapping a command.
export function CodeSnippet({ code, lang, label }: { code: string; lang: string; label?: string }) {
  const kind = lang === 'bash' ? 'command' : lang === 'text' ? 'text' : 'config';
  return (
    <div className="overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-900/10 dark:bg-slate-950 dark:ring-white/10">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-1.5">
        <span className="font-mono text-xs text-slate-400">
          {label ?? (lang === 'bash' ? 'Terminal' : lang)}
        </span>
        <CopyButton text={code} what={`the ${kind}`} tone="dark" size="xs" />
      </div>
      {/* A command's `$ ` is drawn by CSS, so no selection or copy of the block can take it along: pasted into a
          shell it would fail as "$: command not found". */}
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-100">
        <code
          className={`select-all ${lang === 'bash' ? "before:text-slate-500 before:content-['$_']" : ''}`}
        >
          {code}
        </code>
      </pre>
    </div>
  );
}
