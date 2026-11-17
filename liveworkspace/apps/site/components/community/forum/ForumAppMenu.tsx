'use client';

import { useRef } from 'react';
import { COMMUNITY_APPS, forumAppLabel, type CommunityApp } from '@liveworkspace/community';
import {
  CheckIcon,
  ChevronDownIcon,
  MENU_PANEL,
  menuRadioRowClass,
  useClickOutside,
  useMenu,
  useMenuButton,
} from '@liveworkspace/ui';
import { ForumAppLogo } from './ForumAppLogo';

// The Forum list's App filter (liveworkspace/docs/specs/007-community/community.md "Categories and apps"): All Apps,
// then each app by its logo, over the shared menu keyboard (arrows move, Enter chooses, Escape closes back to the
// trigger). The trigger shows the chosen app's logo.

const ROWS: readonly (CommunityApp | null)[] = [null, ...COMMUNITY_APPS];

export function ForumAppMenu({
  value,
  onChange,
}: {
  value: CommunityApp | null;
  onChange: (app: CommunityApp | null) => void;
}) {
  const menu = useMenuButton();
  const root = useRef<HTMLDivElement>(null);
  useClickOutside(root, menu.close, menu.open);
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        {...menu.triggerProps}
        aria-label={value ? `App: ${forumAppLabel(value)}` : 'Filter by App'}
        className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 ring-inset transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
          value
            ? 'bg-brand-50 ring-brand-300 dark:bg-brand-500/15 dark:ring-brand-500/40'
            : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-white'
        }`}
      >
        {value ? (
          <ForumAppLogo app={value} />
        ) : (
          <span className="text-optical-centre">All Apps</span>
        )}
        <ChevronDownIcon
          aria-hidden
          size={12}
          className={`transition-transform duration-micro motion-reduce:transition-none ${menu.open ? 'rotate-180' : ''}`}
        />
      </button>
      {menu.open ? (
        <AppMenuRows
          value={value}
          trigger={menu.trigger}
          initialFocus={menu.initialFocus}
          onClose={menu.close}
          onPick={(app) => {
            menu.close();
            if (app !== value) onChange(app);
          }}
        />
      ) : null}
    </div>
  );
}

function AppMenuRows({
  value,
  trigger,
  initialFocus,
  onClose,
  onPick,
}: {
  value: CommunityApp | null;
  trigger: ReturnType<typeof useMenuButton>['trigger'];
  initialFocus: ReturnType<typeof useMenuButton>['initialFocus'];
  onClose: () => void;
  onPick: (app: CommunityApp | null) => void;
}) {
  const { attach, surfaceProps } = useMenu({ onClose, trigger, initialFocus, label: 'App' });
  return (
    <div
      ref={attach}
      {...surfaceProps}
      className="absolute left-0 top-full z-(--z-popover) w-56 pt-2 outline-none"
    >
      <div className={MENU_PANEL}>
        {ROWS.map((app) => {
          const checked = app === value;
          return (
            <button
              key={app ?? 'all'}
              type="button"
              role="menuitemradio"
              aria-checked={checked}
              aria-label={app ? forumAppLabel(app) : 'All Apps'}
              tabIndex={-1}
              onClick={() => onPick(app)}
              className={menuRadioRowClass(checked, { weight: 'checked' })}
            >
              <span className="flex flex-1 items-center">
                {app ? <ForumAppLogo app={app} /> : 'All Apps'}
              </span>
              <span className="flex w-4 shrink-0 justify-end">
                {checked ? <CheckIcon aria-hidden /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
