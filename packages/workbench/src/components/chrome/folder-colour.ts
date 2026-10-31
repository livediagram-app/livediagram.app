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

// The folder's shelf: a faint tint of its colour behind the chip and its tabs, rounded on top, standing on the
// bottom edge like the tabs. A layer under the group, so it fades in and out (the caller sets before:opacity-*).
export const FOLDER_SHELF_CLASS =
  'relative isolate before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:rounded-t-[12px] before:bg-[color-mix(in_srgb,var(--tf)_9%,transparent)] before:transition-opacity before:duration-150 dark:before:bg-[color-mix(in_srgb,var(--tfd)_7%,transparent)] motion-reduce:before:transition-none';

// The chip: the folder's name on a soft tint of its colour, a hairline of the same, ink deep enough to read (AA) on
// the tint in both appearances.
export const FOLDER_CHIP_CLASS =
  'relative flex h-[26px] shrink-0 cursor-pointer items-center rounded-[7px] pl-2.5 pr-1.5 text-[12.5px] font-semibold whitespace-nowrap touch-target-y hover:brightness-[0.96] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 bg-[color-mix(in_srgb,var(--tf)_14%,white)] text-[color-mix(in_srgb,var(--tf)_70%,black)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--tf)_24%,transparent)] dark:bg-[color-mix(in_srgb,var(--tfd)_18%,var(--color-slate-900))] dark:text-[var(--tfd)] dark:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--tfd)_26%,transparent)] dark:hover:brightness-110';

// The count badge on a collapsed chip: the folder's colour, the count in white (slate-950 in dark).
export const FOLDER_BADGE_CLASS =
  'inline-flex h-4 min-w-4 items-center justify-center rounded-[5px] px-1 text-[11px] font-semibold leading-none tabular-nums bg-[color-mix(in_srgb,var(--tf)_88%,black)] text-white dark:bg-[var(--tfd)] dark:text-slate-950';
