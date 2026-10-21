'use client';

// The name rides in the menu box (docs/specs/026-plan/plan-board.md "The name rides in the menu box"): while a
// maximised or tab-filling board, view or Sheet holds the top row in its header band, its title moves out of its header
// into the Toolbar layout's menu box, after the mode menu. The title is portalled, not copied, so it is the same
// component with the same state: a double-click on it still reaches its header's rename (React events follow the
// component tree through a portal). The slot is a module store, like maximised-plan.ts.
//
// Whether a header is in a band is read off the page: maximising moves the element's own DOM into the cover
// (MaximisedPlanLayer, FilledTabLayer) rather than rendering it there, so no React context reaches it. The cover says
// when its band comes or goes (`announceHeaderBand`), and each name checks for `[data-header-band]` above it then.
import {
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  activeTabRenameId,
  useActiveTabName,
  useActiveTabRename,
  type TabRename,
} from '@/hooks/editor/active-tab-name-store';
import { NAME_MAX_LENGTH } from '@liveplanner/document';
import { createListeners } from '@/lib/listeners';

let slot: HTMLElement | null = null;
const listeners = createListeners();

// The menu box's slot mounting (an element) or going (null).
export function setMenuNameSlot(el: HTMLElement | null): void {
  if (el === slot) return;
  slot = el;
  listeners.notify();
}

const getSlot = () => slot;
const noSlot = () => null;
export function useMenuNameSlot(): HTMLElement | null {
  return useSyncExternalStore(listeners.subscribe, getSlot, noSlot);
}

// The cover's band came or went (CanvasCover): every name looks again for a band above it.
let bandEpoch = 0;
const bandListeners = new Set<() => void>();
export function announceHeaderBand(): void {
  bandEpoch++;
  for (const l of bandListeners) l();
}
function subscribeBand(listener: () => void): () => void {
  bandListeners.add(listener);
  return () => bandListeners.delete(listener);
}
const getEpoch = () => bandEpoch;

// The selector CanvasCover marks its element's box with while it has a band.
const HEADER_BAND_SELECTOR = '[data-header-band]';

// The slot in the menu box: a hairline before it, the chrome's own ink, hidden while it holds nothing. Its width is
// left out of the room the band needs (canvas-layer-insets MENU_NAME_SLOT_SELECTOR).
export function MenuNameSlot() {
  return (
    <span
      ref={setMenuNameSlot}
      data-menu-name-slot=""
      className="ml-0.5 flex min-w-0 items-center gap-1.5 border-l border-slate-200 pl-2.5 pr-2 text-slate-800 empty:hidden dark:border-slate-700 dark:text-slate-100"
    />
  );
}

// The open tab's name in the menu box (docs/specs/007-editor/toolbar-layout.md "The tab's name"), in every mode on a
// desktop, as a board's name rides there: right after the slot, and hidden by CSS while the slot holds an element's
// name (a board, Sheet or view filling the tab or maximised), so the box never shows two.
export function TabNameInBox() {
  const name = useActiveTabName();
  const rename = useActiveTabRename();
  if (!name) return null;
  // Keyed by the tab it renames: another tab opening drops a draft begun on this one.
  return <TabName key={rename?.tabId ?? ''} name={name} rename={rename} />;
}

function TabName({ name, rename }: { name: string; rename: TabRename | null }) {
  const [draft, setDraft] = useState<string | null>(null);
  const hide = '[[data-menu-name-slot]:not(:empty)+&]:hidden';
  const frame = `ml-0.5 border-l border-slate-200 pl-2.5 pr-2 text-slate-800 dark:border-slate-700 dark:text-slate-100 ${hide}`;
  if (draft !== null && rename) {
    const save = () => {
      const next = draft.trim();
      setDraft(null);
      // Saved only onto the tab it was begun on, should that tab no longer be the open one.
      if (activeTabRenameId() !== rename.tabId) return;
      if (next && next !== name) rename.rename(next);
    };
    return (
      <span data-tab-name-in-box="" className={`flex items-center ${frame}`}>
        <input
          autoFocus
          data-keeps-escape
          aria-label="Tab name"
          value={draft}
          maxLength={NAME_MAX_LENGTH}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') setDraft(null);
          }}
          className="w-48 rounded-md border border-brand-400 bg-transparent px-1.5 py-0.5 text-[14px] font-normal leading-tight outline-none"
        />
      </span>
    );
  }
  return (
    <span
      data-tab-name-in-box=""
      // A click (a tap) renames the tab, for someone who may.
      onClick={rename ? () => setDraft(name) : undefined}
      className={`${frame} ${rename ? 'cursor-text' : ''} ${IN_BOX_TITLE_CLASS}`}
    >
      {name}
    </span>
  );
}

// The element's name: in the menu box while its header holds the top row (and the box is there), in place otherwise.
// `render` is told which, so the name can take the box's size and ink.
// Whether the element holding `marker` is in a header band, looked at again whenever a band comes or goes.
export function useInHeaderBand(): [RefObject<HTMLSpanElement | null>, boolean] {
  const target = useMenuNameSlot();
  const epoch = useSyncExternalStore(subscribeBand, getEpoch, getEpoch);
  const marker = useRef<HTMLSpanElement>(null);
  const [inBand, setInBand] = useState(false);
  useLayoutEffect(() => {
    setInBand(!!marker.current?.closest(HEADER_BAND_SELECTOR));
  }, [epoch, target]);
  return [marker, inBand];
}

export function InMenuBox({ render }: { render: (inBox: boolean) => ReactNode }) {
  const target = useMenuNameSlot();
  // A marker that stays in the header, so the check reads where the header is, whichever way the name went.
  const [marker, inBand] = useInHeaderBand();
  const inBox = inBand && !!target;
  return (
    <>
      <span ref={marker} hidden />
      {inBox ? createPortal(render(true), target) : render(false)}
    </>
  );
}

// The name's look in the box: the chrome's text at regular weight (never bold), a little smaller than a header's,
// truncating.
export const IN_BOX_TITLE_CLASS =
  'min-w-0 max-w-[16rem] truncate text-[14px] font-normal leading-tight';
