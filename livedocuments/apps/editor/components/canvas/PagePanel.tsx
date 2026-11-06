'use client';

// A page's panel (docs/specs/007-editor/pages-mode.md "page panel"): opened from the cog
// above the page's top-right corner, in screen space so it reads at one size whatever the zoom.
// Its name, then its Page section (size, orientation; absent where the page has neither), then the
// page's actions. A page's Background, an infographic or slide page's Layouts, and an article's Style
// and Text sit beside its cog on the title bar, never here too. It closes on an outside press, Escape, or the canvas
// panning or zooming under it (it would no longer sit by its cog).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  PAGE_NAME_MAX,
  pageHasOrientation,
  pageSizeChoices,
  type LaidOutPage,
} from '@livedocuments/document';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DuplicateIcon,
  SplitPagesIcon,
  Tooltip,
  TrashIcon,
  useClickOutside,
  useEscape,
  Portal,
  lucideGlyph,
} from '@livedocuments/ui';
import { lucideLock, lucideLockOpen } from '@liveworkspace/icons/lucide';
import { BottomSheet } from '@liveworkspace/workbench/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@liveworkspace/workbench/lib/clamp-to-viewport';
import type { PageEdits } from '@/hooks/editor/usePagesMode';
import { useCardOverflow } from '@/lib/flashcard-overflow-store';
import { cardSplitLabel } from '@/lib/flashcard-split';
import { OrientationSection, SizeSection } from './page-panel-sections';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

const LockIcon = lucideGlyph(lucideLock, 16);
const UnlockIcon = lucideGlyph(lucideLockOpen, 16);
import type { HelpArticleKey } from '@/lib/help-articles';

const WIDTH = 304;
const GAP = 6;
// The sheets' own ease (CanvasPages).
const PAGE_EASE_MS = 200;

// The panel's one section (the request API's `tab`, kept so a caller still names what it opens).
export type PagePanelTab = 'page';

/** Whether the page has a size or an orientation to choose: its Page section shows only then. */
export function pageHasPageSection(page: LaidOutPage): boolean {
  return pageSizeChoices(page).length > 1 || pageHasOrientation(page);
}

