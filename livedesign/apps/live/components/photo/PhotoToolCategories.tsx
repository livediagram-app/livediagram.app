'use client';

// The photo tools' categories in the palette strip (docs/specs/031-photo/photo-pages.md "The photo tools"): a button
// per category (Select, Paint, Retouch, Shapes) with its glyph and name, as the palette's category bar has
// them. A press opens its flyout in the category flyout's look: a header, a row per tool group (its glyph, name,
// line and key), and a footer saying what the pointed-at row is. A group of one tool takes it; a group of several
// opens its tools in a panel beside the flyout, as a card tile's presets do, unless the category lists it flat (Shapes:
// Rectangle, Ellipse and Line as rows of their own). Taking a tool closes both; so do a press
// outside them and Escape.
import { useEffect, useRef, useState } from 'react';
import { ChevronRightIcon, Portal } from '@livedesign/ui';
import { FlyoutHeader } from '@/components/palette/CategoryFlyout';
import {
  FLYOUT_CARD_PLATE,
  FlyoutFooter,
  flyoutCardClass,
  Kbd,
} from '@/components/palette/category-flyout-items';
import { TOOL_BLURBS } from '@/lib/photo-editor/option-guides';
import {
  GROUP_BLURBS,
  STRIP_CATEGORIES,
  type StripCategory,
} from '@/lib/photo-editor/tool-categories';
import { toolFlyout } from '@/lib/photo-editor/tool-flyout';
import {
  GROUP_KEYS,
  photoTools,
  TOOL_GROUPS,
  TOOL_NAMES,
  usePhotoTools,
  type PhotoToolId,
  type ToolGroup,
} from '@/lib/photo-editor/tool-state';
import { TOOL_ICONS } from './photo-icons';
import { takeTool } from './PhotoToolsRail';

const groupById = new Map(TOOL_GROUPS.map((g) => [g.id, g]));
// The flyout's and the side panel's widths, and the gap between them, px.
const FLYOUT_PX = 320;
const SIDE_PX = 280;
const GAP_PX = 8;

type Pointed = { name: string; text: string; shortcut?: string } | null;

/** Takes a tool from a category, its options left shut; the tool already in hand opens its options instead, as a
 *  pinned tool's button does. */
function pick(tool: PhotoToolId) {
  if (photoTools.get().tool === tool) return toolFlyout.open();
  takeTool(tool);
  toolFlyout.close();
}

function Row({
  icon,
  name,
  text,
  shortcut,
  active,
  opens,
  onPress,
  onPoint,
}: {
  icon: PhotoToolId;
  name: string;
  text: string;
  shortcut?: string;
  active: boolean;
  // Opens a side panel rather than taking a tool.
  opens: boolean;
  onPress: (el: HTMLElement) => void;
  onPoint: (el: HTMLElement) => void;
}) {
  const Icon = TOOL_ICONS[icon];
  return (
    <button
      type="button"
      role={opens ? undefined : 'menuitem'}
      aria-haspopup={opens ? 'menu' : undefined}
      aria-label={name}
      onClick={(e) => onPress(e.currentTarget)}
      onPointerEnter={(e) => onPoint(e.currentTarget)}
      onFocus={(e) => onPoint(e.currentTarget)}
      className={flyoutCardClass(active, false)}
    >
      <span aria-hidden className={FLYOUT_CARD_PLATE}>
        <span className="flex items-center justify-center transition-transform duration-micro group-hover:scale-110">
          <Icon />
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
          <span className="truncate">{name}</span>
          {shortcut ? <Kbd small>{shortcut}</Kbd> : null}
        </span>
        <span className="line-clamp-2 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
          {text}
        </span>
      </span>
      {opens ? (
        <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600" />
      ) : null}
    </button>
  );
}

const CARD =
  'fixed z-[var(--z-popover)] flex origin-top animate-dropdown-down flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/50';

