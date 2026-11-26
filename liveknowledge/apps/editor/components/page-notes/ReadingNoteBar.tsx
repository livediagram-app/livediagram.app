'use client';

// The reading selection bar (docs/specs/030-knowledgebase/page-comments.md "Comments on the writing", Work Tracker
// 1484): an Editor or a Participant reading a page who picks words with a mouse, a pen or a trackpad gets Comment and
// Add Action over them the moment the press lets go; ⌘⌥M and ⌘⌥A do the same without it. On a touch screen no bar
// floats (the browser's callout sits there): the docked selection menu carries the two rows, registered here
// (setSelectionNoteEntry). Listens for a press letting go, the selection changing and the two keys, and only while
// this session may note; nothing runs as the writing is typed in.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HoverCard, lucideGlyph } from '@liveknowledge/ui';
import { lucideCircleCheck, lucideMessageSquare } from '@liveworkspace/icons/lucide';
import { keyLabel } from '@liveworkspace/workbench/lib/key-label';
import { TOOLBAR_CARD } from '@liveworkspace/workbench/components/chrome/toolbar-surface';
import { setSelectionNoteEntry } from '@liveworkspace/workbench/components/selection-menu/selection-note-entry';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { track } from '@/lib/telemetry';
import {
  inNoNoteSpot,
  noteBarSpot,
  noteKeyOf,
  readingPick,
  readWritingOf,
  type ReadingPick,
} from '@/lib/page-notes/reading-pick';

const CommentIcon = lucideGlyph(lucideMessageSquare, 16);
const ActionIcon = lucideGlyph(lucideCircleCheck, 16);

type NoteKind = 'comment' | 'action';
type Shown = { x: number; y: number; below: boolean };

const apple = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// A note on the words picked in `writing`, through the editor's own writing (useArticles addReadingNote).
function addOn(
  store: ReturnType<typeof useEditorChromeStore>,
  kind: NoteKind,
  writing: HTMLElement,
): boolean {
  const flow = writing.dataset.articleFlow;
  const add = store.get().pagesMode.articles?.addReadingNote;
  return !!flow && !!add && add(flow, kind);
}

export function ReadingNoteBar() {
  const store = useEditorChromeStore();
  const takePart = useEditorChrome((s) => s.can.takePart);
  const [shown, setShown] = useState<Shown | null>(null);
  // The press that picked the words, so a touch's words are left to the docked menu.
  const pointer = useRef('mouse');

  useEffect(() => {
    if (!takePart) return;
    const note = (kind: NoteKind, writing: HTMLElement, from: 'menu' | 'key'): void => {
      setShown(null);
      if (!addOn(store, kind, writing)) return;
      if (from === 'menu') track('UI', 'Used', 'ReadingNoteMenu');
      else track('UI', 'Used', 'ReadingNoteKey');
    };
    const canNote = (writing: HTMLElement): boolean => {
      const sel = document.getSelection();
      if (!store.get().can.takePart || !sel || sel.rangeCount === 0) return false;
      const range = sel.getRangeAt(0);
      return readWritingOf(range) === writing && !inNoNoteSpot(range);
    };
    const unregister = setSelectionNoteEntry({
      canNote,
      note: (kind, writing) => note(kind, writing, 'menu'),
    });

    let frame = 0;
    const place = (pick: ReadingPick | null) => {
      if (!pick) return setShown(null);
      setShown(noteBarSpot(pick, { width: window.innerWidth, height: window.innerHeight }));
    };
    const onPointerDown = (e: PointerEvent) => {
      pointer.current = e.pointerType || 'mouse';
      // A press on the bar keeps it (its buttons act on the words); anywhere else lets it go until the next pick.
      if (!(e.target instanceof Element && e.target.closest('[data-reading-note-bar]')))
        setShown(null);
    };
    const onPointerUp = (e: PointerEvent) => {
      if ((e.pointerType || 'mouse') === 'touch') return;
      cancelAnimationFrame(frame);
      // After the browser has settled the words a double or triple click picks.
      frame = requestAnimationFrame(() => place(readingPick(document.getSelection())));
    };
    const onSelection = () => {
      // The words going take the bar with them; new words wait for the press to let go.
      if (!readingPick(document.getSelection())) setShown(null);
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setShown((was) => {
          if (!was) return was;
          const pick = readingPick(document.getSelection());
          if (!pick || pick.last.bottom < 0 || pick.first.top > window.innerHeight) return null;
          return noteBarSpot(pick, { width: window.innerWidth, height: window.innerHeight });
        }),
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setShown(null);
      const kind = noteKeyOf(e, apple());
      if (!kind) return;
      const pick = readingPick(document.getSelection());
      if (!pick) return;
      e.preventDefault();
      note(kind, pick.writing, 'key');
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('selectionchange', onSelection);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      unregister();
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('selectionchange', onSelection);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
      setShown(null);
    };
  }, [takePart, store]);

  if (!shown || !takePart) return null;
  const press = (kind: NoteKind) => {
    const pick = readingPick(document.getSelection());
    setShown(null);
    if (pick && addOn(store, kind, pick.writing)) track('UI', 'Used', 'ReadingNoteBar');
  };
  return createPortal(
    <div
      role="toolbar"
      aria-label="Comment on these words"
      data-reading-note-bar=""
      data-below={shown.below ? '' : undefined}
      style={{ left: shown.x, top: shown.y }}
      className={`fixed z-50 font-sans motion-safe:animate-fade-in ${TOOLBAR_CARD}`}
      // A press here must not take the words: the buttons act on them.
      onMouseDown={(e) => e.preventDefault()}
    >
      <NoteBarButton
        kind="comment"
        label="Comment"
        keys="Mod-Alt-m"
        description="Start a thread on these words."
        onPress={() => press('comment')}
      >
        <CommentIcon />
      </NoteBarButton>
      <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />
      <NoteBarButton
        kind="action"
        label="Add Action"
        keys="Mod-Alt-a"
        description="Give someone an action on these words."
        onPress={() => press('action')}
      >
        <ActionIcon />
      </NoteBarButton>
    </div>,
    document.body,
  );
}

// A labelled button, tinted in its note's colour on hover and press (indigo for a comment, emerald for an action;
// article-pages.md "Two looks"), the brand ring on focus. 36 px tall, its press area 44 px on a coarse pointer.
function NoteBarButton({
  kind,
  label,
  keys,
  description,
  onPress,
  children,
}: {
  kind: NoteKind;
  label: string;
  keys: string;
  description: string;
  onPress: () => void;
  children: ReactNode;
}) {
  const tone =
    kind === 'comment'
      ? 'hover:bg-indigo-50 hover:text-indigo-700 active:bg-indigo-100 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-200 [&_svg]:text-indigo-600 dark:[&_svg]:text-indigo-300'
      : 'hover:bg-emerald-50 hover:text-emerald-800 active:bg-emerald-100 dark:hover:bg-emerald-500/15 dark:hover:text-emerald-200 [&_svg]:text-emerald-700 dark:[&_svg]:text-emerald-300';
  const name = `${label} (${keyLabel(keys)})`;
  return (
    <HoverCard title={name} description={description}>
      <button
        type="button"
        aria-label={name}
        data-reading-note={kind}
        onClick={onPress}
        className={`relative flex h-9 shrink-0 cursor-pointer touch-target-packed items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-slate-700 transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 motion-reduce:transition-none dark:text-slate-200 ${tone}`}
      >
        {children}
        {label}
      </button>
    </HoverCard>
  );
}
