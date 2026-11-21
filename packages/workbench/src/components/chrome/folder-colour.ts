// A tab folder's colour (docs/specs/006-document/tab-folders.md "Folder colour" and "Tab bar rendering"): the hue
// chosen for it, stored as its name on every member, else a stable pick from the eight made from the folder's name
// (Automatic), so a folder keeps its colour from visit to visit and every collaborator sees the same one. Each hue is
// a light-mode ink (Tailwind's 600) and a dark-mode ink (its 300), set as CSS variables on the folder so its chip,
// shelf and Organise dialog row colour themselves in either appearance (folderStyle).

import type { CSSProperties } from 'react';
import {
  tabFolderColourOf,
  type TabFolderColour,
} from '@liveworkspace/api-schema/tab-folder-colour';

export type FolderHue = { name: TabFolderColour; label: string; light: string; dark: string };

// In TAB_FOLDER_COLOURS' order (the Automatic pick indexes it, so the order is every Automatic folder's colour).
export const FOLDER_HUES: readonly FolderHue[] = [
  { name: 'blue', label: 'Blue', light: '#2563eb', dark: '#93c5fd' },
  { name: 'violet', label: 'Violet', light: '#7c3aed', dark: '#c4b5fd' },
  { name: 'emerald', label: 'Emerald', light: '#059669', dark: '#6ee7b7' },
  { name: 'amber', label: 'Amber', light: '#d97706', dark: '#fcd34d' },
  { name: 'rose', label: 'Rose', light: '#e11d48', dark: '#fda4af' },
  { name: 'cyan', label: 'Cyan', light: '#0891b2', dark: '#67e8f9' },
  { name: 'orange', label: 'Orange', light: '#ea580c', dark: '#fdba74' },
  { name: 'pink', label: 'Pink', light: '#db2777', dark: '#f9a8d4' },
];
const BY_NAME = new Map(FOLDER_HUES.map((hue) => [hue.name, hue]));

// The Automatic pick. FNV-1a over the name's UTF-16 units: cheap, stable everywhere, and spreads near-identical names
// apart.
export function folderHue(name: string): FolderHue {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return FOLDER_HUES[(h >>> 0) % FOLDER_HUES.length]!;
}

// The hue a stored colour names, or null for Automatic (no colour, or one this build does not know).
export function chosenFolderHue(colour: string | null | undefined): FolderHue | null {
  const name = tabFolderColourOf(colour);
  return name ? BY_NAME.get(name)! : null;
}

// The hue a folder draws in: its chosen one, else its name's.
export function resolveFolderHue(name: string, colour: string | null | undefined): FolderHue {
  return chosenFolderHue(colour) ?? folderHue(name);
}

// The CSS variables a folder's chip, shelf and dialog row read (`--tf` light, `--tfd` dark).
export function folderStyle(hue: FolderHue): CSSProperties {
  return { '--tf': hue.light, '--tfd': hue.dark } as CSSProperties;
}

// The folder's shelf: a faint tint of its colour behind the chip and its tabs, rounded on top like a tab and standing
// on the bottom edge like them. Always there, so a folder reads as one container whether it is open or shut. It is a
// layer under the group in the tab strip's own stack (the group itself makes none), so the open tab's sliding card
// passes over it.
export const FOLDER_SHELF_CLASS =
  'relative before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-t-[10px] before:bg-[color-mix(in_srgb,var(--tf)_10%,transparent)] dark:before:bg-[color-mix(in_srgb,var(--tfd)_8%,transparent)]';

// The chip, the folder's header: the shelf's first cell, the tabs' own height and padding, its stacked folder glyph and
// name in the folder's ink (AA on the shelf in both appearances), with the tabs' inset wash, in the folder's tint,
// on hover. No box of its own: the shelf is its container. Holding the open tab it can't be shut (`aria-disabled`), so
// it drops the pointer and the wash.
export const FOLDER_CHIP_CLASS =
  'relative isolate flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-[10px] pr-2.5 pl-3 text-[13px] font-semibold whitespace-nowrap touch-target-y text-[color-mix(in_srgb,var(--tf)_72%,black)] dark:text-[var(--tfd)] after:pointer-events-none after:absolute after:inset-x-1 after:inset-y-1.5 after:-z-10 after:rounded-lg after:bg-[color-mix(in_srgb,var(--tf)_14%,transparent)] after:opacity-0 after:transition-opacity after:duration-150 hover:after:opacity-100 dark:after:bg-[color-mix(in_srgb,var(--tfd)_12%,transparent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 motion-reduce:after:transition-none aria-disabled:cursor-default aria-disabled:after:hidden';
