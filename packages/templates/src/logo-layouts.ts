// Logo layouts (docs/specs/007-editor/logo-pages.md "Logo layouts"): the marks a logo page starts
// from, by category. Pure builders like the page layouts: the artboard's safe area in, ordinary
// themed elements out, in proportions of the box. The builders live per category
// (logo-layouts-lockups, -wordmarks, -emblems, -marks); their shared parts in logo-layout-kit.
import type { Element } from '@livediagram/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';
import type { PageLayoutId } from './page-layouts';
import {
  divided,
  iconAbove,
  iconBelow,
  iconBeside,
  iconRight,
  pill,
  stackedMark,
} from './logo-layouts-lockups';
import {
  initialAccent,
  monogram,
  spaced,
  twoLines,
  underlined,
  wordmark,
} from './logo-layouts-wordmarks';
import { badge, diamond, hexagon, seal, squareBadge, stamp } from './logo-layouts-emblems';
import {
  markApp,
  markDisc,
  markInitial,
  markPeaks,
  markRings,
  markStar,
} from './logo-layouts-marks';

export type LogoLayoutId =
  | 'logo-icon-above'
  | 'logo-icon-beside'
  | 'logo-stacked'
  | 'logo-icon-right'
  | 'logo-divided'
  | 'logo-pill'
  | 'logo-icon-below'
  | 'logo-wordmark'
  | 'logo-monogram'
  | 'logo-underlined'
  | 'logo-two-lines'
  | 'logo-spaced'
  | 'logo-initial'
  | 'logo-badge'
  | 'logo-seal'
  | 'logo-hexagon'
  | 'logo-stamp'
  | 'logo-square-badge'
  | 'logo-diamond'
  | 'logo-mark-disc'
  | 'logo-mark-app'
  | 'logo-mark-rings'
  | 'logo-mark-initial'
  | 'logo-mark-peaks'
  | 'logo-mark-star';

export type LogoLayoutCategoryId =
  'logo-lockups' | 'logo-wordmarks' | 'logo-emblems' | 'logo-marks';

export const LOGO_LAYOUT_CATEGORIES: readonly { id: LogoLayoutCategoryId; label: string }[] = [
  { id: 'logo-lockups', label: 'Lockups' },
  { id: 'logo-wordmarks', label: 'Wordmarks' },
  { id: 'logo-emblems', label: 'Emblems' },
  { id: 'logo-marks', label: 'Marks' },
];

export type LogoLayout = {
  id: PageLayoutId;
  label: string;
  category: LogoLayoutCategoryId;
  description: string;
  build: (box: LayoutBox) => Element[];
};

const own = (
  id: LogoLayoutId,
  category: LogoLayoutCategoryId,
  label: string,
  description: string,
  build: (k: Kit) => Element[],
): LogoLayout => ({ id, category, label, description, build: (b: LayoutBox) => build(kit(b)) });

export const LOGO_LAYOUTS: readonly LogoLayout[] = [
  own(
    'logo-icon-above',
    'logo-lockups',
    'Icon Above Name',
    'An icon in a disc over the name and a tagline',
    iconAbove,
  ),
  own(
    'logo-icon-beside',
    'logo-lockups',
    'Icon Beside Name',
    'An icon in a rounded square, the name and tagline to its right',
    iconBeside,
  ),
  own(
    'logo-stacked',
    'logo-lockups',
    'Stacked',
    'An icon, the name in capitals, a rule and a tagline',
    stackedMark,
  ),
  own(
    'logo-icon-right',
    'logo-lockups',
    'Name Beside Icon',
    'The name and tagline, the icon in a disc to their right',
    iconRight,
  ),
  own(
    'logo-divided',
    'logo-lockups',
    'Divided',
    'An icon, a thin rule, then the name over the tagline',
    divided,
  ),
  own('logo-pill', 'logo-lockups', 'Pill', 'The icon and the name inside an outlined pill', pill),
  own(
    'logo-icon-below',
    'logo-lockups',
    'Icon Below Name',
    'The name and tagline over an icon in a disc',
    iconBelow,
  ),
  own('logo-wordmark', 'logo-wordmarks', 'Wordmark', 'The name set large over a tagline', wordmark),
  own('logo-monogram', 'logo-wordmarks', 'Monogram', 'Two initials in a rounded square', monogram),
  own(
    'logo-underlined',
    'logo-wordmarks',
    'Underlined',
    'The name with an accent bar under it',
    underlined,
  ),
  own(
    'logo-two-lines',
    'logo-wordmarks',
    'Two Lines',
    'Two words stacked, the second tracked wide',
    twoLines,
  ),
  own(
    'logo-spaced',
    'logo-wordmarks',
    'Spaced Capitals',
    'The name in wide capitals between two rules',
    spaced,
  ),
  own(
    'logo-initial',
    'logo-wordmarks',
    'Initial Accent',
    'The first letter in a ring, the rest of the name beside it',
    initialAccent,
  ),
  own(
    'logo-badge',
    'logo-emblems',
    'Badge',
    'A ring with the name arched over the top and the tagline under',
    badge,
  ),
  own(
    'logo-seal',
    'logo-emblems',
    'Seal',
    'An icon in a disc, the name and tagline arched round it',
    seal,
  ),
  own('logo-hexagon', 'logo-emblems', 'Hexagon', 'An icon in a hexagon over the name', hexagon),
  own(
    'logo-stamp',
    'logo-emblems',
    'Stamp',
    'A double ring, the initials inside, the name and tagline arched',
    stamp,
  ),
  own(
    'logo-square-badge',
    'logo-emblems',
    'Square Badge',
    'An outlined rounded square holding the icon and the name',
    squareBadge,
  ),
  own(
    'logo-diamond',
    'logo-emblems',
    'Diamond',
    'The initials in an outlined diamond, the name under it',
    diamond,
  ),
  own('logo-mark-disc', 'logo-marks', 'Icon Disc', 'The icon in a large disc', markDisc),
  own(
    'logo-mark-app',
    'logo-marks',
    'App Icon',
    'A filled rounded square with the icon in it',
    markApp,
  ),
  own(
    'logo-mark-rings',
    'logo-marks',
    'Rings',
    'Two overlapping rings, ready to combine',
    markRings,
  ),
  own(
    'logo-mark-initial',
    'logo-marks',
    'Initial',
    'The first letter, large, in a ring',
    markInitial,
  ),
  own(
    'logo-mark-peaks',
    'logo-marks',
    'Peaks',
    'Two overlapping triangles, ready to unite',
    markPeaks,
  ),
  own(
    'logo-mark-star',
    'logo-marks',
    'Star',
    'A star with a disc at its heart, ready to subtract',
    markStar,
  ),
];
