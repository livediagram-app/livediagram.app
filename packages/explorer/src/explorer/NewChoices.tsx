'use client';

// New's choice of app where the list mixes every app (the All filter on liveworkspace.app): a tile per app, its logo
// over "New <Kind>" and the app's name under, so the person sees what they are making and where it will live.
// Rendered inside a PortalMenu; New Folder, where it applies, follows as one more tile.

import type { App } from '@liveworkspace/index-client';
import { useState, type ReactNode } from 'react';
import { CaretDownIcon, FolderOutlineIcon, ItemIcon } from '../ui/icons';
import { PortalMenu } from '../ui/Menu';
import { kindWords, siteOf } from '../words';
import { useExplorer } from './context';

export function NewChoices({
  apps,
  onPick,
  after,
}: {
  apps: readonly App[];
  onPick: (app: App) => void;
  after?: ReactNode;
}) {
  const { renderAppLogo } = useExplorer();
  return (
    <div className="grid grid-cols-2 gap-1 px-1.5 py-0.5" data-new-choices="">
      {apps.map((app) => (
        <ChoiceTile
          key={app}
          label={`New ${kindWords(app).one}`}
          caption={siteOf(app).name}
          icon={renderAppLogo ? renderAppLogo(app) : <ItemIcon size={20} />}
          onClick={() => onPick(app)}
        />
      ))}
      {after}
    </div>
  );
}

export function ChoiceTile({
  label,
  caption,
  icon,
  onClick,
}: {
  label: string;
  caption?: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      className="flex min-w-[7.5rem] cursor-pointer flex-col items-center justify-start gap-1.5 rounded-md px-2 py-2.5 text-center text-[12px] font-medium leading-tight text-slate-700 outline-none transition hover:bg-slate-100 focus-visible:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:bg-slate-800"
    >
      <span className="flex h-6 items-center text-slate-400 [&_svg]:h-6 [&_svg]:w-6">{icon}</span>
      <span>{label}</span>
      {caption ? (
        <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
          {caption}
        </span>
      ) : null}
    </button>
  );
}

/** A New button: it makes the host app's kind, or, where the list mixes every app (createChoices), opens the choice
 *  of app first. `label` is what it says for the host's kind alone ("New Plan"); with a choice it says "New". With
 *  `folder` (an empty folder's New Subfolder), it opens a menu of both, as the pane header's Create does. */
export function NewItemButton({
  label,
  onCreate,
  folder,
  className,
  iconOnlyOnPhone = false,
  icon,
  onPressed,
}: {
  label: string;
  onCreate: (app?: App) => void;
  folder?: { label: string; onCreate: () => void };
  className: string;
  // The label folds to the icon on a phone; the button keeps its name.
  iconOnlyOnPhone?: boolean;
  icon: ReactNode;
  onPressed?: () => void;
}) {
  const { createChoices } = useExplorer();
  const [open, setOpen] = useState(false);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const menu = Boolean(createChoices || folder);
  const shown = menu ? 'New' : label;
  const pick = (run: () => void) => {
    setOpen(false);
    run();
  };
  const folderTile = folder ? (
    <ChoiceTile
      label={folder.label}
      icon={<FolderOutlineIcon size={20} />}
      onClick={() => pick(folder.onCreate)}
    />
  ) : null;
  return (
    <>
      <button
        ref={setButton}
        type="button"
        aria-label={shown}
        {...(menu ? { 'aria-haspopup': 'menu' as const, 'aria-expanded': open } : {})}
        onClick={() => {
          onPressed?.();
          if (menu) setOpen((o) => !o);
          else onCreate();
        }}
        className={className}
      >
        {icon}
        <span className={iconOnlyOnPhone ? 'hidden sm:inline' : undefined}>{shown}</span>
        {menu ? <CaretDownIcon /> : null}
      </button>
      {open && menu ? (
        <PortalMenu anchor={button} onClose={() => setOpen(false)} label="New">
          {createChoices ? (
            <NewChoices
              apps={createChoices}
              onPick={(app) => pick(() => onCreate(app))}
              after={folderTile}
            />
          ) : (
            <div className="grid grid-cols-2 gap-1 px-1.5 py-0.5">
              <ChoiceTile
                label={label}
                icon={<ItemIcon size={20} />}
                onClick={() => pick(() => onCreate())}
              />
              {folderTile}
            </div>
          )}
        </PortalMenu>
      ) : null}
    </>
  );
}
