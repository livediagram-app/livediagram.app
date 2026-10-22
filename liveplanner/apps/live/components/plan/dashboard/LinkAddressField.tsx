'use client';

// The Links card's address field (docs/specs/026-plan/plan-tabs.md "Cards", Links): type a web address, or pick one of
// this project's tabs from the list under it, each with its tab's icon and name. A combobox: the list opens as the
// field takes focus or is typed in, ArrowDown and ArrowUp move through it, Enter picks the highlighted tab (or, with
// none highlighted, submits the form), Escape closes the list (or, closed, cancels the form). The list is drawn in a
// portal under the field, so a short slot never clips it.
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Portal, TextInput } from '@liveplanner/ui';
import type { Tab } from '@liveplanner/project';
import { TabModeIcon } from '@/components/chrome/editor-mode/TabModeIcon';
import { placeAnchored, type AnchoredPlace } from '@/components/primitives/AnchoredPopover';
import { matchingTabs } from './link-address';

const LIST_MAX_H = 224;

export function LinkAddressField({
  value,
  tabs,
  invalid,
  onChange,
  onPickTab,
  onCancel,
}: {
  value: string;
  tabs: readonly Tab[];
  invalid: boolean;
  // Typed: the text, no tab picked any more.
  onChange: (text: string) => void;
  onPickTab: (tab: Tab) => void;
  onCancel: () => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<(AnchoredPlace & { width: number }) | null>(null);
  const options = matchingTabs(tabs, value);
  const shown = open && options.length > 0;

  // Under the field (or above it with no room below), following it as the page or slot scrolls.
  useLayoutEffect(() => {
    if (!shown) return;
    const measure = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (!r) return;
      setPlace((prev) => ({
        ...placeAnchored(
          r,
          { width: r.width, height: Math.min(LIST_MAX_H, options.length * 34 + 8) },
          { width: window.innerWidth, height: window.innerHeight },
          prev?.side,
        ),
        width: r.width,
      }));
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [shown, options.length]);

  const pick = (tab: Tab) => {
    onPickTab(tab);
    setOpen(false);
    setActive(-1);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!shown) {
        setOpen(true);
        setActive(e.key === 'ArrowDown' ? 0 : options.length - 1);
        return;
      }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a + step + options.length) % options.length);
      return;
    }
    if (e.key === 'Enter' && shown && options[active]) {
      e.preventDefault();
      pick(options[active]);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (shown) setOpen(false);
      else onCancel();
    }
  };

  return (
    <>
      <TextInput
        ref={inputRef}
        compact
        role="combobox"
        aria-label="Address"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        invalid={invalid}
        value={value}
        placeholder="example.com or a tab"
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        // A press on the list lands before the field loses focus (onMouseDown below prevents the blur).
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="min-w-0"
      />
      {shown && place ? (
        <Portal>
          <ul
            id={listId}
            role="listbox"
            aria-label="Tabs in this project"
            className="fixed z-[calc(var(--z-popover)+1)] overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            style={{
              left: place.left,
              ...(place.side === 'below' ? { top: place.top } : { bottom: place.bottom }),
              width: place.width,
              maxHeight: Math.min(LIST_MAX_H, place.maxHeight),
            }}
            // Keep focus in the field while choosing.
            onMouseDown={(e) => e.preventDefault()}
          >
            {options.map((tab, i) => (
              <li
                key={tab.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(tab)}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-slate-700 dark:text-slate-200 ${
                  i === active
                    ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
                    : ''
                }`}
              >
                <TabModeIcon tab={tab} style={{ opacity: 0.8 }} />
                <span className="truncate">{tab.name}</span>
              </li>
            ))}
          </ul>
        </Portal>
      ) : null}
    </>
  );
}
