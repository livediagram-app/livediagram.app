'use client';

import { useCallback, useRef, useState, type CSSProperties } from 'react';
import { lucidePanelsTopLeft, lucideSettings } from '@livediagram/icons/lucide';
import {
  ILLUSTRATE_PAGE_GAP,
  pageLabel,
  type LaidOutPage,
  type PageKind,
} from '@livediagram/document';
import { HoverCard, lucideGlyph, PlusIcon, Tooltip } from '@livediagram/ui';
import type { IllustratePagesView } from '@/hooks/editor/useIllustratePages';
import { InfographicLayoutPreview } from './InfographicLayoutPreview';
import {
  laidOutUnits,
  usePageReorderDrag,
  type PageReorder,
} from '@/hooks/canvas/usePageReorderDrag';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { pageSheetStyle, withBackgroundPatch } from '@/lib/illustrate-page-paint';
import { IllustratePagePanel, type PagePanelTab, type PagePreview } from './IllustratePagePanel';
import { AddPagePopover } from './AddPagePopover';

const CogIcon = lucideGlyph(lucideSettings, 16);
const LayoutIcon = lucideGlyph(lucidePanelsTopLeft, 14);

// Screen px: the cog's width plus a gap, and the narrowest a label is still worth showing.
const COG_ROOM = 32;
const LABEL_MIN = 40;
// The empty page's layout button beside the cog: with its words, or just its icon.
const INVITE_WIDE = 150;
const INVITE_ICON = 30;

// Held at one screen size whatever the zoom: counter-scaled about the given corner.
const steady = (zoom: number, origin: string): CSSProperties => ({
  transform: `scale(${1 / zoom})`,
  transformOrigin: origin,
});

