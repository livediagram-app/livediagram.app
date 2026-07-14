import { useRef, useState } from 'react';
import { Button } from '@livediagram/ui';
import { CODE_LANGUAGES, CODE_MAX_LENGTH, type CodeLanguage } from '@livediagram/diagram';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import { Dialog } from '@/components/dialogs/Dialog';

// The code block's edit modal (spec/82): a monospace textarea + a language
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

  // Tab inserts two spaces instead of moving focus — table stakes for a
  // code editor, and Escape still exits via the Dialog's own handling.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
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
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pt-6 pb-4 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Code</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Paste or type the snippet; pick a language for highlighting.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <CloseIcon size={18} />
        </button>
      </div>
      <div className="flex flex-col gap-3 px-6 py-4">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={CODE_MAX_LENGTH}
          spellCheck={false}
          autoFocus
          rows={14}
          placeholder="// your code here"
          className="w-full resize-y rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-xs leading-4 text-slate-200 outline-none focus:border-brand-400 dark:border-slate-700"
        />
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
