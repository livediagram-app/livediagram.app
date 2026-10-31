'use client';

// The Find bar (docs/specs/007-editor/find-and-replace.md "The bar"; blueprint "Presentation and UX"): a card over
// the canvas, the toolbar strip's surface. The Find row (the Replace chevron, the field with its count, Match Case and
// Whole Word, Previous and Next, Close) and, for someone who may replace, the Replace row. It renders the find state
// (useFindReplace) and owns nothing but focus.
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Button, lucideGlyph, Tooltip } from '@livedocuments/ui';
import {
  lucideArrowDown,
  lucideArrowUp,
  lucideChevronRight,
  lucideX,
} from '@liveworkspace/icons/lucide';
import { keyLabel } from '@liveworkspace/workbench/lib/key-label';
import { FIND_QUERY_MAX } from '@/lib/find/find-text';
import { FIND_MATCHES_MAX } from '@/lib/find/find-matches';
import type { FindView } from '@/hooks/editor/useFindReplace';
import {
  TOOLBAR_CARD,
  TOOLBAR_CONTROL_PRESSED,
  TOOLBAR_CONTROL_REST,
  TOOLBAR_DIVIDER,
} from '@/components/chrome/toolbar-surface';

const UpIcon = lucideGlyph(lucideArrowUp, 16);
const DownIcon = lucideGlyph(lucideArrowDown, 16);
const ChevronIcon = lucideGlyph(lucideChevronRight, 16);
const CloseIcon = lucideGlyph(lucideX, 16);

// The count as the field shows it: "3 of 12", "No Results", nothing while there is no query.
export function findCountLabel(
  f: Pick<FindView, 'query' | 'count' | 'index' | 'capped' | 'searched'>,
): string {
  if (f.query === '' || !f.searched) return '';
  if (f.count === 0) return 'No Results';
  const total = f.capped ? `${FIND_MATCHES_MAX.toLocaleString()}+` : f.count.toLocaleString();
  return `${f.index === null ? 0 : (f.index + 1).toLocaleString()} of ${total}`;
}

// Why the match in hand cannot be replaced, for Replace's tooltip.
const HELD_REASON = {
  role: "You can't edit this text",
  locked: 'This text is locked',
} as const;

const FIELD =
  'h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-500/25';
// The Find field: the field's look on a box holding the input and the count side by side, so the count takes only its
// own width and the typed text keeps the rest (a phone's row is narrow).
const FIELD_BOX =
  'flex h-9 min-w-0 flex-1 items-center rounded-md border border-slate-200 bg-white transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:ring-brand-500/25';

