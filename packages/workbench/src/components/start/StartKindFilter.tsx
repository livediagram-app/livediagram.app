'use client';

// A start panel's kind filter (docs/specs/007-editor/start-diagramming.md "Page type", in livedesign and
// livedocuments): where livediagram's start has its mode switch, and drawn the same way. A field inset in the rail's
// top, on its own paper with a border and a small shadow, its glyph and name in the brand ink and a chevron. It opens
// a menu of `menuitemradio` rows, each a glyph on a soft plate, the name, a line under it and a check on the chosen
// one. On a phone the menu spans the row it opens from.
//
// Menu button pattern (docs/specs/004-interface-design/menus.md): the shared hooks give it the menu keyboard. Opening
// focuses the checked row, choosing or Escape returns focus to the chip, Tab closes it, an outside press closes it.
import { useRef } from 'react';
import {
  CheckIcon,
  ChevronDownIcon,
  MENU_PANEL,
  MenuTreeContext,
  useClickOutside,
  useMenu,
  useMenuButton,
  type lucideGlyph,
} from '@liveworkspace/ui';

export type StartKindOption<K extends string> = {
  id: K;
  name: string;
  line: string;
  icon: ReturnType<typeof lucideGlyph>;
};

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:focus-visible:outline-brand-400';

export function StartKindFilter<K extends string>({
  label,
  options,
  value,
  onChange,
}: {
  // What it filters by ("Page type"): the menu's name, and the chip's before the chosen option's.
  label: string;
  options: readonly StartKindOption<K>[];
  value: K;
  onChange: (next: K) => void;
}) {
  const { open, close, toggle, initialFocus, trigger, onTriggerKeyDown, setTrigger } =
    useMenuButton();
  const root = useRef<HTMLDivElement>(null);
  useClickOutside(root, close, open);
  const chosen = options.find((o) => o.id === value) ?? options[0]!;
  const Icon = chosen.icon;
  return (
    <div data-start-kind-filter className="flex w-full shrink-0 p-3 sm:px-4 sm:pt-4 sm:pb-3">
      <div ref={root} className="relative w-full">
        <button
          ref={setTrigger}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`${label}: ${chosen.name}`}
          onClick={toggle}
          onKeyDown={onTriggerKeyDown}
          className={`flex h-10 w-full cursor-pointer items-center justify-start gap-2.5 rounded-xl border border-brand-200 bg-white px-3 text-[13px] font-semibold text-brand-700 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-brand-400/30 dark:bg-white/5 dark:text-brand-200 dark:hover:bg-brand-500/15 ${FOCUS}`}
        >
          <Icon aria-hidden />
          <span className="text-optical-line flex-1 text-left">{chosen.name}</span>
          <ChevronDownIcon
            aria-hidden
            className={`transition-transform duration-micro motion-reduce:transition-none ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
        {open ? (
          <KindMenu
            label={label}
            options={options}
            value={value}
            trigger={trigger}
            initialFocus={initialFocus}
            onClose={close}
            onChange={onChange}
          />
        ) : null}
      </div>
    </div>
  );
}

function KindMenu<K extends string>({
  label,
  options,
  value,
  trigger,
  initialFocus,
  onClose,
  onChange,
}: {
  label: string;
  options: readonly StartKindOption<K>[];
  value: K;
  trigger: HTMLElement | null;
  initialFocus: ReturnType<typeof useMenuButton>['initialFocus'];
  onClose: () => void;
  onChange: (next: K) => void;
}) {
  const { attach, surfaceProps, tree } = useMenu({ onClose, trigger, initialFocus, label });
  return (
    <MenuTreeContext.Provider value={tree}>
      <div
        ref={attach}
        {...surfaceProps}
        data-start-kind-menu=""
        className={`absolute left-0 top-full z-(--z-popover) mt-1.5 w-max min-w-64 max-w-[calc(100vw-2rem)] outline-none max-sm:inset-x-0 max-sm:w-auto ${MENU_PANEL}`}
      >
        {options.map((option) => {
          const checked = option.id === value;
          const RowIcon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={checked}
              data-kind-row={option.id}
              tabIndex={-1}
              onClick={() => {
                onClose();
                if (!checked) onChange(option.id);
              }}
              className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-slate-100 focus:bg-slate-100 max-sm:gap-3 max-sm:px-2.5 max-sm:py-2 dark:hover:bg-slate-800 dark:focus:bg-slate-800 ${FOCUS} ${
                checked
                  ? 'font-semibold text-slate-900 dark:text-white'
                  : 'font-medium text-slate-700 dark:text-slate-200'
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
                <RowIcon aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                {option.name}
                <span className="max-w-60 text-xs font-normal leading-snug text-slate-600 max-sm:max-w-none dark:text-slate-400">
                  {option.line}
                </span>
              </span>
              <span className="flex w-5 shrink-0 justify-end">
                {checked ? (
                  <CheckIcon aria-hidden className="text-brand-700 dark:text-brand-400" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </MenuTreeContext.Provider>
  );
}
