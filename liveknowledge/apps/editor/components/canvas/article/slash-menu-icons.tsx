// Each slash entry's tile glyph (docs/specs/030-knowledgebase/page-surface.md "The slash menu"): the text styles as
// type set in the knowledgebase's own heading font (Aa, H1 to H3), everything else the icon set's glyph. The page
// picker's entries (a page, Create Page) have theirs too.
import type { ComponentType, ReactNode } from 'react';
import {
  lucideAppWindow,
  lucideChartColumn,
  lucideChartLine,
  lucideChartPie,
  lucideFilePlus,
  lucideFileText,
  lucideHistory,
  lucideImage,
  lucideLink,
  lucideList,
  lucideListOrdered,
  lucideListTodo,
  lucideListTree,
  lucideQuote,
  lucideSeparatorHorizontal,
  lucideShapes,
  lucideSquareCode,
  lucideSuperscript,
  lucideTable,
  lucideType,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@liveknowledge/ui';

const G = (glyph: Parameters<typeof lucideGlyph>[0]): ComponentType => lucideGlyph(glyph, 18);

// Type for a text style's tile: set in the writing's heading font where the menu has it.
const Type = ({ children, weight = 700 }: { children: ReactNode; weight?: number }) => (
  <span
    aria-hidden
    className="text-[13px] leading-none tracking-tight"
    style={{ fontFamily: 'var(--article-heading-font, inherit)', fontWeight: weight }}
  >
    {children}
  </span>
);

const ICONS: Readonly<Record<string, ComponentType>> = {
  text: () => <Type weight={500}>Aa</Type>,
  h1: () => <Type>H1</Type>,
  h2: () => <Type>H2</Type>,
  h3: () => <Type>H3</Type>,
  subtitle: G(lucideType),
  quote: G(lucideQuote),
  code: G(lucideSquareCode),
  bullet: G(lucideList),
  numbered: G(lucideListOrdered),
  todo: G(lucideListTodo),
  image: G(lucideImage),
  chart: G(lucideChartColumn),
  pie: G(lucideChartPie),
  line: G(lucideChartLine),
  drawing: G(lucideShapes),
  'page-link': G(lucideLink),
  embed: G(lucideAppWindow),
  footnote: G(lucideSuperscript),
  toc: G(lucideListTree),
  table: G(lucideTable),
  divider: G(lucideSeparatorHorizontal),
  'create-page': G(lucideFilePlus),
};

const PAGE = G(lucideFileText);
const RECENT_GLYPH = lucideGlyph(lucideHistory, 12);

/** The tile glyph of the entry `id`: a page of the picker (`page-…`) is a page. */
export function slashIcon(id: string): ReactNode {
  const Icon = ICONS[id] ?? (id.startsWith('page-') ? PAGE : null);
  return Icon ? <Icon /> : null;
}

/** The Recent heading's glyph. */
export const recentIcon = (): ReactNode => <RECENT_GLYPH />;