export function PagePanel({
  page,
  count,
  heldByLock = false,
  getAnchor,
  titleName,
  edit,
  onClose,
  showMe,
}: {
  page: LaidOutPage;
  // The page's Show Me, which heads the panel beside Help on its kind's article (docs/specs/007-editor/show-me.md,
  // pages-tour.md "Where it appears").
  showMe?: { button: ReactNode; article: HelpArticleKey } | undefined;
  count: number;
  // Another page of this page's article is locked (isArticleLocked): its shared edits are held.
  heldByLock?: boolean;
  // The cog the panel hangs from, looked up when placed.
  getAnchor: () => HTMLElement | undefined;
  // An article page's or card's article title: its name until it is given one of its own, so the
  // name field shows it as its placeholder (typing a name still overrides it).
  titleName?: string | undefined;
  edit: PageEdits;
  onClose: (restoreFocus: boolean) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const mobile = useIsMobileViewport();
  const pageSection = pageHasPageSection(page);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // The anchor lookup is a fresh closure each render: read through a ref so placing stays stable.
  const anchorRef = useRef(getAnchor);
  useLayoutEffect(() => {
    anchorRef.current = getAnchor;
  });
  const place = useCallback(() => {
    const el = anchorRef.current();
    if (!el || !el.isConnected) return;
    const a = el.getBoundingClientRect();
    const h = panel.current?.offsetHeight ?? 0;
    // Beside the page (right of its cog, so the sheet stays in view for the previews) while
    // there is room; else right-aligned under the cog.
    const beside = a.right + GAP + WIDTH + EDGE <= window.innerWidth;
    const left = beside
      ? a.right + GAP
      : Math.max(EDGE, Math.min(a.right - WIDTH, window.innerWidth - WIDTH - EDGE));
    const want = beside ? a.top : a.bottom + GAP;
    // As high as the window needs to fit it (it then scrolls).
    const top = Math.max(EDGE, Math.min(want, window.innerHeight - h - EDGE));
    setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
  }, []);
  useLayoutEffect(() => {
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [place]);
  // The page moved or changed size: follow its cog once the sheet has eased into place.
  const { x, y, width } = page.rect;
  useEffect(() => {
    const t = window.setTimeout(place, PAGE_EASE_MS + 20);
    return () => window.clearTimeout(t);
  }, [place, x, y, width]);

  // Focus moves into the panel as it opens, so a keyboard user lands in it, not at the far end of
  // the page it is portalled after.
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);

  // A press in a colour popover (portalled out of the panel) is the panel's own.
  useClickOutside(
    panel,
    () => onClose(false),
    true,
    // The tour's card too: a tour step opened the panel, and pressing Next or Back is not leaving it.
    '[data-page-panel-trigger], [data-anchored-popover], [data-tour-popover]',
  );
  // Escape inside a colour popover closes the popover only.
  useEscape(
    () => {
      if (document.activeElement?.closest('[data-anchored-popover]')) return;
      onClose(true);
    },
    { capture: true, stopPropagation: true },
  );
  // A wheel over the canvas pans or zooms it away from the cog: the panel goes with the gesture.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.target instanceof Node && panel.current?.contains(e.target)) return;
      onClose(false);
    };
    window.addEventListener('wheel', onWheel, { capture: true, passive: true });
    return () => window.removeEventListener('wheel', onWheel, { capture: true });
  }, [onClose]);
  const placeLabel = `Page ${page.index + 1}`;
  const title = page.name || titleName || (count > 1 ? placeLabel : 'Page');
  // A locked page's panel says so, its name and sections unavailable (docs/specs/007-editor/
  // pages-mode.md "Locking a page"); moving and duplicating it still work. A page of an
  // article another of whose pages is locked is held too, all but its own name.
  const selfLocked = page.locked === true;
  const locked = selfLocked || heldByLock;
  const body = (
    <>
      {locked ? (
        <p
          role="status"
          className="mx-3 mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-500/15 dark:text-amber-100"
        >
          {selfLocked
            ? mobile
              ? 'This page is locked. Unlock it below to change it.'
              : 'This page is locked. Unlock it beside the cog to change it.'
            : "A page of this article is locked. Unlock it to change the article's pages."}
        </p>
      ) : null}
      {showMe ? (
        <div className="flex items-center justify-end gap-0.5 px-2 pt-1.5">
          {showMe.button}
          <HelpArticleLink article={showMe.article} variant="labelled" />
        </div>
      ) : null}
      <div inert={selfLocked} className={selfLocked ? 'opacity-50' : undefined}>
        <NameField
          key={page.id}
          name={page.name ?? ''}
          placeholder={titleName ?? (count > 1 ? placeLabel : 'Untitled page')}
          placeholderIsName={!!titleName}
          onRename={(name) => edit.rename(page.id, name)}
        />
      </div>
      <div inert={locked} className={locked ? 'opacity-50' : undefined}>
        {pageSection ? (
          <>
            <SizeSection page={page} onSize={(size) => edit.setSize(page.id, size)} />
            <OrientationSection
              page={page}
              onOrientation={(o) => edit.setOrientation(page.id, o)}
            />
          </>
        ) : null}
      </div>
      <PageActions
        page={page}
        locked={locked}
        edit={edit}
        lockHere={mobile}
        onClose={() => onClose(false)}
      />
    </>
  );
  const label = `${title} settings`;
  // On a phone the panel is a bottom sheet (swipe down to close), the page above it.
  if (mobile) {
    return (
      <BottomSheet
        ref={panel}
        role="dialog"
        aria-label={label}
        data-page-panel
        // The page's own panel: working in it keeps an article's toolbar on its page.
        data-article-keep-active=""
        tabIndex={-1}
        onClose={() => onClose(false)}
        zClassName="z-[var(--z-overlay)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {body}
      </BottomSheet>
    );
  }
  return (
    <Portal>
      <div
        ref={panel}
        role="dialog"
        aria-label={label}
        data-page-panel
        // The page's own panel: working in it keeps an article's toolbar on its page.
        data-article-keep-active=""
        tabIndex={-1}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-overlay)] flex outline-none animate-fade-in flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white pb-1 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
        style={{
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          width: WIDTH,
          maxHeight: `calc(100vh - ${2 * EDGE}px)`,
        }}
      >
        {body}
      </div>
    </Portal>
  );
}

