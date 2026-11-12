// Retired themes (docs/specs/011-theme/retired-schemes.md, docs/specs/011-theme/light-and-dark.md "Retired: Autumn and
// Jewel" and "Retired: UML"), bound to @liveworkspace/element-model's retired-theme migration: a theme leaves the
// catalogue by being migrated away on read. A tab saved on one moves to the theme that replaced it, and every colour
// still equal to what the retired theme painted becomes the replacement's colour for the same role (canvas, pattern,
// element paints, root, each palette branch by position); a colour someone picked stays. These definitions are data
// about the past, frozen as they shipped; they never change.
import { bindRetiredThemes, type RetiredTheme } from '@liveworkspace/element-model/retired-themes';
import { RETIRED_THEMES as RETIRED_UML } from '@liveworkspace/element-model/retired-uml';
import type { ThemeDefinition } from './themes';

// Retired ids are not ThemeIds any more, hence the cast.
const AUTUMN = {
  id: 'autumn' as ThemeDefinition['id'],
  label: 'Autumn',
  backgroundColor: '#fffaf5',
  backgroundPattern: 'grid',
  patternColor: '#fed7aa',
  elementFill: '#fffaf5',
  elementStroke: '#7c2d12',
  elementText: '#431407',
  rootColor: { fill: '#fffaf5', stroke: '#7c2d12', text: '#431407' },
  palette: [
    { fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d' },
    { fill: '#ffedd5', stroke: '#ea580c', text: '#7c2d12' },
    { fill: '#fef3c7', stroke: '#d97706', text: '#78350f' },
    { fill: '#fef9c3', stroke: '#ca8a04', text: '#713f12' },
    { fill: '#f5ede0', stroke: '#92400e', text: '#451a03' },
    { fill: '#ecfccb', stroke: '#65a30d', text: '#365314' },
  ],
} satisfies ThemeDefinition;

const JEWEL = {
  id: 'jewel' as ThemeDefinition['id'],
  label: 'Jewel',
  backgroundColor: '#fbfbfd',
  backgroundPattern: 'grid',
  patternColor: '#e2e8f0',
  elementFill: '#fbfbfd',
  elementStroke: '#334155',
  elementText: '#0f172a',
  rootColor: { fill: '#fbfbfd', stroke: '#334155', text: '#0f172a' },
  palette: [
    { fill: '#d1fae5', stroke: '#059669', text: '#064e3b' },
    { fill: '#dbeafe', stroke: '#1d4ed8', text: '#1e3a8a' },
    { fill: '#f3e8ff', stroke: '#7e22ce', text: '#581c87' },
    { fill: '#ffe4e6', stroke: '#e11d48', text: '#881337' },
    { fill: '#fef9c3', stroke: '#ca8a04', text: '#713f12' },
    { fill: '#cffafe', stroke: '#0e7490', text: '#155e75' },
  ],
} satisfies ThemeDefinition;

/** Each retired theme and the theme that replaced it. UML is the shared one this product retired while livediagram
 *  keeps it (./themes-data leaves it out of THEMES). */
export const RETIRED_THEMES: Readonly<Record<string, RetiredTheme>> = {
  autumn: { from: AUTUMN, to: 'tropical' },
  jewel: { from: JEWEL, to: 'rainbow' },
  ...RETIRED_UML,
};

/** Rewrite a stored tab off a retired theme onto its replacement. The same tab when it is on none. */
export const migrateRetiredTheme = bindRetiredThemes(RETIRED_THEMES).migrate;
