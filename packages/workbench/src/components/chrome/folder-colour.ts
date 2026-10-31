// A tab folder's colour (docs/specs/006-document/tab-folders.md "Tab bar rendering"): a stable pick from eight hues,
// made from the folder's name, so a folder keeps its colour from visit to visit and every collaborator sees the same
// one, with nothing stored. Each hue is a light-mode ink (Tailwind's 600) and a dark-mode ink (its 300), set as CSS
// variables on the folder so its chip, badge and shelf colour themselves in either appearance (folderStyle).

import type { CSSProperties } from 'react';

export type FolderHue = { name: string; light: string; dark: string };

export const FOLDER_HUES: readonly FolderHue[] = [
  { name: 'blue', light: '#2563eb', dark: '#93c5fd' },
  { name: 'violet', light: '#7c3aed', dark: '#c4b5fd' },
  { name: 'emerald', light: '#059669', dark: '#6ee7b7' },
  { name: 'amber', light: '#d97706', dark: '#fcd34d' },
  { name: 'rose', light: '#e11d48', dark: '#fda4af' },
  { name: 'cyan', light: '#0891b2', dark: '#67e8f9' },
  { name: 'orange', light: '#ea580c', dark: '#fdba74' },
  { name: 'pink', light: '#db2777', dark: '#f9a8d4' },
];

// FNV-1a over the name's UTF-16 units: cheap, stable everywhere, and spreads near-identical names apart.
export function folderHue(name: string): FolderHue {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return FOLDER_HUES[(h >>> 0) % FOLDER_HUES.length]!;
}

// The CSS variables a folder's chip and shelf read (`--tf` light, `--tfd` dark).
export function folderStyle(name: string): CSSProperties {
  const hue = folderHue(name);
  return { '--tf': hue.light, '--tfd': hue.dark } as CSSProperties;
}

// The folder's shelf: a faint tint of its colour behind the chip and its tabs, rounded on top like a tab and standing
// on the bottom edge like them. Always there, so a folder reads as one container whether it is open or shut. It is a
// layer under the group in the tab strip's own stack (the group itself makes none), so the open tab's sliding card
// passes over it.
export const FOLDER_SHELF_CLASS =
  'relative before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-t-[10px] before:bg-[color-mix(in_srgb,var(--tf)_10%,transparent)] dark:before:bg-[color-mix(in_srgb,var(--tfd)_8%,transparent)]';

// The chip, the folder's header: the shelf's first cell, the tabs' own height and padding, its folder glyph, name and
// count in the folder's ink (AA on the shelf in both appearances), with the tabs' inset wash, in the folder's tint,
// on hover. No box of its own: the shelf is its container.
export const FOLDER_CHIP_CLASS =
  'relative isolate flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-t-[10px] pr-2.5 pl-3 text-[13px] font-semibold whitespace-nowrap touch-target-y text-[color-mix(in_srgb,var(--tf)_72%,black)] dark:text-[var(--tfd)] after:pointer-events-none after:absolute after:inset-x-1 after:inset-y-1.5 after:-z-10 after:rounded-lg after:bg-[color-mix(in_srgb,var(--tf)_14%,transparent)] after:opacity-0 after:transition-opacity after:duration-150 hover:after:opacity-100 dark:after:bg-[color-mix(in_srgb,var(--tfd)_12%,transparent)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 motion-reduce:after:transition-none';

// The count badge, open or shut: the folder's colour, the count in white (slate-950 in dark).
export const FOLDER_BADGE_CLASS =
  'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[6px] px-1 text-[11px] font-semibold leading-none tabular-nums bg-[color-mix(in_srgb,var(--tf)_88%,black)] text-white dark:bg-[var(--tfd)] dark:text-slate-950';