// The page's name, renamed as you leave the field, press Enter or close the panel (an outside
// press closes it before the field would blur, so the close commits it too).
function NameField({
  name,
  placeholder,
  placeholderIsName = false,
  onRename,
}: {
  name: string;
  placeholder: string;
  // The placeholder is the name the page goes by (its article's title), so it reads in the name's
  // own ink rather than as an empty field's hint.
  placeholderIsName?: boolean;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  // A rename from elsewhere (undo, a collaborator) replaces the field's text.
  const [shown, setShown] = useState(name);
  if (shown !== name) {
    setShown(name);
    setDraft(name);
  }
  const latest = useRef({ draft, name, onRename });
  useEffect(() => {
    latest.current = { draft, name, onRename };
  });
  const commit = () => {
    const { draft: d, name: n, onRename: rename } = latest.current;
    if (d.trim() !== n) rename(d);
  };
  useEffect(() => commit, []);
  return (
    <div className="border-b border-slate-100 px-3 pb-2.5 pt-3 dark:border-slate-800">
      <input
        type="text"
        value={draft}
        maxLength={PAGE_NAME_MAX}
        placeholder={placeholder}
        aria-label="Page name"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={`w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-slate-900 outline-none transition ${placeholderIsName ? 'placeholder:font-semibold placeholder:text-slate-900 dark:placeholder:text-slate-100' : 'placeholder:font-medium placeholder:text-slate-400'} hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:bg-slate-900 dark:focus:ring-brand-500/30`}
      />
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        disabled={!onClick}
        onClick={onClick}
        className={`flex h-8 flex-1 items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

// Duplicate, move left, move right, delete: one row of icon buttons, each disabled where it has
// nothing to do (the row's ends, the page limit, the last page). On an article page each acts on
// the whole article, and says so.
function PageActions({
  page,
  locked,
  edit,
  lockHere = false,
  onClose,
}: {
  page: LaidOutPage;
  // The page, or its article, is held by a lock: no split and no delete.
  locked: boolean;
  // A phone's bar has no padlock ("Beside the cog"): Lock or Unlock sits here instead.
  lockHere?: boolean;
  edit: PageEdits;
  onClose: () => void;
}) {
  const { duplicatePage, removePage } = edit;
  const card = page.kind === 'flashcard';
  const noun = card ? 'card' : page.flow ? 'article' : page.kind === 'slide' ? 'slide' : 'page';
  // A too-long card offers Split Onto a New Card (docs/specs/007-editor/flashcards.md "Never flows").
  const overflow = useCardOverflow(card ? page.flow : undefined);
  const split = card && overflow && !locked ? edit.cardSplitState(page.id) : 'fits';
  return (
    // Under an empty body (a page with no size or turn to choose) the name field's hairline already
    // parts it from the name, so it draws none of its own: never two lines in a row.
    <div className="mt-1 flex gap-1 border-t border-slate-100 px-2 pt-1.5 dark:border-slate-800 [:empty+&]:mt-0 [:empty+&]:border-t-0">
      {split !== 'fits' && (
        <ActionButton
          label={cardSplitLabel(split)}
          onClick={split === 'ready' ? () => edit.splitCard(page.id) : undefined}
        >
          <SplitPagesIcon className="h-4 w-4" />
        </ActionButton>
      )}
      {page.size === 'fit' && (
        <ActionButton
          label="Split Into Pages"
          onClick={!locked ? () => edit.splitPage(page.id) : undefined}
        >
          <SplitPagesIcon className="h-4 w-4" />
        </ActionButton>
      )}
      <ActionButton
        label={`Duplicate ${noun}`}
        onClick={
          duplicatePage && edit.canDuplicate(page.id) ? () => duplicatePage(page.id) : undefined
        }
      >
        <DuplicateIcon className="h-4 w-4" />
      </ActionButton>
      <ActionButton
        label={`Move ${noun} left`}
        onClick={edit.canMove(page.id, -1) ? () => edit.movePage(page.id, -1) : undefined}
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </ActionButton>
      <ActionButton
        label={`Move ${noun} right`}
        onClick={edit.canMove(page.id, 1) ? () => edit.movePage(page.id, 1) : undefined}
      >
        <ChevronRightIcon className="h-4 w-4" />
      </ActionButton>
      {lockHere ? (
        <ActionButton
          label={page.locked ? 'Unlock page' : 'Lock page'}
          onClick={() => edit.setLocked(page.id, !page.locked)}
        >
          {page.locked ? <UnlockIcon /> : <LockIcon />}
        </ActionButton>
      ) : null}
      <ActionButton
        label={`Delete ${noun}`}
        onClick={
          removePage && !locked
            ? () => {
                onClose();
                removePage(page.id);
              }
            : undefined
        }
      >
        <TrashIcon className="h-4 w-4" />
      </ActionButton>
    </div>
  );
}
