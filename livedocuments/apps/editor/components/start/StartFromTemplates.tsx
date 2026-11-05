'use client';

// An empty tab's template start (docs/specs/007-editor/start-diagramming.md): Start Making Pages, a start panel
// (StartPanel). Blank Pages and the catalogue's groups beside a grid of the templates, each its preview over its name and line; a
// search across them. It cannot be closed: the tab holds no page until something is chosen, Blank Pages offering an
// empty page of each kind. Choosing a template lands it on the tab at once.
import { useEffect, useMemo } from 'react';
import { lucideGlyph } from '@livedocuments/ui';
import {
  lucideBriefcase,
  lucideChartPie,
  lucideFileText,
  lucideGraduationCap,
  lucideHouse,
  lucideLightbulb,
  lucideMegaphone,
  lucideMic,
  lucidePartyPopper,
  lucideRocket,
  lucideSquareDashed,
  lucideUsers,
} from '@liveworkspace/icons/lucide';
import type { TemplateKind } from '@livedocuments/templates';
import { useEmptyCardDismissed } from '@liveworkspace/workbench/components/canvas/useEmptyCardDismissed';
import type { HelpArticleKey } from '@/lib/help-articles';
import { StartPanel } from './StartPanel';
import { StartSaveSwitch } from './StartSaveSwitch';
import { templateCard } from './template-card';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { startClosedKey } from './start-closed-key';
import { TEMPLATE_START } from './start-template-items';
import { useStartPalette } from '@/components/start/useStartPalette';

const glyph = (icon: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(icon, 16);

// Each rail group's glyph (start-template-items.ts OWN_GROUPS): Blank Pages, then one per catalogue
// category (docs/specs/008-canvas/canvas-and-palette.md "Template categories").
const RAIL_ICONS: Readonly<Record<string, ReturnType<typeof lucideGlyph>>> = {
  'blank-pages': glyph(lucideSquareDashed),
  careers: glyph(lucideBriefcase),
  events: glyph(lucidePartyPopper),
  home: glyph(lucideHouse),
  learning: glyph(lucideGraduationCap),
  marketing: glyph(lucideMegaphone),
  pitches: glyph(lucideRocket),
  plans: glyph(lucideFileText),
  reports: glyph(lucideChartPie),
  speeches: glyph(lucideMic),
  team: glyph(lucideUsers),
};
const FALLBACK_ICON = glyph(lucideLightbulb);

const COPY: { title: string; line: string; noMatch: string; help: HelpArticleKey } = {
  title: 'Start Making Pages',
  line: 'Pick something to make, or start from a blank page under Blank Pages.',
  noMatch: 'page templates',
  help: 'templates',
};

export function StartFromTemplates({
  tabId,
  onTemplate,
}: {
  tabId: string;
  onTemplate: (kind: TemplateKind) => void;
}) {
  // The tab's own colours (start-palette.ts).
  const palette = useStartPalette();
  const start = TEMPLATE_START;
  const copy = COPY;
  const categories = useMemo(
    () =>
      start.groups.map((g) => ({
        id: g.id,
        name: g.name,
        line: g.line,
        icon: RAIL_ICONS[g.id] ?? FALLBACK_ICON,
      })),
    [start],
  );
  // Only an explicit blank (closeStartForBlank) opens with it closed, its page asking What Is This Page For?, until the
  // palette tray's Show Templates brings it back (StartAgainTray).
  const closedKey = startClosedKey(tabId);
  const closed = useEmptyCardDismissed(closedKey);
  // On screen: the tours hold their offer until it goes (start-panel-open.ts).
  useEffect(() => {
    if (closed) return;
    setStartPanelOpen(true);
    return () => setStartPanelOpen(false);
  }, [closed]);
  if (closed) return null;
  return (
    <StartPanel
      titleId="start-pages-title"
      title={copy.title}
      line={copy.line}
      searchLabel="Find a template"
      noMatchNoun={copy.noMatch}
      helpArticle={copy.help}
      palette={palette}
      categories={categories}
      initialCategory="blank-pages"
      cardsIn={(id) => (start.groups.find((g) => g.id === id)?.kinds ?? []).map(templateCard)}
      search={(query) =>
        start.search(query).map((g) => ({ category: g.group, cards: g.kinds.map(templateCard) }))
      }
      onChoose={(kind) => onTemplate(kind as TemplateKind)}
      // Where the new item lives, and a switch to move it while it is empty (save-locations.md "On the start screen").
      footer={(palette) => <StartSaveSwitch palette={palette} />}
    />
  );
}
