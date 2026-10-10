'use client';

// A Plan board's title in its header (docs/specs/026-plan/plan-board.md "What the board shows"): a double-click
// (on the title, or on the header's empty space) turns it into a text field, its text selected, for someone who
// may edit. Enter or leaving it saves the trimmed name (an empty one changes nothing); Escape puts it back.
import { useEffect, useRef, useState } from 'react';
import type { PlanPalette } from './plan-palette';
import { IN_BOX_TITLE_CLASS } from './menu-name-slot';

// The longest board title, as the Board flyout's Title field takes it.
export const BOARD_TITLE_MAX = 80;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
const TITLE_CLASS = 'min-w-0 max-w-[40%] shrink-0 text-[17px] font-bold leading-tight';

export function BoardTitle({
  title,
  editing,
  selected,
  palette,
  onRename,
  onDone,
  inBox = false,
}: {
  title: string;
  editing: boolean;
  // In the menu box (menu-name-slot): the chrome's size and ink.
  inBox?: boolean;
  selected: boolean;
  palette: PlanPalette;
  onRename: (title: string) => void;
  onDone: () => void;
}) {
  if (!editing)
    return (
      <div
        className={`${inBox ? IN_BOX_TITLE_CLASS : `${TITLE_CLASS} truncate`} ${selected ? 'cursor-move' : ''}`}
      >
        {title}
      </div>
    );
  // Mounted afresh for each rename, so its draft starts from the title as it is now.
  return (
    <BoardTitleField
      title={title}
      palette={palette}
      onRename={onRename}
      onDone={onDone}
      inBox={inBox}
    />
  );
}

function BoardTitleField({
  title,
  palette,
  onRename,
  onDone,
  inBox,
}: {
  title: string;
  inBox: boolean;
  palette: PlanPalette;
  onRename: (title: string) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(title);
  const input = useRef<HTMLInputElement>(null);
  // Set once Enter or Escape has finished, so the blur that follows cannot save a cancelled edit.
  const closed = useRef(false);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const finish = (save: boolean) => {
    if (closed.current) return;
    closed.current = true;
    const next = draft.trim();
    if (save && next && next !== title) onRename(next);
    onDone();
  };
  return (
    <input
      ref={input}
      aria-label="Board title"
      value={draft}
      maxLength={BOARD_TITLE_MAX}
      className={`${inBox ? IN_BOX_TITLE_CLASS : TITLE_CLASS} rounded-md border bg-transparent px-1.5 py-0.5 outline-none`}
      style={{ borderColor: palette.focus, color: inBox ? 'inherit' : palette.text }}
      // The field's own presses never move or select the board.
      onPointerDown={stop}
      onDoubleClick={stop}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
      }}
      onBlur={() => finish(true)}
    />
  );
}
