'use client';

// An empty tab's template start (docs/specs/007-editor/start-diagramming.md): Start Making Pages, a start panel
// (StartPanel). Recommended and its groups beside a grid of the templates, each its preview over its name and line; a
// search across them; the × starts from nothing. Choosing a template lands it on the tab at once.
import { DeviceGlyph } from '@/components/canvas/wireframe/DeviceGlyph';
import { useEffect, useMemo } from 'react';
import { lucideGlyph } from '@livedesign/ui';
import {
  lucideLightbulb,
  lucidePenTool,
  lucideShapes,
  lucideStar,
} from '@liveworkspace/icons/lucide';
import type { EditorMode } from '@livedesign/design';
import type { TemplateKind } from '@livedesign/templates';
import { dismissEmptyCard } from '@/components/canvas/empty-card-dismissed';
import { useEmptyCardDismissed } from '@/components/canvas/useEmptyCardDismissed';
import type { HelpArticleKey } from '@/lib/help-articles';
import { StartPanel } from './StartPanel';
import { StartSaveSwitch } from './StartSaveSwitch';
import { templateCard } from './template-card';
import { setStartPanelOpen } from './start-panel-open';
import { startClosedKey } from './start-closed-key';
import { TEMPLATE_STARTS } from './start-template-items';
import { useStartPalette } from '@/components/start/useStartPalette';

const glyph = (icon: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(icon, 16);

// Each rail group's glyph (start-template-items.ts OWN_GROUPS).
const RAIL_ICONS: Readonly<Record<string, ReturnType<typeof lucideGlyph>>> = {
  recommended: glyph(lucideStar),
  logos: glyph(lucideShapes),
  // A phone, the device a wireframe is most often for (docs/specs/007-editor/wireframe-pages.md).
  wireframes: WireframesIcon,
  design: glyph(lucidePenTool),
};
const FALLBACK_ICON = glyph(lucideLightbulb);

function WireframesIcon() {
  return <DeviceGlyph device="iphone" size={16} />;
}

const COPY: Record<
  EditorMode,
  { title: string; line: string; noMatch: string; help: HelpArticleKey }
> = {
  pages: {
    title: 'Start Making Pages',
    line: 'Pick something to make, or close this to start from a blank page.',
    noMatch: 'page templates',
    help: 'templates',
  },
};

export function StartFromTemplates({
  mode,
  tabId,
  onTemplate,
}: {
  mode: EditorMode;
  tabId: string;
  onTemplate: (kind: TemplateKind) => void;
}) {
  // The tab's own colours (start-palette.ts).
  const palette = useStartPalette();
  const start = TEMPLATE_STARTS[mode];
  const copy = COPY[mode];
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
  // The × starts from nothing: the panel stays closed on this tab, for this person (empty-card-dismissed.ts), until the
  // palette tray's Show Templates brings it back (StartAgainTray).
  const closedKey = startClosedKey(tabId, mode);
  const closed = useEmptyCardDismissed(closedKey);
  // On screen: the tours hold their offer until it goes (start-panel-open.ts).
  useEffect(() => {
    if (closed) return;
    setStartPanelOpen(true);
    return () => setStartPanelOpen(false);
  }, [closed]);
  if (closed) return null;
  const close = () => {
    dismissEmptyCard(closedKey);
  };
  return (
    <StartPanel
      titleId={`start-${mode}-title`}
      title={copy.title}
      line={copy.line}
      searchLabel="Find a template"
      noMatchNoun={copy.noMatch}
      helpArticle={copy.help}
      palette={palette}
      categories={categories}
      initialCategory="recommended"
      cardsIn={(id) => (start.groups.find((g) => g.id === id)?.kinds ?? []).map(templateCard)}
      search={(query) =>
        start.search(query).map((g) => ({ category: g.group, cards: g.kinds.map(templateCard) }))
      }
      onChoose={(kind) => onTemplate(kind as TemplateKind)}
      onClose={close}
      // Where the new item lives, and a switch to move it while it is empty (save-locations.md "On the start screen").
      footer={(palette) => <StartSaveSwitch palette={palette} />}
    />
  );
}
