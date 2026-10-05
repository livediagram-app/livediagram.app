'use client';

import { Fragment, useRef, type ReactNode } from 'react';
import {
  CheckIcon,
  MENU_PANEL,
  menuRadioRowClass,
  useClickOutside,
  useMenu,
  useMenuButton,
  type MenuInitialFocus,
} from '@livediagram/ui';
import { SearchControlButton } from './SearchControlButton';

// One of the menus inside the search box (Category, Tags, Sort; docs/specs/025-community/community.md "Gallery"):
// a SearchControlButton that opens check-marked rows over the shared menu keyboard (blueprint §10;
// docs/specs/004-interface-design/menus.md): arrows move, Enter chooses, Escape closes and focus returns to the
// trigger, a click outside closes. A pick either closes the menu (one choice) or leaves it open (several).

export type SearchMenuRow<T> = {
  id: T;
  key: string;
  label: string;
  count?: number | null;
  checked: boolean;
};
export type SearchMenuGroup<T> = { heading?: string; rows: SearchMenuRow<T>[] };

const GROUP_LABEL =
  'px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export function SearchControlMenu<T>({
  trigger,
  menuLabel,
  groups,
  role,
  width,
  scroll = false,
  closeOnPick,
  onPick,
}: {
  trigger: { ariaLabel: string; icon: ReactNode; label: string; active: boolean; badge?: number };
  menuLabel: string;
  groups: SearchMenuGroup<T>[];
  role: 'menuitemradio' | 'menuitemcheckbox';
  // The panel's width classes (`w-64`, `min-w-44`).
  width: string;
  // A long list scrolls inside the panel.
  scroll?: boolean;
  closeOnPick: boolean;
  onPick: (id: T) => void;
}) {
  const menu = useMenuButton();
  const root = useRef<HTMLDivElement>(null);
  useClickOutside(root, menu.close, menu.open);
  return (
    <div ref={root} className="relative">
      <SearchControlButton
        {...menu.triggerProps}
        aria-label={trigger.ariaLabel}
        icon={trigger.icon}
        label={trigger.label}
        active={trigger.active}
        badge={trigger.badge}
        open={menu.open}
      />
      {menu.open ? (
        <SearchMenuOptions
          menuLabel={menuLabel}
          groups={groups}
          role={role}
          width={width}
          scroll={scroll}
          trigger={menu.trigger}
          initialFocus={menu.initialFocus}
          onClose={menu.close}
          onPick={(id) => {
            if (closeOnPick) menu.close();
            onPick(id);
          }}
        />
      ) : null}
    </div>
  );
}

function SearchMenuOptions<T>({
  menuLabel,
  groups,
  role,
  width,
  scroll,
  trigger,
  initialFocus,
  onClose,
  onPick,
}: {
  menuLabel: string;
  groups: SearchMenuGroup<T>[];
  role: 'menuitemradio' | 'menuitemcheckbox';
  width: string;
  scroll: boolean;
  trigger: HTMLElement | null;
  initialFocus: MenuInitialFocus;
  onClose: () => void;
  onPick: (id: T) => void;
}) {
  const { attach, surfaceProps } = useMenu({ onClose, trigger, initialFocus, label: menuLabel });
  return (
    <div
      ref={attach}
      {...surfaceProps}
      className={`absolute right-0 top-full z-(--z-popover) ${width} pt-2 outline-none`}
    >
      <div className={scroll ? `${MENU_PANEL} max-h-80 overflow-y-auto` : MENU_PANEL}>
        {groups.map((group) =>
          group.rows.length === 0 ? null : (
            <Fragment key={group.heading ?? 'rows'}>
              {group.heading ? <p className={GROUP_LABEL}>{group.heading}</p> : null}
              {group.rows.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  role={role}
                  aria-checked={row.checked}
                  tabIndex={-1}
                  onClick={() => onPick(row.id)}
                  className={menuRadioRowClass(row.checked, { weight: 'checked' })}
                >
                  <span className="flex-1 truncate">{row.label}</span>
                  {row.count !== undefined && row.count !== null ? (
                    <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                      {row.count}
                    </span>
                  ) : null}
                  <span className="flex w-4 shrink-0 justify-end">
                    {row.checked ? <CheckIcon aria-hidden /> : null}
                  </span>
                </button>
              ))}
            </Fragment>
          ),
        )}
      </div>
    </div>
  );
}