function CategoryFlyoutCard({
  category,
  at,
  onClose,
}: {
  category: StripCategory;
  at: { left: number; top: number };
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const { tool, lastInGroup } = usePhotoTools();
  const [pointed, setPointed] = useState<Pointed>(null);
  // The group whose tools are open beside the flyout, and the row's top.
  const [side, setSide] = useState<{ group: ToolGroup; top: number; left: number } | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);
  const groups = category.groups.map((id) => groupById.get(id)!);
  const key = (g: ToolGroup) => GROUP_KEYS[g.id]?.toUpperCase();
  // Beside the flyout on its right where the window has room, else on its left; level with the row.
  const openSide = (g: ToolGroup, el: HTMLElement) => {
    const box = flyoutRef.current?.getBoundingClientRect();
    const left =
      box && window.innerWidth - box.right >= SIDE_PX + GAP_PX * 2
        ? box.right + GAP_PX
        : (box?.left ?? at.left) - GAP_PX - SIDE_PX;
    setSide({ group: g, top: el.getBoundingClientRect().top - 6, left: Math.max(8, left) });
  };
  // In a portal: the palette strip is scaled, which would carry fixed places off with it.
  return (
    <Portal>
      <div
        ref={flyoutRef}
        data-photo-category=""
        role="menu"
        aria-label={category.name}
        className={CARD}
        style={{ left: at.left, top: at.top, width: FLYOUT_PX }}
      >
        <FlyoutHeader
          icon={(() => {
            const I = TOOL_ICONS[category.icon];
            return <I />;
          })()}
          title={category.name}
          tagline={category.tagline}
          wrap
          count={groups.reduce((n, g) => n + g.tools.length, 0)}
        />
        <div className="flex flex-col gap-1 p-2.5" onPointerLeave={() => setPointed(null)}>
          {groups
            .flatMap((g): { g: ToolGroup; only: PhotoToolId | null }[] =>
              category.flat?.includes(g.id)
                ? g.tools.map((t) => ({ g, only: t }))
                : [{ g, only: null }],
            )
            .map(({ g, only }) => {
              const several = !only && g.tools.length > 1;
              const one = only ?? g.tools[0]!;
              const shown = several ? (lastInGroup[g.id] ?? g.tools[0]!) : one;
              const name = several ? g.name : TOOL_NAMES[one];
              const text = several ? (GROUP_BLURBS[g.id] ?? '') : (TOOL_BLURBS[one] ?? '');
              return (
                <Row
                  key={only ?? g.id}
                  icon={shown}
                  name={name}
                  text={text}
                  shortcut={key(g)}
                  active={!!tool && (only ? tool === only : g.tools.includes(tool))}
                  opens={several}
                  onPress={(el) => (several ? openSide(g, el) : (pick(one), onClose()))}
                  onPoint={(el) => {
                    setPointed({ name, text, shortcut: key(g) });
                    if (several) openSide(g, el);
                    else setSide(null);
                  }}
                />
              );
            })}
        </div>
        <FlyoutFooter
          item={pointed}
          hint="Press a tool to pick it up; press it again in the palette for its options."
          touchHint="Tap a tool to pick it up."
        />
      </div>
      {side ? (
        <div
          data-photo-category=""
          role="menu"
          aria-label={side.group.name}
          className={CARD}
          style={{ left: side.left, top: side.top, width: SIDE_PX }}
        >
          <div className="border-b border-slate-100 px-3.5 pb-2 pt-3 dark:border-slate-800">
            <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
              {side.group.name}
            </div>
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400">
              {GROUP_BLURBS[side.group.id] ?? ''} Shift+{key(side.group)} steps through them.
            </div>
          </div>
          <div className="flex flex-col gap-1 p-2">
            {side.group.tools.map((t) => (
              <Row
                key={t}
                icon={t}
                name={TOOL_NAMES[t]}
                text={TOOL_BLURBS[t] ?? ''}
                active={t === tool}
                opens={false}
                onPress={() => {
                  pick(t);
                  onClose();
                }}
                onPoint={() => setPointed({ name: TOOL_NAMES[t], text: TOOL_BLURBS[t] ?? '' })}
              />
            ))}
          </div>
        </div>
      ) : null}
    </Portal>
  );
}

/** The category buttons, each opening its flyout. `pinned`: the groups shown as their own buttons, so a category
 *  marks the tool in hand only when no pinned button does. */
export function PhotoToolCategories({ pinned }: { pinned: ReadonlySet<string> }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const { tool } = usePhotoTools();
  const [open, setOpen] = useState<{ id: string; left: number; top: number } | null>(null);
  const close = () => setOpen(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.('[data-photo-category], [data-photo-category-button]')) return;
      setOpen(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setOpen(null);
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [open]);
  const inHand = tool ? TOOL_GROUPS.find((g) => g.tools.includes(tool)) : undefined;
  return (
    <div role="group" aria-label="Tool Categories" className="flex items-center gap-0.5">
      {STRIP_CATEGORIES.map((c) => {
        const Icon = TOOL_ICONS[c.icon];
        const isOpen = open?.id === c.id;
        const holds = !!inHand && c.groups.includes(inHand.id) && !pinned.has(inHand.id);
        const category = c;
        return (
          <span key={c.id} className="contents">
            <button
              type="button"
              data-photo-category-button=""
              // The options card hangs from it while it holds the tool in hand (useToolAnchor).
              data-photo-holds={holds ? '' : undefined}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              onClick={(e) => {
                if (isOpen) return close();
                const r = e.currentTarget.getBoundingClientRect();
                setOpen({
                  id: c.id,
                  left: Math.max(8, Math.min(r.left - 8, window.innerWidth - FLYOUT_PX - 8)),
                  top: r.bottom + 10,
                });
              }}
              className={`relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg pl-2 pr-2.5 transition ${
                isOpen || holds
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              <span aria-hidden className="flex h-[18px] w-[18px] items-center justify-center">
                <Icon />
              </span>
              <span className="text-[13px] font-medium leading-none">{c.name}</span>
              <span
                aria-hidden
                className={`absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-brand-500 transition-opacity duration-micro ${isOpen ? 'opacity-100' : 'opacity-0'}`}
              />
            </button>
            {isOpen ? <CategoryFlyoutCard category={category} at={open} onClose={close} /> : null}
          </span>
        );
      })}
    </div>
  );
}
