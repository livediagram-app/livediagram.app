import { useId, useRef, useState } from 'react';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { codeEditHeroArt } from '@liveworkspace/ui/dialog-hero-art/code-edit';
import { Button } from '@livediagram/ui';
import { CODE_LANGUAGES, CODE_MAX_LENGTH, type CodeLanguage } from '@livediagram/document';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';

// The code block's edit modal (docs/specs/009-elements/code-block.md): a monospace textarea + a language
// dropdown. Opened by double-clicking the card or from the context menu's
// Code category (a multi-line editor is too big for the menu, like the line
// chart's data grid). Commits once on Save — one undo step.

export function CodeEditDialog({
  code,
  language,
  wrap,
  onSetWrap,
  onCommit,
  onClose,
}: {
  code: string;
  language: CodeLanguage;
  // Long-line wrapping (code-block.md): on by default, so this turns it off for the rare block whose lines mean
  // something at their full length. Saved with the code, as its own change when it differs.
  wrap: boolean;
  onSetWrap: (wrap: boolean) => void;
  onCommit: (code: string, language: CodeLanguage) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(code);
  const [lang, setLang] = useState<CodeLanguage>(language);
  const [wrapLines, setWrapLines] = useState(wrap);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const save = () => {
    onCommit(draft.slice(0, CODE_MAX_LENGTH), lang);
    if (wrapLines !== wrap) onSetWrap(wrapLines);
    onClose();
  };

  const hintId = useId();
  // Tab inserts two spaces instead of moving focus: table stakes for a code editor. That left a keyboard with no
  // way to Save (Shift+Tab indented too, and Escape cancels), so Shift+Tab leaves the field as it does anywhere and
  // ⌘/Ctrl+Enter saves, as the mind map outline does.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
      return;
    }
    if (e.key !== 'Tab' || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart, selectionEnd, value } = el;
    const next = value.slice(0, selectionStart) + '  ' + value.slice(selectionEnd);
    setDraft(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = selectionStart + 2;
    });
  };

  const titleId = useId();
  return (
    <Dialog open onClose={onClose} titleId={titleId} size="lg" className="max-h-[90vh]">
      {/* The dialog hero header (dialog-hero-header.md): an editor window, the caret at the end of its line. */}
      <HeroDialogHeader
        art={codeEditHeroArt}
        titleId={titleId}
        title="Code"
        subtitle="Paste or type the snippet; pick a language for highlighting."
        onClose={onClose}
      />
      <div className="flex flex-col gap-3 px-6 py-4">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={CODE_MAX_LENGTH}
          spellCheck={false}
          autoFocus
          aria-label="Code"
          aria-describedby={hintId}
          rows={14}
          placeholder="// your code here"
          className="w-full resize-y rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-xs leading-4 text-slate-200 outline-none focus:border-brand-400 dark:border-slate-700"
        />
        {/* The keys, only where there is a keyboard to press them. */}
        <p
          id={hintId}
          className="-mt-1 text-xs text-slate-600 pointer-coarse:hidden dark:text-slate-400"
        >
          Tab indents, Shift+Tab moves on, ⌘/Ctrl+Enter saves.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              Language
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as CodeLanguage)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {CODE_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l === 'plain' ? 'Plain text' : l}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={wrapLines}
                onChange={(e) => setWrapLines(e.target.checked)}
                className="size-4 cursor-pointer accent-brand-500"
              />
              Wrap Long Lines
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