// Illustrate mode's pages (docs/specs/007-editor/illustrate-pages.md): sheets in a row, painted
// in canvas space under every element so they pan and zoom with them, on the tab's own canvas,
// which stays the surround. Each sheet wears its own background (a hover in its panel previews
// one). A change of size, turn or removal eases the sheets to their new places. The sheets take no
// pointer events: a press on one is a press on the canvas. Each page's label sits above its
// top-left corner (a press frames the page) and its settings cog above its top-right; the
// add-a-page button follows the last page; all held at one screen size.
export function IllustratePages({
  view,
  zoom,
  bare = false,
}: {
  view: IllustratePagesView;
  zoom: number;
  // The sheets alone, without their title bars or the add button (zen, presenting).
  bare?: boolean;
}) {
  const { pages, focusPage } = view;
  const edit = bare ? undefined : view.edit;
  // The open panel's page and the tab it opened on. Its cog is looked up live (cogs), so a cog
  // remounted by zen or a role change is the one the panel hangs from.
  const [opened, setOpened] = useState<{ id: string; tab: PagePanelTab } | null>(null);
  const cogs = useRef(new Map<string, HTMLButtonElement>());
  const mobile = useIsMobileViewport();
  const [preview, setPreview] = useState<PagePreview>(null);
  const last = pages[pages.length - 1]!;
  // A label dragged sideways reorders the pages (usePageReorderDrag).
  const drag = usePageReorderDrag({ pages, zoom, onMove: edit?.movePageTo });
  const openId = opened?.id ?? null;
  const open = edit && opened ? pages.find((p) => p.id === opened.id) : undefined;
  // The panel goes with its page, and with the right to edit (zen, a lock, a view role): it never
  // comes back on its own, hung from a cog that is no longer there.
  if (opened && !open) setOpened(null);
  const close = useCallback(
    (restoreFocus: boolean) => {
      if (restoreFocus && opened) cogs.current.get(opened.id)?.focus();
      setOpened(null);
    },
    [opened],
  );
  const toggle = (id: string) => setOpened((o) => (o?.id === id ? null : { id, tab: 'page' }));
  // The empty page's own invitation opens its panel on Layouts.
  const openLayouts = (id: string) => setOpened({ id, tab: 'layouts' });
  const anchorOf = useCallback((id: string) => cogs.current.get(id), []);
  return (
    <>
      {pages.map((page) => {
        const background =
          preview?.pageId === page.id ? withBackgroundPatch(page, preview.patch) : page.background;
        const label = pageLabel(page, page.index, pages.length);
        // The label fits the page's on-screen width, less the cog's room; too narrow, it hides.
        // The title bar's room on screen: the page's width at this zoom. The cog takes its corner;
        // an empty page's layout button sits beside it, with its words while there is room for
        // them and the label, as an icon while there is room for that, else not at all.
        const room = page.rect.width * zoom;
        // Layouts are for infographic pages: a document page never invites one.
        const empty = !!edit && !page.flow && edit.contentCount(page.id) === 0;
        const invite = !empty
          ? null
          : !mobile && room >= INVITE_WIDE + COG_ROOM + LABEL_MIN * 2
            ? 'wide'
            : room >= INVITE_ICON + COG_ROOM + LABEL_MIN
              ? 'icon'
              : null;
        const labelRoom =
          room -
          (edit ? COG_ROOM : 0) -
          (invite === 'wide' ? INVITE_WIDE : invite === 'icon' ? INVITE_ICON : 0);
        return (
          <div
            key={page.id}
            data-illustrate-page={page.orientation}
            className={`pointer-events-none absolute transition-[left,top,width,height,opacity] duration-200 ease-out motion-reduce:transition-none ${
              drag.reorder?.pageIds.includes(page.id) ? 'opacity-60' : ''
            } ${
              background?.fill
                ? ''
                : 'bg-white text-slate-900/10 dark:bg-slate-900 dark:text-white/10'
            }`}
            style={{
              left: page.rect.x,
              top: page.rect.y,
              width: page.rect.width,
              height: page.rect.height,
              boxShadow: '0 1px 3px rgb(15 23 42 / 0.14), 0 12px 32px rgb(15 23 42 / 0.12)',
              ...pageSheetStyle(background),
            }}
          >
            <div
              className={`absolute left-0 flex items-center ${labelRoom < LABEL_MIN || bare ? 'hidden' : ''}`}
              style={{
                bottom: '100%',
                marginBottom: 6 / zoom,
                maxWidth: labelRoom,
                ...steady(zoom, 'bottom left'),
              }}
            >
              <HoverCard
                title={label}
                description="Press to fit this page to the screen."
                className="min-w-0 max-w-full"
              >
                <button
                  type="button"
                  {...drag.handlers(page.id)}
                  onClick={() => {
                    if (!drag.endsDrag()) focusPage(page.id);
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className={`pointer-events-auto block max-w-full truncate whitespace-nowrap rounded px-1 py-0.5 text-xs font-medium text-slate-500 transition hover:bg-white/80 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-100 ${
                    edit && pages.length > 1 ? 'cursor-grab active:cursor-grabbing' : ''
                  }`}
                >
                  {label}
                </button>
              </HoverCard>
            </div>
            {edit ? (
              <div
                className="absolute right-0 flex items-center gap-1"
                style={{ bottom: '100%', marginBottom: 6 / zoom, ...steady(zoom, 'bottom right') }}
              >
                {invite && openId !== page.id ? (
                  <LayoutInvite wide={invite === 'wide'} onOpen={() => openLayouts(page.id)} />
                ) : null}
                <PageCog
                  name={`${page.name ?? (pages.length > 1 ? `Page ${page.index + 1}` : 'Page')} settings`}
                  open={openId === page.id}
                  onToggle={() => toggle(page.id)}
                  cogRef={(el) => {
                    if (el) cogs.current.set(page.id, el);
                    else cogs.current.delete(page.id);
                  }}
                />
              </div>
            ) : null}
          </div>
        );
      })}
      {drag.reorder ? <ReorderMarker pages={pages} reorder={drag.reorder} zoom={zoom} /> : null}
      {edit?.addPage ? (
        <AddPageButton
          // Centred in a gap's width to the right of the last page, on the row's axis.
          x={last.rect.x + last.rect.width + ILLUSTRATE_PAGE_GAP / 2}
          zoom={zoom}
          onAdd={edit.addPage}
        />
      ) : null}
      {open && view.layoutPreview?.pageId === open.id ? (
        <InfographicLayoutPreview
          page={open}
          layout={view.layoutPreview.layout}
          tabFont={view.tabFont}
        />
      ) : null}
      {open && opened && edit ? (
        <IllustratePagePanel
          // One panel per page: switching cogs starts the next page's panel afresh, its pending
          // Replace and previews going with the last one.
          key={open.id}
          page={open}
          count={pages.length}
          getAnchor={() => anchorOf(open.id)}
          initialTab={opened.tab}
          themeBackgrounds={view.themeBackgrounds}
          edit={edit}
          onPreview={setPreview}
          onLayoutPreview={(layout) =>
            view.setLayoutPreview(layout ? { pageId: open.id, layout } : null)
          }
          onClose={close}
        />
      ) : null}
    </>
  );
}

// The + after the last page: opens "Add a page" (AddPagePopover) to choose the kind.
function AddPageButton({
  x,
  zoom,
  onAdd,
}: {
  x: number;
  zoom: number;
  onAdd: (kind: PageKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const getAnchor = useCallback(() => button.current, []);
  return (
    <div
      className="pointer-events-auto absolute transition-[left] duration-200 ease-out motion-reduce:transition-none"
      style={{ left: x, top: 0, transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
      // A press here is the button's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label="Add page">
        <button
          ref={button}
          type="button"
          aria-label="Add page"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-add-page-trigger
          onClick={() => setOpen((o) => !o)}
          className={`flex h-9 w-9 items-center justify-center rounded-full shadow-md ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
            open
              ? 'bg-brand-600 text-white ring-brand-600 dark:bg-brand-600'
              : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100'
          }`}
        >
          <PlusIcon />
        </button>
      </Tooltip>
      {open ? (
        <AddPagePopover
          getAnchor={getAnchor}
          onAdd={onAdd}
          onClose={(restoreFocus) => {
            setOpen(false);
            if (restoreFocus) button.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

// The cog that opens the page's panel (IllustratePagePanel).
function PageCog({
  name,
  open,
  onToggle,
  cogRef,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
  cogRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <div
      className="pointer-events-auto"
      // A press here is the cog's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label={name}>
        <button
          ref={cogRef}
          type="button"
          aria-label={name}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-page-panel-trigger
          onClick={() => onToggle()}
          className={`flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${
            open ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100' : ''
          }`}
        >
          <CogIcon />
        </button>
      </Tooltip>
    </div>
  );
}

// On an empty page, beside its cog: start it from a layout. Its words show on a wide screen with
// room in the title bar; on a phone, or when the page is small on screen, just the icon.
function LayoutInvite({ wide, onOpen }: { wide: boolean; onOpen: () => void }) {
  return (
    <div
      className="pointer-events-auto"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label="Start from a layout">
        <button
          type="button"
          aria-label="Start from a layout"
          onClick={onOpen}
          className="flex h-6 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <LayoutIcon />
          {wide ? (
            <span className="hidden whitespace-nowrap sm:inline">Start from a layout</span>
          ) : null}
        </button>
      </Tooltip>
    </div>
  );
}

// Where a dragged page will land: a bar in the gap at its slot, the pages' height, held at one
// screen width.
function ReorderMarker({
  pages,
  reorder,
  zoom,
}: {
  pages: readonly LaidOutPage[];
  reorder: PageReorder;
  zoom: number;
}) {
  const others = laidOutUnits(pages).filter((u) => !u.pageIds.includes(reorder.pageId));
  const before = others[reorder.slot - 1];
  const after = others[reorder.slot];
  const x = before
    ? before.rect.x + before.rect.width + ILLUSTRATE_PAGE_GAP / 2
    : after
      ? after.rect.x - ILLUSTRATE_PAGE_GAP / 2
      : 0;
  const top = Math.min(...pages.map((p) => p.rect.y));
  const bottom = Math.max(...pages.map((p) => p.rect.y + p.rect.height));
  return (
    <div
      aria-hidden
      data-page-reorder-marker
      className="pointer-events-none absolute rounded-full bg-brand-500"
      style={{ left: x - 2 / zoom, top, width: 4 / zoom, height: bottom - top }}
    />
  );
}
