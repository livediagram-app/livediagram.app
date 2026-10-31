'use client';

// The Find bar while its code arrives the first time (docs/specs/007-editor/find-and-replace.md "Opening and closing";
// blueprint "Presentation and UX"): the bar's card with only its Find field, which takes the keyboard at once. Keys
// typed straight after Cmd/Ctrl+F are then the query, as they will be in the bar; without it they reached the canvas,
// where the first letter replaced a selected element's label (type-to-edit) and Delete deleted it.
import { useLayoutEffect, useRef } from 'react';
import { FIND_QUERY_MAX } from '@/lib/find/find-text';
import type { FindView } from '@/hooks/editor/useFindReplace';
import { TOOLBAR_CARD } from '@/components/chrome/toolbar-surface';

// Whether the keyboard was in this field as the bar replaced it: the bar then keeps what was typed and puts the caret
// after it. Read once by the bar as it mounts (takeLoadingHandover).
let handedOver = false;
// Escape closing the bar while it loads is no handover.
let closing = false;
export function takeLoadingHandover(): boolean {
  const was = handedOver;
  handedOver = false;
  return was;
}

export function FindBarLoading({ find }: { find: FindView }) {
  const field = useRef<HTMLInputElement | null>(null);
  useLayoutEffect(() => {
    const input = field.current;
    input?.focus();
    input?.select();
    // Runs as the bar takes its place, while this field is still in the page.
    return () => {
      handedOver = !closing && input !== null && document.activeElement === input;
      closing = false;
    };
  }, []);
  return (
    <div
      role="search"
      aria-label="Find in Tab"
      aria-busy="true"
      data-find-bar=""
      data-keeps-escape=""
      className={`${TOOLBAR_CARD} pointer-events-auto`}
    >
      <input
        ref={field}
        type="text"
        aria-label="Find"
        placeholder="Find"
        spellCheck={false}
        autoComplete="off"
        maxLength={FIND_QUERY_MAX}
        data-find-loading=""
        value={find.query}
        onChange={(e) => find.setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.preventDefault();
          e.stopPropagation();
          closing = true;
          find.close();
        }}
        className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/25"
      />
    </div>
  );
}