function BarButton({
  label,
  keys,
  pressed,
  expanded,
  controls,
  disabled,
  onPress,
  children,
}: {
  label: string;
  keys?: string;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const name = keys ? `${label} (${keyLabel(keys)})` : label;
  return (
    <Tooltip label={name}>
      <button
        type="button"
        aria-label={name}
        aria-pressed={pressed}
        aria-expanded={expanded}
        aria-controls={controls}
        disabled={disabled}
        onClick={onPress}
        className={`touch-target relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-35 ${
          pressed ? TOOLBAR_CONTROL_PRESSED : TOOLBAR_CONTROL_REST
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function FindBar({ find }: { find: FindView }) {
  const field = useRef<HTMLInputElement | null>(null);
  const replaceRowId = useId();
  // The caret into the Find field, its text selected, on every open (and Cmd/Ctrl+F with the bar open).
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, [find.focusSeq]);
  // A control the keyboard is on that turns off under it (Replace All taking the last match, Next with none left) drops
  // focus to the page, where Escape no longer closes the bar: the keyboard goes back to the Find field instead.
  const lastFocused = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const was = lastFocused.current;
    const now = document.activeElement;
    if (
      was instanceof HTMLButtonElement &&
      was.disabled &&
      (now === null || now === document.body || now === was)
    ) {
      field.current?.focus();
    }
  });
  const count = findCountLabel(find);
  const none = find.count === 0;
  const replaceable = find.count - find.heldCount;
  // Each button's name says why it is off when it is: the same words as its tooltip.
  const replaceName = find.currentHeld
    ? `Replace: ${HELD_REASON[find.currentHeld]}`
    : `Replace (${keyLabel('Enter')})`;
  const replaceAllName =
    !none && replaceable === 0
      ? 'Replace All: None of these matches can be replaced'
      : `Replace All (${keyLabel('Mod-Enter')})`;
  const onBarKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      find.close();
      return;
    }
    // Alt+C and Alt+W toggle the options (by the key's place, as Alt changes the character on a Mac).
    if (e.altKey && !e.metaKey && !e.ctrlKey) {
      if (e.code === 'KeyC') find.toggleOption('matchCase');
      else if (e.code === 'KeyW') find.toggleOption('wholeWord');
      else return;
      e.preventDefault();
    }
  };
  return (
    <div
      role="search"
      aria-label="Find in Tab"
      data-find-bar=""
      data-keeps-escape=""
      onKeyDown={onBarKey}
      onFocus={(e) => {
        lastFocused.current = e.target;
      }}
      className={`${TOOLBAR_CARD} pointer-events-auto flex-col !items-stretch gap-1`}
    >
      <div className="flex items-center gap-0.5">
        {find.canReplace ? (
          <BarButton
            label={find.replaceOpen ? 'Hide Replace' : 'Show Replace'}
            keys="Mod-Shift-H"
            expanded={find.replaceOpen}
            controls={replaceRowId}
            onPress={() => find.setReplaceOpen(!find.replaceOpen)}
          >
            <ChevronIcon
              className={`transition-transform motion-reduce:transition-none ${find.replaceOpen ? 'rotate-90' : ''}`}
            />
          </BarButton>
        ) : null}
        <div className={FIELD_BOX}>
          <input
            ref={field}
            type="text"
            aria-label="Find"
            placeholder="Find"
            spellCheck={false}
            autoComplete="off"
            maxLength={FIND_QUERY_MAX}
            value={find.query}
            onChange={(e) => find.setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
              e.preventDefault();
              if (e.shiftKey) find.previous();
              else find.next();
            }}
            className="h-full min-w-0 flex-1 rounded-md bg-transparent pl-2.5 pr-1 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <span
            aria-live="polite"
            data-find-count=""
            className={`pointer-events-none shrink-0 whitespace-nowrap pr-2.5 text-xs tabular-nums ${
              count === 'No Results'
                ? 'text-rose-700 dark:text-rose-300'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {count}
          </span>
        </div>
        <BarButton
          label="Match Case"
          keys="Alt-C"
          pressed={find.opts.matchCase}
          onPress={() => find.toggleOption('matchCase')}
        >
          <span aria-hidden className="text-[13px] font-semibold leading-none">
            Aa
          </span>
        </BarButton>
        <BarButton
          label="Whole Word"
          keys="Alt-W"
          pressed={find.opts.wholeWord}
          onPress={() => find.toggleOption('wholeWord')}
        >
          <span
            aria-hidden
            className="rounded-[3px] border-b-2 border-current px-0.5 text-[13px] font-semibold leading-none"
          >
            ab
          </span>
        </BarButton>
        <span aria-hidden className={`${TOOLBAR_DIVIDER} phone:hidden`} />
        <BarButton
          label="Previous Match"
          keys="Shift-Enter"
          disabled={none}
          onPress={find.previous}
        >
          <UpIcon />
        </BarButton>
        <BarButton label="Next Match" keys="Enter" disabled={none} onPress={find.next}>
          <DownIcon />
        </BarButton>
        <BarButton label="Close Find" keys="Escape" onPress={find.close}>
          <CloseIcon />
        </BarButton>
      </div>
      {find.replaceOpen ? (
        <div id={replaceRowId} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1 phone:pl-0 pl-[38px]">
            <input
              type="text"
              aria-label="Replace With"
              placeholder="Replace With"
              spellCheck={false}
              autoComplete="off"
              maxLength={FIND_QUERY_MAX}
              value={find.by}
              onChange={(e) => find.setBy(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                e.preventDefault();
                if (e.metaKey || e.ctrlKey) find.replaceAll();
                else find.replace();
              }}
              className={`${FIELD} px-2.5`}
            />
            <div className="flex shrink-0 items-center gap-1">
              <Tooltip label={replaceName}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={replaceName}
                  className="touch-target relative h-9 cursor-pointer"
                  disabled={none || find.index === null || find.currentHeld !== null}
                  onClick={find.replace}
                >
                  Replace
                </Button>
              </Tooltip>
              <Tooltip label={replaceAllName}>
                <Button
                  variant="primary"
                  size="sm"
                  aria-label={replaceAllName}
                  className="touch-target relative h-9 cursor-pointer"
                  disabled={none || replaceable === 0}
                  onClick={find.replaceAll}
                >
                  Replace All
                </Button>
              </Tooltip>
            </div>
          </div>
          {find.heldCount > 0 ? (
            <p
              data-find-held=""
              className="pl-[38px] text-xs text-slate-500 phone:pl-1 dark:text-slate-400"
            >
              {find.heldCount.toLocaleString()} can&rsquo;t be replaced: text you can&rsquo;t edit,
              or locked
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
