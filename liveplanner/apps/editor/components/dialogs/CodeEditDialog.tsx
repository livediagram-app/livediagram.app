import { useId, useRef, useState } from 'react';
import { Button, CloseIcon, DialogHeader } from '@liveplanner/ui';
import { CODE_LANGUAGES, CODE_MAX_LENGTH, type CodeLanguage } from '@liveplanner/project';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';

// The code block's edit modal (docs/specs/009-elements/code-block.md): a monospace textarea + a language
// dropdown. Opened by double-clicking the card or from the context menu's
// Code category (a multi-line editor is too big for the menu, like the line
// chart's data grid). Commits once on Save — one undo step.

export function CodeEditDialog({
  code,
  language,
  onCommit,
  onClose,
}: {
  code: string;
  language: CodeLanguage;
  onCommit: (code: string, language: CodeLanguage) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(code);
  const [lang, setLang] = useState<CodeLanguage>(language);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const save = () => {
    onCommit(draft.slice(0, CODE_MAX_LENGTH), lang);
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

  return (
    <Dialog open onClose={onClose} ariaLabel="Edit code" size="lg" className="max-h-[90vh]">
      <DialogHeader
        title="Code"
        subtitle="Paste or type the snippet; pick a language for highlighting."
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <CloseIcon size={18} />
        </button>
      </DialogHeader>
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
        <div className="flex items-center justify-between gap-3">
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
