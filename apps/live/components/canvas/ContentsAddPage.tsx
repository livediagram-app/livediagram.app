'use client';

// Contents' Add Page (docs/specs/007-editor/pages-mode.md "Contents"): the footer both of its homes
// (PageContentsPanel, PageContentsSidebar) end on.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MAX_PAGES, type PageKind } from '@livediagram/document';
import {
  lucideFileText,
  lucidePanelsTopLeft,
  lucidePlus,
  lucideShapes,
} from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip } from '@livediagram/ui';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import type { PageContents } from '@/hooks/ui/usePageContents';

const PlusIcon = lucideGlyph(lucidePlus, 14);
const InfographicIcon = lucideGlyph(lucidePanelsTopLeft, 16);
const ArticleIcon = lucideGlyph(lucideFileText, 16);
const LogoIcon = lucideGlyph(lucideShapes, 16);

const ADD_KINDS: readonly { kind: PageKind; name: string; icon: () => React.ReactNode }[] = [
  { kind: 'infographic', name: 'Infographic', icon: () => <InfographicIcon /> },
  { kind: 'slide', name: 'Slide', icon: () => <SlideDeckIcon /> },
  { kind: 'article', name: 'Article', icon: () => <ArticleIcon /> },
  { kind: 'logo', name: 'Logo', icon: () => <LogoIcon /> },
];

// How long the kinds stay up after the pointer leaves the button and the popover, in ms.
const ADD_PAGE_CLOSE_MS = 150;
// The room between the button and the kinds above it, px.
const MENU_GAP = 4;

// Where the kinds stand: above the button and as wide as it, on the page rather than in the panel, as the
// Contents popover clips what overflows it (a short list left only its last two kinds showing).
export function addMenuPlace(
  button: { left: number; top: number; width: number },
  viewportHeight: number,
): { left: number; width: number; bottom: number } {
  return { left: button.left, width: button.width, bottom: viewportHeight - button.top + MENU_GAP };
}

// An Editor's footer: one full-width Add Page button. Resting the pointer on it (or pressing it, or
// Up from it) opens the four kinds in a popover above it, as wide as the button, the last page's kind
// first and highlighted; a press adds that kind after the last page. At the page limit the button is
// disabled, its Tooltip naming the limit.
export function ContentsAddPage({ contents }: { contents: PageContents }) {
  const { canAdd, add, full, lastKind } = contents;
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<ReturnType<typeof addMenuPlace> | null>(null);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => () => clearTimeout(closing.current ?? undefined), []);
  // Measured once as it opens: the panel does not move under an open menu.
  useLayoutEffect(() => {
    if (!open || !trigger.current) return setPlace(null);
    setPlace(addMenuPlace(trigger.current.getBoundingClientRect(), window.innerHeight));
  }, [open]);
  if (!canAdd) return null;
  const kinds = lastKind
    ? [
        ...ADD_KINDS.filter((k) => k.kind === lastKind),
        ...ADD_KINDS.filter((k) => k.kind !== lastKind),
      ]
    : ADD_KINDS;
  const show = () => {
    if (full) return;
    clearTimeout(closing.current ?? undefined);
    setOpen(true);
  };
  // A moment's grace, so the pointer can cross from the button to the popover.
  const hide = () => {
    clearTimeout(closing.current ?? undefined);
    closing.current = setTimeout(() => setOpen(false), ADD_PAGE_CLOSE_MS);
  };
  const items = () => [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
  const button = (
    <button
      ref={trigger}
      type="button"
      disabled={full}
      aria-haspopup="menu"
      aria-expanded={open}
      data-contents-add=""
      onClick={() => (open ? setOpen(false) : show())}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' || full) return;
        e.preventDefault();
        show();
        requestAnimationFrame(() => items()[0]?.focus());
      }}
      className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40 ${
        open
          ? 'border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
          : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100'
      }`}
    >
      <PlusIcon />
      Add Page
    </button>
  );
  return (
    <div
      className="relative border-t border-slate-100 p-3 dark:border-slate-800"
      // React's enter and leave follow the component tree, so the portalled kinds count as inside.
      onMouseEnter={show}
      onMouseLeave={hide}
      onBlur={(e) => {
        const to = e.relatedTarget as Node | null;
        if (!e.currentTarget.contains(to) && !menu.current?.contains(to)) setOpen(false);
      }}
    >
      {open && place
        ? createPortal(
            <div
              ref={menu}
              role="menu"
              aria-label="Add a page"
              data-contents-add-menu=""
              // Floating UI: the canvas's capture-phase pointerdown leaves its presses alone.
              data-floating-panel=""
              // Inside its popover for the outside-press that closes it (MovablePanel).
              data-menu-surface=""
              onKeyDown={(e) => {
                const all = items();
                const at = all.indexOf(document.activeElement as HTMLElement);
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setOpen(false);
                  trigger.current?.focus();
                } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const step = e.key === 'ArrowDown' ? 1 : -1;
                  all[(at + step + all.length) % all.length]?.focus();
                }
              }}
              style={place}
              className="fixed z-[var(--z-popover)] flex flex-col gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40 motion-safe:transition-[opacity,translate] motion-safe:duration-micro motion-safe:starting:translate-y-1 motion-safe:starting:opacity-0"
            >
              {kinds.map(({ kind, name, icon }) => (
                <button
                  key={kind}
                  type="button"
                  role="menuitem"
                  aria-label={`Add a ${name} page`}
                  onClick={() => {
                    setOpen(false);
                    add?.(kind);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
                    kind === lastKind
                      ? 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-100 dark:hover:bg-brand-500/25'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {icon()}
                  {name}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
      {full ? <Tooltip label={`A tab holds up to ${MAX_PAGES} pages`}>{button}</Tooltip> : button}
    </div>
  );
}
