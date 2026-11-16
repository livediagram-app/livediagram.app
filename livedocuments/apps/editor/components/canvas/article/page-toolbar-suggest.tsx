'use client';

// The page toolbar's mode menu (docs/specs/007-editor/suggestions.md "Suggesting"): its button names the mode in
// force (Editing, a pencil; Suggesting, a pencil with a line, in the brand tint); the menu holds Editing and
// Suggesting, then, under Review, the article's suggestion count, Accept All and Reject All. An Editor's alone: a
// Participant on Suggest Only always suggests, and the toolbar is an Editor's.
import type { ReactNode } from 'react';
import {
  lucideCheck,
  lucideListChecks,
  lucidePencil,
  lucidePencilLine,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { ChevronDownIcon, lucideGlyph, SOLID_BRAND_DARK_CONTROL, Tooltip } from '@livedocuments/ui';
import {
  TOOLBAR_CONTROL_PRESSED,
  TOOLBAR_CONTROL_REST,
} from '@liveworkspace/workbench/components/chrome/toolbar-surface';
import type { SuggestMode } from '@/lib/article/article-suggest-store';
import { MenuRow } from './page-toolbar-menus';

const PencilGlyph = lucideGlyph(lucidePencil, 16);
const SuggestGlyph = lucideGlyph(lucidePencilLine, 16);
const CheckGlyph = lucideGlyph(lucideCheck, 16);
const CrossGlyph = lucideGlyph(lucideX, 16);
const ReviewGlyph = lucideGlyph(lucideListChecks, 14);

const MODE_LABEL: Record<SuggestMode, string> = { editing: 'Editing', suggesting: 'Suggesting' };

/** The toolbar's mode button: the mode in force, its glyph alone on a phone, where Suggesting is a solid brand fill so
 *  the two modes never look alike without the words. */
export function SuggestModeButton({
  mode,
  expanded,
  phone,
  onPress,
}: {
  mode: SuggestMode;
  expanded: boolean;
  phone: boolean;
  onPress: () => void;
}) {
  const label = MODE_LABEL[mode];
  const suggesting = mode === 'suggesting';
  const tone =
    suggesting && phone
      ? `bg-brand-700 text-white hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`
      : expanded
        ? TOOLBAR_CONTROL_PRESSED
        : suggesting
          ? 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25'
          : TOOLBAR_CONTROL_REST;
  return (
    <Tooltip label={`Mode: ${label}`}>
      <button
        data-anchor="mode"
        data-suggest-mode={mode}
        type="button"
        aria-label={`Mode: ${label}`}
        aria-haspopup="menu"
        aria-expanded={expanded}
        onClick={onPress}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 ${tone}`}
      >
        {suggesting ? <SuggestGlyph /> : <PencilGlyph />}
        {phone ? null : <span>{label}</span>}
        <ChevronDownIcon className="shrink-0" />
      </button>
    </Tooltip>
  );
}

function ModeRow({
  selected,
  label,
  hint,
  icon,
  onPick,
}: {
  selected: boolean;
  label: string;
  hint: string;
  icon: ReactNode;
  onPick: () => void;
}) {
  return (
    <MenuRow label={label} selected={selected} onPick={onPick}>
      <span className="mt-0.5 self-start">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
      </span>
    </MenuRow>
  );
}

/** "6 suggestions", "1 suggestion", "No suggestions". */
export const suggestionCountCopy = (n: number): string =>
  n === 0 ? 'No suggestions' : `${n} suggestion${n === 1 ? '' : 's'}`;

/** The mode menu: Editing, Suggesting, then Review. */
export function SuggestPanel({
  mode,
  count,
  onMode,
  onAll,
}: {
  mode: SuggestMode;
  // The article's suggestions, read while the menu is open.
  count: number;
  onMode: (mode: SuggestMode) => void;
  onAll: (decision: 'accept' | 'reject') => void;
}) {
  const action =
    'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <div role="menu" aria-label="Mode" className="flex flex-col">
      <ModeRow
        selected={mode === 'editing'}
        label="Editing"
        hint="Change the writing directly"
        icon={<PencilGlyph />}
        onPick={() => onMode('editing')}
      />
      <ModeRow
        selected={mode === 'suggesting'}
        label="Suggesting"
        hint="Your changes become suggestions to accept or reject"
        icon={<SuggestGlyph />}
        onPick={() => onMode('suggesting')}
      />
      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
      <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <ReviewGlyph />
        <span className="flex-1">Review</span>
        <span
          data-suggestion-count={count}
          className="font-medium normal-case tracking-normal text-slate-500 dark:text-slate-400"
        >
          {suggestionCountCopy(count)}
        </span>
      </div>
      <button
        type="button"
        role="menuitem"
        disabled={count === 0}
        className={action}
        onClick={() => onAll('accept')}
      >
        <CheckGlyph />
        <span className="flex-1">Accept All</span>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={count === 0}
        className={action}
        onClick={() => onAll('reject')}
      >
        <CrossGlyph />
        <span className="flex-1">Reject All</span>
      </button>
    </div>
  );
}
