'use client';

// A tab folder's colour button and its popover (docs/specs/006-document/tab-folders.md "Membership UX"): a swatch
// circle in the folder's colour, tooltip "Folder Colour", opening a small popover anchored to it with a radio group
// of Automatic (the name's own pick, marked Auto) and the eight hues, the one in force ringed and checked. The arrows
// move through the swatches (wrapping, Home and End to the ends) without picking; Enter or Space picks, which closes
// the popover and hands focus back to the button. Escape closes the popover first (AnchoredPopover takes it before
// the dialog), the dialog staying open.
//
// The folder hues are a fixed set of named inks, each with its own light and dark ink, stored by name: not a colour of
// the document's theme, so this is the folders' own small picker rather than the editor's theme colour picker, built
// on its keyboard (useColourKeys).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { lucideCheck } from '@liveworkspace/icons/lucide';
import type { TabFolderColour } from '@liveworkspace/api-schema/tab-folder-colour';
import { Tooltip, lucideGlyph } from '@liveworkspace/ui';
import { AnchoredPopover } from '../primitives/AnchoredPopover';
import { onColourKeys } from '../colour/useColourKeys';
import {
  FOLDER_HUES,
  chosenFolderHue,
  folderHue,
  folderStyle,
  type FolderHue,
} from './folder-colour';

const CheckGlyph = lucideGlyph(lucideCheck, 14);

// The popover's width: eight 28px swatches, their gaps and its padding.
export const FOLDER_COLOUR_POPOVER_WIDTH = 272;

// The words a colour reads as: its hue, or "Automatic, <hue>" for the name's own pick.
export function folderColourWords(name: string, colour: string | null | undefined): string {
  const chosen = chosenFolderHue(colour);
  return chosen ? chosen.label : `Automatic, ${folderHue(name).label}`;
}

// A filled circle in a hue's ink for the appearance, with a hairline edge so a pale dark-mode ink holds its shape.
function Dot({ hue, size }: { hue: FolderHue; size: 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      style={folderStyle(hue)}
      className={`block shrink-0 rounded-full bg-[var(--tf)] ring-1 ring-black/10 ring-inset forced-color-adjust-none dark:bg-[var(--tfd)] dark:ring-white/20 ${
        size === 'sm' ? 'size-5' : 'size-6'
      }`}
    />
  );
}

/** The folder's colour button: shows the colour in force, opens the picker. */
export function FolderColourButton({
  name,
  colour,
  onPick,
  onOpenChange,
  disabled = false,
  disabledReason,
}: {
  // The folder's name: its Automatic colour, and the button's accessible name.
  name: string;
  // The chosen colour, or null for Automatic.
  colour: string | null;
  onPick: (colour: TabFolderColour | null) => void;
  // The popover opened or closed (the dialog leaves Escape to it while it is open).
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  // Said instead of the colour when disabled.
  disabledReason?: string;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const hue = chosenFolderHue(colour) ?? folderHue(name);
  const label = `Folder Colour for ${name || 'New Folder'}: ${folderColourWords(name, colour)}`;
  const close = () => {
    setAnchor(null);
    onOpenChange?.(false);
  };
  useEffect(() => {
    if (disabled && anchor) close();
    // oxlint-disable-next-line react/exhaustive-deps -- closes once on becoming disabled
  }, [disabled]);

  return (
    <>
      <Tooltip label="Folder Colour">
        <button
          ref={button}
          type="button"
          aria-label={disabled && disabledReason ? `${label}. ${disabledReason}` : label}
          aria-haspopup="dialog"
          aria-expanded={anchor !== null}
          disabled={disabled}
          data-folder-colour-button=""
          onClick={(e) => {
            if (anchor) return close();
            setAnchor(e.currentTarget);
            onOpenChange?.(true);
          }}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent motion-reduce:transition-none dark:hover:bg-slate-800 aria-expanded:bg-slate-100 dark:aria-expanded:bg-slate-800"
        >
          <Dot hue={hue} size="sm" />
        </button>
      </Tooltip>
      {anchor ? (
        <FolderColourPopover
          anchor={anchor}
          name={name}
          colour={colour}
          onClose={close}
          onPick={(picked) => {
            close();
            button.current?.focus({ preventScroll: true });
            if ((picked ?? null) !== (chosenFolderHue(colour)?.name ?? null)) onPick(picked);
          }}
        />
      ) : null}
    </>
  );
}

// One choice in the popover: a swatch with its name read out, ringed and checked when it is in force.
function Swatch({
  hue,
  label,
  checked,
  onPick,
  children,
  wide = false,
}: {
  hue: FolderHue;
  label: string;
  checked: boolean;
  onPick: () => void;
  children?: ReactNode;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      data-colour-key=""
      tabIndex={checked ? 0 : -1}
      onClick={onPick}
      className={`group/swatch relative flex cursor-pointer items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
        wide
          ? 'w-full rounded-lg py-1.5 pr-2 pl-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800'
          : 'size-7 justify-center'
      }`}
    >
      <span
        className={`relative flex size-7 shrink-0 items-center justify-center rounded-full transition-transform motion-reduce:transition-none ${
          checked
            ? 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-brand-300 dark:ring-offset-slate-900'
            : 'group-hover/swatch:scale-110 motion-reduce:group-hover/swatch:scale-100'
        }`}
      >
        <Dot hue={hue} size="md" />
        {checked ? (
          <span className="absolute inset-0 flex items-center justify-center text-white dark:text-slate-900">
            <CheckGlyph />
          </span>
        ) : null}
      </span>
      {children ? <span className="min-w-0 flex-1">{children}</span> : null}
    </button>
  );
}

/** The colour picker for one folder, anchored to its colour button. */
export function FolderColourPopover({
  anchor,
  name,
  colour,
  onPick,
  onClose,
}: {
  anchor: HTMLElement;
  name: string;
  colour: string | null;
  onPick: (colour: TabFolderColour | null) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chosen = chosenFolderHue(colour);
  const automatic = folderHue(name);
  // AnchoredPopover focuses the panel; the group's own stop is the colour in force, a frame later.
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      box.current?.querySelector<HTMLElement>('[data-colour-key][tabindex="0"]')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <AnchoredPopover
      anchor={anchor}
      name={`Folder Colour for ${name || 'New Folder'}`}
      width={FOLDER_COLOUR_POPOVER_WIDTH}
      onClose={onClose}
      initialFocus="panel"
      align="end"
      pointer
    >
      <div ref={box} className="p-3 motion-safe:animate-fade-in">
        <p className="mb-2 px-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          Folder Colour
        </p>
        <div
          role="radiogroup"
          aria-label={`Folder Colour for ${name || 'New Folder'}`}
          onKeyDown={onColourKeys}
        >
          <Swatch
            wide
            hue={automatic}
            label={`Automatic, ${automatic.label}`}
            checked={chosen === null}
            onPick={() => onPick(null)}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-100">
                Automatic
                <span className="rounded px-1 py-px text-[10px] font-semibold tracking-wide text-slate-500 ring-1 ring-slate-200 dark:text-slate-400 dark:ring-slate-700">
                  Auto
                </span>
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {automatic.label}, from the name
              </span>
            </span>
          </Swatch>
          <div className="mt-2 grid grid-cols-8 justify-items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
            {FOLDER_HUES.map((hue) => (
              <Swatch
                key={hue.name}
                hue={hue}
                label={hue.label}
                checked={chosen?.name === hue.name}
                onPick={() => onPick(hue.name)}
              />
            ))}
          </div>
        </div>
      </div>
    </AnchoredPopover>
  );
}
