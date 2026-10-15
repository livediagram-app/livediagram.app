'use client';

// Text edited in place in the form builder (docs/specs/030-forms/forms.md "Building a form"): the heading, a prompt,
// help text, an option. What is typed is kept here and saved when typing pauses (one undo step a pause, not one a
// key) and when the field is left; a change arriving from elsewhere shows when this field is not being typed in.
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

// How long typing pauses before it is saved. Safe range 250..1000 ms.
export const DRAFT_SAVE_MS = 500;

export type DraftTextHandle = { focus: () => void; flush: () => void };

export const DraftText = forwardRef<
  DraftTextHandle,
  {
    value: string;
    onSave: (text: string) => void;
    placeholder?: string;
    maxLength: number;
    multiline?: boolean;
    disabled?: boolean;
    className?: string;
    label: string;
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, text: string) => void;
    onPaste?: (text: string) => boolean;
    autoFocus?: boolean;
    selectOnFocus?: boolean;
  }
>(function DraftText(
  {
    value,
    onSave,
    placeholder,
    maxLength,
    multiline = false,
    disabled = false,
    className = '',
    label,
    onKeyDown,
    onPaste,
    autoFocus,
    selectOnFocus,
  },
  ref,
) {
  const [draft, setDraft] = useState(value);
  const saved = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    if (timer.current === null && value !== saved.current) {
      saved.current = value;
      setDraft(value);
    }
  }, [value]);
  const flush = (text = draft) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (text === saved.current) return;
    saved.current = text;
    onSave(text);
  };
  // A pending save is not lost when the field goes (a question deselected mid-word).
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);
  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    flush: () => flushRef.current(),
  }));
  // A multi-line field grows with what is typed.
  useLayoutEffect(() => {
    const el = input.current;
    if (!multiline || !el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, multiline]);
  const props = {
    ref: input,
    value: draft,
    placeholder,
    maxLength,
    disabled,
    autoFocus,
    'aria-label': label,
    className: `w-full bg-transparent outline-none placeholder:text-slate-400 dark:placeholder:text-slate-400 ${className}`,
    onChange: (e: { target: { value: string } }) => {
      setDraft(e.target.value);
      if (timer.current) clearTimeout(timer.current);
      const text = e.target.value;
      timer.current = setTimeout(() => flushRef.current(text), DRAFT_SAVE_MS);
    },
    onBlur: () => flush(),
    onFocus: selectOnFocus
      ? (e: { target: { select: () => void } }) => e.target.select()
      : undefined,
    onKeyDown: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !multiline) flush();
      onKeyDown?.(e, draft);
    },
    onPaste: onPaste
      ? (e: React.ClipboardEvent) => {
          if (onPaste(e.clipboardData.getData('text'))) e.preventDefault();
        }
      : undefined,
  };
  return multiline ? (
    <textarea rows={1} {...props} className={`${props.className} resize-none`} />
  ) : (
    <input type="text" {...props} />
  );
});
