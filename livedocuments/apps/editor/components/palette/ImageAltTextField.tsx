'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cleanImageAlt, IMAGE_ALT_MAX } from '@livedocuments/document';
import { TextArea } from '@livedocuments/ui';

// When the count turns amber and starts being announced: 20 characters left (safe range 10 to 50).
export const IMAGE_ALT_WARN_LEFT = 20;
// How long "Saved" shows beside the count after a write.
const SAVED_FLASH_MS = 1600;

const LABEL = 'text-xs font-medium text-slate-700 dark:text-slate-200';
const HINT = 'text-[10px] text-slate-600 dark:text-slate-400';

// An image's Alt Text (docs/specs/009-elements/images.md "Alt text"): the words a screen reader says for the picture,
// and the description its SVG, PowerPoint and Word exports carry. With `onCommit` it is a field that keeps a draft
// while you type and writes it on Enter, when you leave the field, and when the menu closes with the draft changed;
// Escape puts the stored words back and keeps the menu open. Without `onCommit` (a Viewer, or a Participant who may
// not write it now) it shows the words, or says there are none.
export function ImageAltTextField({
  value,
  onCommit,
}: {
  // The stored alt text; absent when the image has none.
  value: string | undefined;
  onCommit?: (typed: string) => void;
}) {
  const stored = value ?? '';
  const id = useId();
  // null while the field shows the stored words; the typed words otherwise.
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Read by the unmount write, which runs after the last render.
  const latest = useRef({ draft, stored, onCommit });
  useLayoutEffect(() => {
    latest.current = { draft, stored, onCommit };
  });

  // The menu closing with a changed draft still writes it (a click on the canvas, a shortcut, a long-press elsewhere).
  useEffect(
    () => () => {
      const { draft: pending, stored: was, onCommit: write } = latest.current;
      if (write && pending !== null && pending !== was) write(pending);
    },
    [],
  );

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), SAVED_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [saved]);

  if (!onCommit) {
    return (
      <div className="px-3 py-1.5" data-testid="image-alt-text">
        <p id={`${id}-label`} className={LABEL}>
          Alt Text
        </p>
        {stored ? (
          <p
            aria-labelledby={`${id}-label`}
            className="mt-0.5 whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-300"
          >
            {stored}
          </p>
        ) : (
          <p className="mt-0.5 text-xs italic text-slate-500 dark:text-slate-400">
            Not described yet
          </p>
        )}
      </div>
    );
  }

  const shown = draft ?? stored;
  const left = IMAGE_ALT_MAX - shown.length;
  const nearCap = left <= IMAGE_ALT_WARN_LEFT;

  const commit = () => {
    const pending = latest.current.draft;
    if (pending === null) return;
    // Cleared before writing, so the blur an Enter leads to (or the unmount) never writes it twice.
    latest.current.draft = null;
    setDraft(null);
    if (pending === stored) return;
    onCommit(pending);
    if (cleanImageAlt(pending) !== stored) setSaved(true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      // One line: Enter writes, Shift+Enter never breaks the line.
      e.preventDefault();
      commit();
      return;
    }
    if (e.key === 'Escape') {
      // Claimed, so the menu stays open (useControlMenu skips a handled Escape); a second Escape closes it.
      e.preventDefault();
      latest.current.draft = null;
      setDraft(null);
      e.currentTarget.blur();
    }
  };

  return (
    <div className="px-3 py-1.5" data-testid="image-alt-text">
      <label htmlFor={id} className={`block ${LABEL}`}>
        Alt Text
      </label>
      <p id={`${id}-hint`} className={`mb-1 ${HINT}`}>
        Describes the picture for screen readers and exports.
      </p>
      <TextArea
        id={id}
        compact
        rows={2}
        maxLength={IMAGE_ALT_MAX}
        value={shown}
        placeholder="Describe the picture"
        aria-describedby={`${id}-hint ${id}-count`}
        spellCheck
        enterKeyHint="done"
        className="resize-none leading-snug"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span
          role="status"
          className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400"
        >
          {saved ? 'Saved' : ''}
        </span>
        <span
          id={`${id}-count`}
          className={`text-[10px] tabular-nums ${
            nearCap
              ? 'font-medium text-amber-600 dark:text-amber-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {shown.length} / {IMAGE_ALT_MAX}
        </span>
      </div>
      {/* Spoken only near the cap, so a screen reader is not read the count every keystroke. */}
      <span className="sr-only" aria-live="polite">
        {nearCap ? `${left} characters left` : ''}
      </span>
    </div>
  );
}
